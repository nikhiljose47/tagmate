import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { SharedStateService } from '../../services/shared-state.service';
import { Tag } from '../../models/tag.model';

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

  constructor(public shared: SharedStateService) { }

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

  onSubmit(f: NgForm) {
    if (!f.valid) return;

    const coords = this.shared.coordinates();

    const tagObject: Tag = {
      username: this.user.name,
      userId: 'GuestPanda',
      highlight: this.formData.headline,
      lat: coords[0],
      lng: coords[1],
      expiresIn: this.formData.expiresIn,
      tag: this.formData.tag,
      createdAt: new Date().toISOString(),
      images: [...this.formData.images]
    };

    this.submitted.emit(tagObject);
  }

  onDiscard() {
    this.formData = { headline: '', images: [], expiresIn: 60, tag: '' };
    this.showMapHint = false;
    this.discarded.emit();
  }

}
