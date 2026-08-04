import { Injectable, computed, signal } from '@angular/core';
import { Tag } from '../../core/models/tag.model';

export const FEED_BETA_MAIN_CATEGORIES = ['hot-now', 'dating', 'game', 'job', 'around'] as const;
export type FeedBetaMainCategory = (typeof FEED_BETA_MAIN_CATEGORIES)[number];

export type ContextPanelMode = 'empty' | 'post' | 'filters' | 'analytics' | 'moderation';

export interface WorkspaceNavItem {
  route: string | readonly unknown[];
  icon: string;
  activeIcon: string;
  label: string;
  exact?: boolean;
  mobile?: boolean;
}

export interface CommandResult {
  id: string;
  title: string;
  subtitle: string;
  route: unknown[];
  icon: string;
}

export interface HomeDistrictOption {
  key: string;
  name: string;
  country: string;
}

export interface FeedBetaArea {
  readonly id: string;
  readonly label: string;
  readonly country: string;
  readonly hood: string;
  readonly categories: readonly string[];
  readonly categoryCounts: Readonly<Record<FeedBetaMainCategory, number>>;
  readonly postCount: number;
}

export interface FeedBetaScope {
  readonly areaId: string;
  readonly location: string;
  readonly country: string;
  readonly hood: string;
  readonly category: string;
  /** True when the user picked a place from global search that has no posts yet. */
  readonly freeform?: boolean;
}

export interface PostListItem {
  key: string;
  title: string;
  meta: string;
  category: string;
  severity: 'normal' | 'warning' | 'critical';
  post: Tag;
}

export interface AnalyticsSummary {
  totalPosts: number;
  alertPosts: number;
  neighborhoods: number;
  topCategory: string;
  engagement: number;
}

export interface ModerationQueueItem {
  key: string;
  title: string;
  reason: string;
  post: Tag;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  readonly selectedPost = signal<Tag | null>(null);
  readonly contextMode = signal<ContextPanelMode>('empty');
  readonly commandOpen = signal(false);
  readonly rightPanelOpen = signal(true);
  readonly filterDrawerOpen = signal(false);
  readonly homeDistrictOptions = signal<HomeDistrictOption[]>([]);
  readonly homeDistrict = signal<HomeDistrictOption | null>(null);
  readonly homeTagOptions = signal<string[]>([]);
  readonly homeTag = signal('all');
  readonly feedBetaAreas = signal<readonly FeedBetaArea[]>([]);
  readonly feedBetaCategories = signal<readonly string[]>([]);
  readonly feedBetaScope = signal<FeedBetaScope | null>(null);
  readonly feedBetaScopeDialogOpen = signal(false);

  readonly hasContext = computed(() => this.contextMode() !== 'empty' || !!this.selectedPost());

  selectPost(post: Tag | null): void {
    this.selectedPost.set(post);
    this.contextMode.set(post ? 'post' : 'empty');
    this.rightPanelOpen.set(!!post);
  }

  showContext(mode: ContextPanelMode): void {
    this.contextMode.set(mode);
    this.rightPanelOpen.set(true);
  }

  clearContext(): void {
    this.selectedPost.set(null);
    this.contextMode.set('empty');
  }

  setHomeDistrictOptions(options: HomeDistrictOption[]): void {
    this.homeDistrictOptions.set(options);
    const selected = this.homeDistrict();
    if (selected && options.some((option) => option.key === selected.key)) return;
    if (options[0]) this.homeDistrict.set(options[0]);
  }

  setHomeDistrict(option: HomeDistrictOption): void {
    this.homeDistrict.set(option);
  }

  setHomeTagOptions(options: string[]): void {
    const normalized = Array.from(new Set(options.filter(Boolean))).sort();
    this.homeTagOptions.set(normalized);
    if (this.homeTag() !== 'all' && !normalized.includes(this.homeTag())) {
      this.homeTag.set('all');
    }
  }

  setHomeTag(tag: string): void {
    this.homeTag.set(tag || 'all');
  }
}
