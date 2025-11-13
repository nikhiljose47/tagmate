import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'topbar',
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
 @Output() addPost = new EventEmitter<void>();

  constructor(private router: Router, public auth: AuthService) { }


  onAddPost() {
    this.addPost.emit();
  }

  onNotifyClick() {
    console.log('Notification clicked');
  }

    signIn() {
    this.router.navigate(['/login']);
  }
}