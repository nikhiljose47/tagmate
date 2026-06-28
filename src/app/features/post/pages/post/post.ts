import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { AuthService } from '../../../../core/services/auth.service';
import { tagToRow } from '../../../../core/services/tag.mapper';
import { ToastService } from '../../../../core/services/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { AppRoute } from '../../../../core/enums/route.enum';

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

  // SharedStateService is public so the template can read shared.text() / shared.coordinates()
  constructor(
    public  shared: SharedStateService,
    private router: Router,
    private toast:  ToastService
  ) {}

  isSubmitting = false;

  readonly tags = [
    'news', 'weather', 'food', 'event', 'sale', 'traffic', 'alert',
    'sports', 'fitness', 'environment', 'business', 'tech', 'art',
    'health', 'market', 'entertainment', 'startup', 'network', 'utility',
  ];

  user = { name: 'Guest User', avatarUrl: 'assets/avatar/panda.png' };

  formData = {
    headline: '',
    images:   [] as string[],
    expiresIn: 60,
    tag:      '',
  };

  showMapHint  = signal(false);
  showPreview  = signal(false);

  onImageSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.formData.images.push(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeImage(i: number): void {
    this.formData.images.splice(i, 1);
  }

  onPickLocation(): void {
    this.showMapHint.set(true);
    this.toast.show('Choose a location on the Hood map, then return to Post.', 'info');
    void this.router.navigate([AppRoute.Hood]);
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.toast.show('Geolocation is not supported by this browser.', 'danger');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.shared.updateCoordinates(position.coords.latitude, position.coords.longitude);
        this.shared.updateText('Current device location');
        this.toast.show('Current location attached to this post.', 'success');
      },
      () => this.toast.show('Could not read your current location.', 'danger'),
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }

  togglePreview(): void { this.showPreview.update((v) => !v); }

  async onSubmit(f: NgForm): Promise<void> {
    if (!f.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const coords = this.shared.coordinates();
    if (!coords) {
      this.toast.show('Choose a location from the Hood map before posting.', 'warning');
      this.isSubmitting = false;
      return;
    }

    try {
      const session = await firstValueFrom(this.supabase.session$);
      if (!session?.user) {
        this.toast.show('You must be signed in to post a tag.', 'warning');
        this.isSubmitting = false;
        return;
      }

      const uid         = session.user.id;
      const currentUser = await firstValueFrom(this.auth.user$);
      const uploadedImages: string[] = [];

      for (const img of this.formData.images) {
        if (img.startsWith('data:')) {
          try {
            const path = `tags/${Date.now()}-${Math.random().toString(36).substring(7)}`;
            uploadedImages.push(await this.supabase.uploadImageBase64(path, img));
          } catch (imgErr) {
            this.logger.error('Image upload failed', imgErr);
            this.toast.show('Image upload failed — posting without that photo.', 'warning');
          }
        } else {
          uploadedImages.push(img);
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
        images:    uploadedImages,
      };

      await firstValueFrom(this.tagRepo.create(tagObject));
      this.submitted.emit(tagObject);
      void this.router.navigate([AppRoute.Hood]);
    } catch (e) {
      this.logger.error('Error saving tag', e);
      this.toast.show('Failed to post tag. Please try again.', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }

  onDiscard(): void {
    this.formData = { headline: '', images: [], expiresIn: 60, tag: '' };
    this.showMapHint.set(false);
    this.showPreview.set(false);
    this.discarded.emit();
    void this.router.navigate([AppRoute.Hood]);
  }
}
