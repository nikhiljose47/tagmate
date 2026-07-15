import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Tag } from '../../../../core/models/tag.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';

interface ActivityRow {
  user: string;
  posts: number;
  alerts: number;
  engagement: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, TimeAgoPipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminPage implements OnInit {
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  protected readonly social = inject(SocialInteractionsService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);

  protected readonly adminStats = computed(() => {
    const posts = this.posts();
    return [
      { label: 'Reviewable posts', value: posts.length, note: 'Latest non-bulletin records' },
      {
        label: 'Alert posts',
        value: posts.filter((post) => post.tag === 'alert').length,
        note: 'Operational risk queue',
      },
      {
        label: 'Hidden locally',
        value: posts.filter((post) => this.social.isHidden(post)).length,
        note: 'Current viewer signal',
      },
      {
        label: 'Owned by you',
        value: posts.filter((post) => this.social.canDelete(post)).length,
        note: 'Deletion available',
      },
    ];
  });

  protected readonly activityRows = computed<ActivityRow[]>(() => {
    const rows = new Map<string, ActivityRow>();
    for (const post of this.posts()) {
      const user = post.username || 'Anonymous';
      const row = rows.get(user) ?? { user, posts: 0, alerts: 0, engagement: 0 };
      row.posts += 1;
      row.alerts += post.tag === 'alert' ? 1 : 0;
      row.engagement += (post.likeCount ?? 0) + (post.commentCount ?? 0) + (post.rsvpCount ?? 0);
      rows.set(user, row);
    }
    return Array.from(rows.values())
      .sort((a, b) => b.posts - a.posts || b.engagement - a.engagement)
      .slice(0, 10);
  });

  protected readonly moderationRows = computed(() =>
    this.posts()
      .filter(
        (post) => post.tag === 'alert' || this.social.isHidden(post) || this.social.canDelete(post),
      )
      .slice(0, 12),
  );

  ngOnInit(): void {
    this.loadAdmin();
  }

  protected loadAdmin(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.tagRepo.getFiltered({ excludeTag: 'bulletin' }, 120, 0).subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load admin workspace', err);
        this.toast.show('Could not load admin workspace.', 'danger');
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected reportPost(post: Tag): void {
    this.social.reportPost(post);
    this.toast.show('Post hidden and flagged for review.', 'warning');
  }

  protected async deletePost(post: Tag): Promise<void> {
    const deleted = await this.social.confirmAndDeletePost(post);
    if (deleted) {
      this.posts.update((posts) =>
        posts.filter((item) => this.postKey(item) !== this.postKey(post)),
      );
    }
  }

  protected postKey(post: Tag): string {
    return this.social.postKey(post);
  }
}
