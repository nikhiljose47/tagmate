import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SocialProfile } from '../../../../core/models/social.model';
import { Tag } from '../../../../core/models/tag.model';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TagGradientPipe } from '../../../../shared/pipes/tag-gradient.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    TagGradientPipe,
    TimeAgoPipe,
  ],
  templateUrl: './public-profile.html',
  styleUrl: './public-profile.scss',
})
export class PublicProfilePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  protected readonly social = inject(SocialPlatformService);

  protected readonly profile = signal<SocialProfile | null>(null);
  protected readonly posts = signal<Tag[]>([]);
  protected readonly loading = signal(true);
  protected readonly missing = signal(false);

  async ngOnInit(): Promise<void> {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (!uid) {
      this.missing.set(true);
      this.loading.set(false);
      return;
    }
    if (uid === this.social.myUid()) {
      await this.router.navigate(['/profile']);
      return;
    }
    const profile = await this.social.getProfile(uid);
    if (!profile) {
      this.missing.set(true);
      this.loading.set(false);
      return;
    }
    this.profile.set(profile);
    try {
      this.posts.set(await firstValueFrom(this.tagRepo.getByUserId(uid)));
    } finally {
      this.loading.set(false);
    }
  }

  protected async toggleFollow(): Promise<void> {
    const profile = this.profile();
    if (!profile) return;
    const following = await this.social.toggleFollowUser(profile.uid);
    this.toast.show(
      following ? `Following ${profile.name}.` : `Unfollowed ${profile.name}.`,
      'success',
    );
  }

  protected message(): void {
    const profile = this.profile();
    if (profile)
      void this.router.navigate(['/messages'], {
        queryParams: { user: profile.uid, name: profile.name },
      });
  }

  protected async block(): Promise<void> {
    const profile = this.profile();
    if (!profile) return;
    const ok = await this.confirm.confirm({
      title: `Block ${profile.name}?`,
      message:
        'Their content will be hidden and neither of you will be able to contact or follow the other.',
      confirmText: 'Block',
      danger: true,
    });
    if (!ok) return;
    if (await this.social.blockUser(profile.uid)) {
      this.toast.show(`${profile.name} blocked.`, 'warning');
      await this.router.navigate(['/feed']);
    }
  }

  protected async report(): Promise<void> {
    const profile = this.profile();
    if (profile && (await this.social.reportUser(profile.uid)))
      this.toast.show('Profile reported for review.', 'success');
  }
}
