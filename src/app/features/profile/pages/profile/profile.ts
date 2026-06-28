import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { coverGradient, avatarBg } from '../../../../shared/utils/color.utils';

type ProfileTab = 'posts' | 'saved' | 'settings';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, TagGradientPipe, TagEmojiPipe, EmptyStateComponent],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
})
export class ProfilePage implements OnInit {
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);
  private readonly toast   = inject(ToastService);
  private readonly shared  = inject(SharedStateService);
  private readonly logger  = inject(LoggerService);
  protected readonly social = inject(SocialInteractionsService);

  readonly user$          = this.auth.user$;
  readonly coverGradient  = coverGradient;
  readonly avatarBg       = avatarBg;

  myTags$: Observable<Tag[]> | null = null;
  isLoading  = true;
  activeTab  = signal<ProfileTab>('posts');
  editMode   = signal(false);
  allTags    = signal<Tag[]>([]);
  savedTags  = computed(() => this.allTags().filter((tag) => this.social.isSaved(tag) && !this.social.isHidden(tag)));

  ngOnInit(): void {
    this.tagRepo.getAll().subscribe({
      next: (tags) => this.allTags.set(tags),
      error: (err) => this.logger.error('Failed to load saved posts', err),
    });

    this.auth.user$.subscribe((user) => {
      if (user.isGuest) {
        this.myTags$  = of([]);
        this.isLoading = false;
        return;
      }
      this.tagRepo.getByUserId(user.uid!).subscribe({
        next: (tags) => {
          this.myTags$   = of(tags);
          this.isLoading = false;
        },
        error: (err) => {
          this.logger.error('Failed to load user tags', err);
          this.myTags$   = of([]);
          this.isLoading = false;
        },
      });
    });
  }

  deleteTag(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Delete this post?')) return;
    this.tagRepo.delete(id).subscribe({
      next: () => this.toast.show('Post deleted.', 'success'),
      error: (err) => {
        this.logger.error('Delete tag failed', err);
        this.toast.show('Could not delete post.', 'danger');
      },
    });
  }

  setTab(tab: ProfileTab): void     { this.activeTab.set(tab); }
  toggleEditProfile(): void         { this.editMode.update((v) => !v); }
  saveProfile(): void               { this.editMode.set(false); this.toast.show('Profile saved.', 'success'); }
  saveSettings(): void              { this.toast.show('Settings saved.', 'success'); }
  savedCount(): number              { return this.savedTags().length; }

  viewOnMap(tag: Tag): void {
    this.shared.updateCoordinates(tag.lat, tag.lng);
    this.shared.updateText(tag.highlight || tag.hoodId || 'Selected post');
    void this.router.navigate([AppRoute.Hood]);
  }

  editPost(tag: Tag): void {
    this.toast.show(`Editing "${tag.highlight || 'this post'}" is coming soon.`, 'info');
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      this.toast.show('Logged out.', 'success');
      await this.router.navigate([AppRoute.Login]);
    } catch (err) {
      this.logger.error('Logout failed', err);
      this.toast.show('Could not log out.', 'danger');
    }
  }
}
