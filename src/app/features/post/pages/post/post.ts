import { Component, EventEmitter, Output, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { SharedStateService, PostDraft } from '../../../../core/services/shared-state.service';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { MediaService } from '../../../../core/services/media.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { MediaCompressionService } from '../../../../core/services/media-compression.service';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TagCategory } from '../../../../core/enums/tag-category.enum';
import { NetworkService } from '../../../../core/services/network.service';

/** A locally-selected file + instant Object URL preview. */
interface MediaItem {
  file:       File;
  previewUrl: string;   // URL.createObjectURL() — shown instantly, no FileReader wait
  type:       'image' | 'video';
}

const MAX_MEDIA = 5;

/** Rotating compose prompts — a little nudge to start typing. */
const COMPOSE_PROMPTS = [
  "What's buzzing in your hood right now?",
  'Spotted something? Your neighbors want to know…',
  'Share a deal, an alert, or just say hi to the hood 👋',
  'Traffic? Garage sale? Lost cat? Tag it here…',
  "Something happening nearby? Don't keep it to yourself…",
];


@Component({
  selector: 'app-post',
  standalone: true,
  imports: [CommonModule, FormsModule, TagEmojiPipe],
  templateUrl: './post.html',
  styleUrls: ['./post.scss'],
})
export class PostPage {
  @Output() discarded = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<Tag>();

  private readonly userSession = inject(UserSessionService);
  private readonly mediaService = inject(MediaService);
  private readonly tagRepo     = inject(TAG_REPOSITORY);
  private readonly logger      = inject(LoggerService);
  private readonly media       = inject(MediaCompressionService);
  private readonly network     = inject(NetworkService);

  constructor(
    public  shared: SharedStateService,
    private router: Router,
    private toast:  ToastService
  ) {
    // Restore the draft after the pick-location round-trip to the map —
    // navigation destroys this component, so the draft lives in SharedStateService.
    const draft = this.shared.postDraft();
    if (draft) {
      this.formData = {
        headline:    draft.headline,
        expiresIn:   draft.expiresIn,
        tag:         draft.tag,
        isEvent:     draft.isEvent,
        eventStart:  draft.eventStart,
        eventEnd:    draft.eventEnd,
        pollOptions: [...draft.pollOptions],
      };
      this.mediaItems.set(draft.media);
      // Old drafts may hold a value that isn't one of the presets — snap to 1 hour.
      if (!this.expiryOptions.some((o) => o.value === this.formData.expiresIn)) {
        this.formData.expiresIn = 60;
      }
    }
  }

  private saveDraft(): void {
    const draft: PostDraft = {
      headline:    this.formData.headline,
      expiresIn:   this.formData.expiresIn,
      tag:         this.formData.tag,
      isEvent:     this.formData.isEvent,
      eventStart:  this.formData.eventStart,
      eventEnd:    this.formData.eventEnd,
      pollOptions: [...this.formData.pollOptions],
      media:       this.mediaItems(),
    };
    this.shared.postDraft.set(draft);
  }

  // ── Signals (required for zoneless CD) ──────────────────────────────────
  isSubmitting = signal(false);
  mediaItems   = signal<MediaItem[]>([]);
  showMapHint  = signal(false);
  showPreview  = signal(false);
  locationErrorVisible = signal(false);
  shakeLocation = signal(false);
  tagErrorVisible = signal(false);

  readonly canAddMore = computed(() => this.mediaItems().length < MAX_MEDIA);
  readonly maxMedia   = MAX_MEDIA;

  // ── Form data ────────────────────────────────────────────────────────────
  readonly tags = Object.values(TagCategory);
  readonly composePrompt = COMPOSE_PROMPTS[Math.floor(Math.random() * COMPOSE_PROMPTS.length)];

  /** Post lifetime presets — `expiresIn` is minutes app-wide (see LifespanPipe). */
  readonly expiryOptions = [
    { label: '15 min',  value: 15 },
    { label: '1 hour',  value: 60 },
    { label: '6 hours', value: 360 },
    { label: '1 day',   value: 1440 },
    { label: '3 days',  value: 4320 },
    { label: '1 week',  value: 10080 },
  ];

  readonly user = computed(() => {
    const u = this.userSession.user();
    return {
      name: u?.name ?? 'Guest',
      avatarUrl: 'assets/avatar/panda.png',
    };
  });

  formData = {
    headline:  '',
    expiresIn: 60,
    tag:       '',
    isEvent:   false,
    eventStart: '',
    eventEnd:   '',
    pollOptions: ['', ''],
  };

  selectTag(tag: string): void {
    this.formData.tag = tag;
    this.tagErrorVisible.set(false);
  }

  // ── Polls ────────────────────────────────────────────────────────────────
  addPollOption(): void {
    if (this.formData.pollOptions.length < 5) {
      this.formData.pollOptions.push('');
    }
  }

  removePollOption(index: number): void {
    if (this.formData.pollOptions.length > 2) {
      this.formData.pollOptions.splice(index, 1);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

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
    this.saveDraft();   // survive the component destroy during the map round-trip
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
        this.locationErrorVisible.set(false);
        this.toast.show('Current location attached to this post.', 'success');
      },
      () => this.toast.show('Could not read your current location.', 'danger'),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }

  togglePreview(): void { this.showPreview.update((v) => !v); }

  // ── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(f: NgForm): Promise<void> {
    if (this.isSubmitting()) return;
    if (!this.network.isOnline()) {
      this.toast.show('You are offline. Connect to the internet before posting.', 'warning');
      return;
    }
    if (!f.valid) {
      f.form.markAllAsTouched();
      return;
    }

    if (!this.formData.tag) {
      this.tagErrorVisible.set(true);
      this.toast.show('Pick a category for your post.', 'warning');
      return;
    }

    const coords = this.shared.coordinates();
    if (!coords) {
      this.locationErrorVisible.set(true);
      this.triggerLocationShake();
      this.toast.show('Choose a location from the Hood map before posting.', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const currentUser = this.userSession.user();
      if (!currentUser) {
        this.toast.show('You must be signed in to post a tag.', 'warning');
        return;
      }

      const uid         = currentUser.uid;
      const uploadedUrls: string[] = [];

      for (const item of this.mediaItems()) {
        try {
          // Shrink images before upload (videos pass through untouched) so we
          // save bandwidth on the upload and on every future download.
          const { file } = await this.media.compress(item.file);
          const ext  = file.name.split('.').pop() ?? (item.type === 'video' ? 'mp4' : 'jpg');
          const path = `tags/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          uploadedUrls.push(await this.mediaService.uploadFile(path, file));
        } catch (err) {
          this.logger.error('Media upload failed', err);
          this.toast.show('One file failed to upload — continuing without it.', 'warning');
        }
      }

      const tagObject: Tag = {
        username:  currentUser.name,
        userId:    uid,
        highlight: this.formData.headline,
        lat:       coords[0],
        lng:       coords[1],
        expiresIn: this.formData.expiresIn,
        tag:       this.formData.tag,
        createdAt: new Date().toISOString(),
        images:    uploadedUrls,
        eventStart: this.formData.isEvent ? this.formData.eventStart || undefined : undefined,
        eventEnd:   this.formData.isEvent ? this.formData.eventEnd || undefined : undefined,
        pollOptions: this.formData.tag === TagCategory.Question ? this.formData.pollOptions.filter(o => o.trim().length > 0) : undefined,
        pollVotes: this.formData.tag === TagCategory.Question ? {} : undefined,
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
    this.formData  = { headline: '', expiresIn: 60, tag: '', isEvent: false, eventStart: '', eventEnd: '', pollOptions: ['', ''] };
    this.shared.postDraft.set(null);
    this.showMapHint.set(false);
    this.showPreview.set(false);
    this.locationErrorVisible.set(false);
    this.shakeLocation.set(false);
    this.tagErrorVisible.set(false);
  }

  private triggerLocationShake(): void {
    this.shakeLocation.set(false);
    setTimeout(() => this.shakeLocation.set(true));
    setTimeout(() => this.shakeLocation.set(false), 450);
  }
}
