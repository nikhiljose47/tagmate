import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { SharedStateService } from '../../services/shared-state.service';
import { Tag } from '../../models/tag.model';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { tagToRow } from '../../services/tag.mapper';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'tag-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-form.html',
  styleUrls: ['./tag-form.scss']
})
export class TagForm {
  @Output() discarded = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<any>();

  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  constructor(
    public shared: SharedStateService,
    private router: Router,
    private toast: ToastService
  ) { }
  isSubmitting = false;

  tags = [
    'news', 'weather', 'food', 'event', 'sale', 'traffic', 'alert',
    'sports', 'fitness', 'environment', 'business', 'tech', 'art',
    'health', 'market', 'entertainment', 'startup', 'network', 'utility'
  ];

  user = {
    name: 'Guest User',
    avatarUrl: 'assets/avatar/panda.png'
  };

  formData = {
    headline: '',
    images: [] as string[],
    expiresIn: 60,
    tag: '',
  };

  showMapHint = signal(false);
  showPreview = signal(false);

  onImageSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.formData.images.push(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeImage(i: number) {
    this.formData.images.splice(i, 1);
  }

  onPickLocation() {
    this.showMapHint.set(true);
    this.toast.show('Choose a location on the Hood map, then return to Post.', 'info');
    this.router.navigate(['/hood']);
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

  togglePreview(): void {
    this.showPreview.update((value) => !value);
  }

  async onSubmit(f: NgForm) {
    if (!f.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const coords = this.shared.coordinates();
    if (!coords) {
      this.toast.show('Choose a location from the Hood map before posting.', 'warning');
      this.isSubmitting = false;
      return;
    }

    try {
      const currentUser = await firstValueFrom(this.auth.user$);
      const uploadedImages = [];
      for (const img of this.formData.images) {
        if (img.startsWith('data:')) {
          const path = `tags/${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const url = await this.supabase.uploadImageBase64(path, img);
          uploadedImages.push(url);
        } else {
          uploadedImages.push(img);
        }
      }

      const tagObject: Tag = {
        username: currentUser.username,
        userId: currentUser.uid ?? 'guest',
        highlight: this.formData.headline,
        lat: coords[0],
        lng: coords[1],
        expiresIn: this.formData.expiresIn,
        tag: this.formData.tag,
        createdAt: new Date().toISOString(),
        images: uploadedImages,
      };

      const { error } = await firstValueFrom(this.supabase.addRow('tags', tagToRow(tagObject) as Record<string, unknown>));
      if (error) throw error;
      this.submitted.emit(tagObject);
      this.router.navigate(['/hood']);
    } catch (e) {
      console.error('Error saving tag', e);
      this.toast.show('Failed to post tag. Please try again.', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }

  onDiscard() {
    this.formData = { headline: '', images: [], expiresIn: 60, tag: '' };
    this.showMapHint.set(false);
    this.showPreview.set(false);
    this.discarded.emit();
    this.router.navigate(['/hood']);
  }

}
