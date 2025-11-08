import { Component } from '@angular/core';
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
  tags = [
    'news', 'weather', 'food', 'event', 'sale', 'traffic', 'alert', 
    'sports', 'fitness', 'environment', 'business', 'tech', 'art', 
    'health', 'market', 'entertainment', 'startup', 'network', 'utility'
  ];

  formData = {
    username: '',
    headline: '',
    lat: '',
    lng: '',
    expiresIn: '',
    tag: ''
  };

  onSubmit(form: NgForm) {
    if (form.valid) {
      console.log('✅ Submitted Data:', this.formData);
      alert('Form submitted successfully!');
      form.resetForm();
    }
  }
}
