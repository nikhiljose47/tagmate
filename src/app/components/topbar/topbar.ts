import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { setToggle } from '../../store/toggle/toggle.state';
import { Store } from '@ngrx/store';
import { AppState } from '../../state/app.state';

@Component({
  selector: 'topbar',
  imports: [CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  @Output() addPost = new EventEmitter<void>();
  private store = inject<Store<AppState>>(Store);
  
  constructor(private router: Router, public auth: AuthService) { }


  onAddPost() {
    this.addPost.emit();
    let x = this.store.selectSignal(
      s => s.toggle.toggles['shouldAddPost']
    );
    console.log('add click', x());
    this.store.dispatch(setToggle({ key: 'shouldAddPost', value: !x() }));
  }

  onNotifyClick() {
    console.log('Notification clicked');
  }

  signIn() {
    this.router.navigate(['/login']);
  }
}