import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TAG_REPOSITORY } from '../../../../core/repositories/repository.tokens';
import { LoggerService } from '../../../../core/services/logger.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Tag } from '../../../../core/models/tag.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';

interface MetricCard {
  label: string;
  value: string;
  note: string;
  icon: string;
}

interface CountRow {
  label: string;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, TimeAgoPipe],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class AnalyticsPage implements OnInit {
  private readonly tagRepo = inject(TAG_REPOSITORY);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);

  protected readonly posts = signal<Tag[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);

  protected readonly metrics = computed<MetricCard[]>(() => {
    const posts = this.posts();
    const neighborhoods = new Set(posts.map((post) => post.hoodId || 'Nearby')).size;
    const alerts = posts.filter((post) => post.tag === 'alert').length;
    const engagement = posts.reduce(
      (sum, post) => sum + (post.likeCount ?? 0) + (post.commentCount ?? 0) + (post.rsvpCount ?? 0),
      0
    );
    const top = this.categoryRows()[0]?.label ?? 'No category';

    return [
      { label: 'Active posts', value: posts.length.toString(), note: 'Latest operational sample', icon: 'bi-broadcast' },
      { label: 'Neighborhoods', value: neighborhoods.toString(), note: 'Distinct hoods represented', icon: 'bi-buildings' },
      { label: 'Alerts', value: alerts.toString(), note: 'Posts tagged as alert', icon: 'bi-exclamation-triangle' },
      { label: 'Engagement', value: engagement.toString(), note: 'Likes, comments, and RSVPs', icon: 'bi-activity' },
      { label: 'Top category', value: top, note: 'Highest volume category', icon: 'bi-tags' },
    ];
  });

  protected readonly categoryRows = computed(() => this.countBy((post) => post.tag || 'uncategorized'));
  protected readonly hoodRows = computed(() => this.countBy((post) => post.hoodId || 'Nearby'));
  protected readonly contributorRows = computed(() => this.countBy((post) => post.username || 'Anonymous'));
  protected readonly latestAlerts = computed(() =>
    this.posts()
      .filter((post) => post.tag === 'alert')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
  );

  ngOnInit(): void {
    this.loadAnalytics();
  }

  protected loadAnalytics(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.tagRepo.getFiltered({ excludeTag: 'bulletin' }, 150, 0).subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load analytics workspace', err);
        this.toast.show('Could not load analytics.', 'danger');
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected postKey(post: Tag): string {
    return post.id ?? `${post.userId}-${post.createdAt}`;
  }

  private countBy(selector: (post: Tag) => string): CountRow[] {
    const posts = this.posts();
    const counts = new Map<string, number>();
    posts.forEach((post) => counts.set(selector(post), (counts.get(selector(post)) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([label, count]) => ({
        label,
        count,
        percent: posts.length ? Math.round((count / posts.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }
}
