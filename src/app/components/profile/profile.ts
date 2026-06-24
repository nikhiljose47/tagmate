import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../services/firebase.service';
import { AuthService } from '../../services/auth.service';
import { Tag } from '../../models/tag.model';
import { Observable, of } from 'rxjs';
import markersData from '../../data/tags.json';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { SharedStateService } from '../../services/shared-state.service';

type ProfileTab = 'posts' | 'saved' | 'settings';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  private firestore = inject(FirestoreService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private shared = inject(SharedStateService);
  readonly user$ = this.auth.user$;
  
  myTags$: Observable<Tag[]> | null = null;
  isLoading = true;
  activeTab = signal<ProfileTab>('posts');
  editMode = signal(false);

  ngOnInit() {
    this.auth.user$.subscribe(user => {
      // Testing Mode: Load 2 dummy tags to simulate the user's posts
      this.myTags$ = of(markersData.slice(0, 2) as Tag[]);
      this.isLoading = false;
    });
  }

  deleteTag(id: string | undefined) {
    if (!id) return;
    if (confirm('Are you sure you want to delete this post?')) {
      this.firestore.deleteDoc('tags', id).subscribe();
    }
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  toggleEditProfile(): void {
    this.editMode.update((value) => !value);
  }

  saveProfile(): void {
    this.editMode.set(false);
    this.toast.show('Profile changes saved locally.', 'success');
  }

  viewOnMap(tag: Tag): void {
    this.shared.updateCoordinates(tag.lat, tag.lng);
    this.shared.updateText(tag.highlight || tag.hoodId || 'Selected post');
    void this.router.navigate(['/hood']);
  }

  editPost(tag: Tag): void {
    this.toast.show(`Editing "${tag.highlight || 'this post'}" is coming soon.`, 'info');
  }

  repost(tag: Tag): void {
    this.toast.show(`"${tag.highlight || 'Post'}" was queued for reposting.`, 'success');
  }

  saveSettings(): void {
    this.toast.show('Settings saved.', 'success');
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      this.toast.show('You have been logged out.', 'success');
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout failed', error);
      this.toast.show('Could not log out. Please try again.', 'danger');
    }
  }
}
