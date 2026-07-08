import { Injectable, computed, signal } from '@angular/core';
import { Tag } from '../../core/models/tag.model';

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
}
