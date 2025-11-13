import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

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
  @Input() 

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
    location: ''
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

  receiveLocationFromMap(locName: string) {
    this.formData.location = locName;
    this.showMapHint = false;
  }

  onSubmit(f: any) {
    if (f.valid) {
      console.log('Submitted:', this.formData);
      this.submitted.emit(this.formData);
      // Firestore or backend call here
    }
  }

  onDiscard() {
    this.formData = { headline: '', images: [], expiresIn: 60, tag: '', location: '' };
    this.showMapHint = false;
    this.discarded.emit();
  }

}
