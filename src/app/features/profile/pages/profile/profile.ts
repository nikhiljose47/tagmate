import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { ToastService } from '../../../../core/services/toast.service';
import { SharedStateService } from '../../../../core/services/shared-state.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { AppRoute } from '../../../../core/enums/route.enum';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TagEmojiPipe } from '../../../../shared/pipes/tag-emoji.pipe';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { coverGradient, avatarBg } from '../../../../shared/utils/color.utils';
import { ThemeService, AppTheme } from '../../../../core/services/theme.service';

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
  private readonly sessionService = inject(UserSessionService);
  private readonly router  = inject(Router);
  private readonly toast   = inject(ToastService);
  private readonly shared  = inject(SharedStateService);
  private readonly logger  = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly social = inject(SocialInteractionsService);
  protected readonly theme  = inject(ThemeService);

  readonly availableThemes: { value: AppTheme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'midnight', label: 'Midnight (OLED Black)' },
    { value: 'forest', label: 'Forest' },
    { value: 'sepia', label: 'Sepia' },
  ];

  readonly user$          = this.sessionService.user$;
  readonly coverGradient  = coverGradient;
  readonly avatarBg       = avatarBg;

  myTags     = signal<Tag[]>([]);
  isLoading  = signal(true);
  activeTab  = signal<ProfileTab>('posts');
  editMode   = signal(false);
  allTags    = signal<Tag[]>([]);
  savedTags  = computed(() => this.allTags().filter((tag) => this.social.isSaved(tag) && !this.social.isHidden(tag)));

  // Account Conversion for Guest
  convertEmail = signal('');
  convertPassword = signal('');
  convertUsername = signal('');
  convertError = signal('');
  convertLoading = signal(false);

  ngOnInit(): void {
    this.tagRepo.getAll().subscribe({
      next: (tags) => this.allTags.set(tags),
      error: (err) => this.logger.error('Failed to load saved posts', err),
    });

    this.sessionService.user$.subscribe((user) => {
      if (user.isGuest) {
        this.myTags.set([]);
        this.isLoading.set(false);
        return;
      }
      this.tagRepo.getByUserId(user.uid!).subscribe({
        next: (tags) => {
          this.myTags.set(tags);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.logger.error('Failed to load user tags', err);
          this.myTags.set([]);
          this.isLoading.set(false);
        },
      });
    });

    // Drop a post immediately if it was deleted here or on any other page.
    this.social.postDeleted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((deletedKey) => {
      this.allTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== deletedKey));
      this.myTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== deletedKey));
    });
  }

  async deleteTag(tag: Tag): Promise<void> {
    const deleted = await this.social.confirmAndDeletePost(tag);
    if (deleted) {
      const key = this.social.postKey(tag);
      this.allTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== key));
      this.myTags.update((tags) => tags.filter((t) => this.social.postKey(t) !== key));
    }
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
    const key = this.social.postKey(tag);
    void this.router.navigate(['/post/edit', key]);
  }

  async logout(): Promise<void> {
    try {
      await this.sessionService.logout();
      this.toast.show('Logged out.', 'success');
      await this.router.navigate([AppRoute.Login]);
    } catch (err) {
      this.logger.error('Logout failed', err);
      this.toast.show('Could not log out.', 'danger');
    }
  }

  async convertAccount(): Promise<void> {
    if (!this.convertEmail().trim() || !this.convertPassword() || !this.convertUsername().trim()) {
      this.convertError.set('Please fill out all fields.');
      return;
    }
    this.convertError.set('');
    this.convertLoading.set(true);
    try {
      const res = await this.sessionService.convertGuestToPermanent(
        this.convertEmail().trim(),
        this.convertPassword(),
        this.convertUsername().trim()
      );
      if (res.ok) {
        this.toast.show('Account converted successfully!', 'success');
        this.editMode.set(false);
      } else {
        this.convertError.set(res.message);
        this.toast.show(res.message, 'danger');
      }
    } catch (err: any) {
      this.convertError.set(err?.message ?? 'Conversion failed');
      this.toast.show(err?.message ?? 'Conversion failed', 'danger');
    } finally {
      this.convertLoading.set(false);
    }
  }
}
