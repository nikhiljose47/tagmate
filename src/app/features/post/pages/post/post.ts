import { Component, EventEmitter, Output, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { AppRoute } from '../../../../core/enums/route.enum';

/** A locally-selected file + instant Object URL preview. */
interface MediaItem {
  file:       File;
  previewUrl: string;   // URL.createObjectURL() — shown instantly, no FileReader wait
  type:       'image' | 'video';
}

const MAX_MEDIA = 5;

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post.html',
  styleUrls: ['./post.scss'],
})
export class PostPage {
  @Output() discarded = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<Tag>();

  private readonly supabase = inject(SupabaseService);
  private readonly auth     = inject(AuthService);
  private readonly tagRepo  = inject(TAG_REPOSITORY);
  private readonly logger   = inject(LoggerService);

  constructor(
    public  shared: SharedStateService,
    private router: Router,
    private toast:  ToastService
  ) {}

  // ── Signals (required for zoneless CD) ──────────────────────────────────
  isSubmitting = signal(false);
  mediaItems   = signal<MediaItem[]>([]);
  showMapHint  = signal(false);
  showPreview  = signal(false);

  readonly canAddMore = computed(() => this.mediaItems().length < MAX_MEDIA);
  readonly maxMedia   = MAX_MEDIA;

  // ── Form data ────────────────────────────────────────────────────────────
  readonly tags = [
    'news', 'weather', 'food', 'event', 'sale', 'traffic', 'alert',
    'sports', 'fitness', 'environment', 'business', 'tech', 'art',
    'health', 'market', 'entertainment', 'startup', 'network', 'utility',
  ];

  user = { name: 'Guest User', avatarUrl: 'assets/avatar/panda.png' };

  formData = {
    headline:  '',
    expiresIn: 60,
    tag:       '',
  };

  // ── Media selection ──────────────────────────────────────────────────────

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';   // reset so same file can be re-added after removal

    for (const file of files) {
      if (this.mediaItems().length >= MAX_MEDIA) break;

      const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      // Object URL gives an instant preview without any FileReader roundtrip.
      const previewUrl = URL.createObjectURL(file);
      this.mediaItems.update((items) => [...items, { file, previewUrl, type }]);
    }
  }

  removeMedia(index: number): void {
    this.mediaItems.update((items) => {
      // Revoke the object URL to free browser memory.
      URL.revokeObjectURL(items[index].previewUrl);
      return items.filter((_, i) => i !== index);
    });
  }

  isVideo(item: MediaItem): boolean { return item.type === 'video'; }

  // ── Location ─────────────────────────────────────────────────────────────

  onPickLocation(): void {
    this.showMapHint.set(true);
    this.shared.pickModeActive.set(true);   // belt-and-suspenders alongside query param
    void this.router.navigate([AppRoute.Hood], { queryParams: { pick: '1' } });
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.toast.show('Geolocation is not supported by this browser.', 'danger');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.shared.updateCoordinates(coords.latitude, coords.longitude);
        this.shared.updateText('Current device location');
        this.toast.show('Current location attached to this post.', 'success');
      },
      () => this.toast.show('Could not read your current location.', 'danger'),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }

  togglePreview(): void { this.showPreview.update((v) => !v); }

  // ── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(f: NgForm): Promise<void> {
    if (!f.valid || this.isSubmitting()) return;

    const coords = this.shared.coordinates();
    if (!coords) {
      this.toast.show('Choose a location from the Hood map before posting.', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const session = await firstValueFrom(this.supabase.session$);
      if (!session?.user) {
        this.toast.show('You must be signed in to post a tag.', 'warning');
        return;
      }

      const uid         = session.user.id;
      const currentUser = await firstValueFrom(this.auth.user$);
      const uploadedUrls: string[] = [];

      for (const item of this.mediaItems()) {
        try {
          const ext  = item.file.name.split('.').pop() ?? (item.type === 'video' ? 'mp4' : 'jpg');
          const path = `tags/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          uploadedUrls.push(await this.supabase.uploadFile(path, item.file));
        } catch (err) {
          this.logger.error('Media upload failed', err);
          this.toast.show('One file failed to upload — continuing without it.', 'warning');
        }
      }

      const tagObject: Tag = {
        username:  currentUser.username,
        userId:    uid,
        highlight: this.formData.headline,
        lat:       coords[0],
        lng:       coords[1],
        expiresIn: this.formData.expiresIn,
        tag:       this.formData.tag,
        createdAt: new Date().toISOString(),
        images:    uploadedUrls,
      };

      await firstValueFrom(this.tagRepo.create(tagObject));
      this.submitted.emit(tagObject);
      this.resetForm();
      void this.router.navigate([AppRoute.Hood]);
    } catch (e) {
      this.logger.error('Error saving tag', e);
      this.toast.show('Failed to post tag. Please try again.', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onDiscard(): void {
    this.resetForm();
    this.discarded.emit();
    void this.router.navigate([AppRoute.Hood]);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private resetForm(): void {
    // Revoke all object URLs to avoid memory leaks.
    this.mediaItems().forEach((m) => URL.revokeObjectURL(m.previewUrl));
    this.mediaItems.set([]);
    this.formData  = { headline: '', expiresIn: 60, tag: '' };
    this.showMapHint.set(false);
    this.showPreview.set(false);
  }
}
