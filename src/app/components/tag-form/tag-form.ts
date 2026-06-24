import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { SharedStateService } from '../../services/shared-state.service';
import { Tag } from '../../models/tag.model';
import { FirestoreService } from '../../services/firebase.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

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

  constructor(
    public shared: SharedStateService,
    private firestore: FirestoreService,
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

  showMapHint = false;

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
    this.showMapHint = true;
    // Notify map component to enable location picking
    // Example: this.mapService.enablePickMode();
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
      const uploadedImages = [];
      for (const img of this.formData.images) {
        if (img.startsWith('data:')) {
          const path = `tags/${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const url = await this.firestore.uploadImageBase64(path, img);
          uploadedImages.push(url);
        } else {
          uploadedImages.push(img);
        }
      }

      const tagObject: Tag = {
        username: this.user.name,
        userId: 'GuestPanda',
        highlight: this.formData.headline,
        lat: coords[0],
        lng: coords[1],
        expiresIn: this.formData.expiresIn,
        tag: this.formData.tag,
        createdAt: new Date().toISOString(),
        images: uploadedImages
      };

      await this.firestore.addDoc('tags', tagObject).toPromise();
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
    this.showMapHint = false;
    this.discarded.emit();
    this.router.navigate(['/hood']);
  }

}
