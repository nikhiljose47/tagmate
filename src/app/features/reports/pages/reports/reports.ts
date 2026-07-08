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

type ReportFilter = 'all' | 'reported' | 'hidden' | 'alerts';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, TimeAgoPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class ReportsPage implements OnInit {
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  protected readonly social = inject(SocialInteractionsService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly filter = signal<ReportFilter>('all');

  protected readonly queue = computed(() => {
    const filter = this.filter();
    return this.posts()
      .filter((post) => {
        if (filter === 'reported') return this.social.reportedPosts().has(this.postKey(post));
        if (filter === 'hidden') return this.social.hiddenPosts().has(this.postKey(post));
        if (filter === 'alerts') return post.tag === 'alert';
        return post.tag === 'alert' || this.social.reportedPosts().has(this.postKey(post)) || this.social.hiddenPosts().has(this.postKey(post));
      })
      .sort((a, b) => this.priority(b) - this.priority(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  protected readonly filters: { key: ReportFilter; label: string }[] = [
    { key: 'all', label: 'All Review Items' },
    { key: 'reported', label: 'Reported' },
    { key: 'hidden', label: 'Hidden' },
    { key: 'alerts', label: 'Alerts' },
  ];

  ngOnInit(): void {
    this.loadReports();
  }

  protected loadReports(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.tagRepo.getFiltered({ excludeTag: 'bulletin' }, 100, 0).subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load reports workspace', err);
        this.toast.show('Could not load reports.', 'danger');
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected setFilter(filter: ReportFilter): void {
    this.filter.set(filter);
  }

  protected reportPost(post: Tag): void {
    this.social.reportPost(post);
    this.toast.show('Post hidden and flagged for review.', 'warning');
  }

  protected async deletePost(post: Tag): Promise<void> {
    const deleted = await this.social.confirmAndDeletePost(post);
    if (deleted) {
      this.posts.update((posts) => posts.filter((item) => this.postKey(item) !== this.postKey(post)));
    }
  }

  protected postKey(post: Tag): string {
    return this.social.postKey(post);
  }

  protected reasonFor(post: Tag): string {
    const key = this.postKey(post);
    if (this.social.reportedPosts().has(key)) return 'Reported by current viewer';
    if (this.social.hiddenPosts().has(key)) return 'Hidden by current viewer';
    if (post.tag === 'alert') return 'Alert category needs situational awareness';
    return 'Needs review';
  }

  protected priority(post: Tag): number {
    const key = this.postKey(post);
    if (this.social.reportedPosts().has(key)) return 3;
    if (post.tag === 'alert') return 2;
    if (this.social.hiddenPosts().has(key)) return 1;
    return 0;
  }
}
