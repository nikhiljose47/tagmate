import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppTheme, ThemeService } from '../../core/services/theme.service';
import { UserSessionService } from '../../core/services/user-session.service';
import { TAG_REPOSITORY } from '../../core/repositories/repository.tokens';
import { Tag } from '../../core/models/tag.model';
import {
  CommandResult,
  FeedBetaArea,
  WorkspaceStateService,
} from '../workspace/workspace-state.service';
import { SocialInteractionsService } from '../../core/services/social-interactions.service';
import { SocialPlatformService } from '../../core/services/social-platform.service';
import { SocialProfile } from '../../core/models/social.model';
import { TagEmojiPipe } from '../../shared/pipes/tag-emoji.pipe';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TagEmojiPipe],
  templateUrl: './app-topbar.html',
  styleUrl: './app-topbar.scss',
})
export class AppTopbarComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY, { optional: true });
  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(UserSessionService);
  protected readonly social = inject(SocialInteractionsService);
  private readonly platform = inject(SocialPlatformService);
  private readonly toast = inject(ToastService);
  protected readonly workspace = inject(WorkspaceStateService);

  protected readonly query = signal('');
  protected readonly results = signal<CommandResult[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly hideSearch = signal(this.isFeedBetaUrl(this.router.url));
  protected readonly draftAreaId = signal('');
  protected readonly draftCategory = signal('');

  protected readonly allThemes: { key: AppTheme; label: string; icon: string }[] = [
    { key: 'light', label: 'Light', icon: 'bi-sun-fill' },
    { key: 'dark', label: 'Dark', icon: 'bi-moon-fill' },
    { key: 'midnight', label: 'Midnight', icon: 'bi-moon-stars-fill' },
    { key: 'forest', label: 'Forest', icon: 'bi-tree-fill' },
    { key: 'sepia', label: 'Sepia', icon: 'bi-cup-hot-fill' },
  ];

  protected readonly visibleThemes = computed(() => {
    const valid = this.theme.availableThemes();
    return this.allThemes.filter((t) => valid.includes(t.key));
  });

  protected readonly draftCategories = computed(() => {
    const area = this.workspace.feedBetaAreas().find((item) => item.id === this.draftAreaId());
    return area?.categories ?? this.workspace.feedBetaCategories();
  });

  protected get themes() {
    return this.visibleThemes();
  }

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private readonly routerEvents: Subscription;

  constructor() {
    this.routerEvents = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      this.hideSearch.set(this.isFeedBetaUrl(event.urlAfterRedirects));
      if (this.hideSearch()) this.closeCommand();
    });
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.routerEvents.unsubscribe();
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.results.set(this.quickActions());
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.searchTimeout = setTimeout(() => this.searchPosts(trimmed), 250);
  }

  protected openCommand(): void {
    this.workspace.commandOpen.set(true);
    if (!this.query().trim()) this.results.set(this.quickActions());
  }

  protected closeCommand(): void {
    this.workspace.commandOpen.set(false);
  }

  protected openFeedScopeDialog(): void {
    const scope = this.workspace.feedBetaScope();
    const firstArea = this.workspace.feedBetaAreas()[0];
    const areaId = scope?.areaId ?? firstArea?.id ?? '';
    this.draftAreaId.set(areaId);
    this.draftCategory.set(scope?.category ?? this.categoryOptionsFor(areaId)[0] ?? '');
    this.workspace.feedBetaScopeDialogOpen.set(true);
    this.userMenuOpen.set(false);
  }

  protected closeFeedScopeDialog(): void {
    this.workspace.feedBetaScopeDialogOpen.set(false);
  }

  protected onDraftAreaChange(areaId: string): void {
    this.draftAreaId.set(areaId);
    const categories = this.categoryOptionsFor(areaId);
    if (!categories.includes(this.draftCategory())) {
      this.draftCategory.set(categories[0] ?? '');
    }
  }

  protected applyFeedScope(): void {
    const area = this.workspace.feedBetaAreas().find((item) => item.id === this.draftAreaId());
    if (!area) return;
    const category = this.categoryOptionsFor(area.id).includes(this.draftCategory())
      ? this.draftCategory()
      : (area.categories[0] ?? '');

    if (!category) return;

    this.workspace.feedBetaScope.set({
      areaId: area.id,
      location: area.label,
      country: area.country,
      hood: area.hood,
      category,
    });
    this.toast.show(`Feed set to ${area.label} - ${this.categoryLabel(category)}.`, 'success');
    this.closeFeedScopeDialog();
  }

  protected categoryLabel(category: string): string {
    return category.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  @HostListener('document:keydown.escape')
  protected closeFeedScopeOnEscape(): void {
    if (this.workspace.feedBetaScopeDialogOpen()) this.closeFeedScopeDialog();
  }

  protected async goTo(result: CommandResult): Promise<void> {
    this.closeCommand();
    this.query.set('');
    this.results.set([]);
    if (result.id.startsWith('topic-'))
      await this.router.navigate(['/feed'], { queryParams: { topic: result.title.slice(1) } });
    else await this.router.navigate(result.route);
  }

  protected setTheme(theme: AppTheme): void {
    this.theme.setTheme(theme);
    this.userMenuOpen.set(false);
    this.toast.show('Theme updated.', 'success');
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    this.userMenuOpen.set(false);
    this.toast.show('Logged out.', 'success');
    await this.router.navigate(['/login']);
  }

  private searchPosts(query: string): void {
    if (!this.tagRepo) {
      this.results.set(this.quickActions());
      this.isSearching.set(false);
      return;
    }

    this.tagRepo.getPaginated(6, 0, query).subscribe({
      next: (posts) => {
        void this.platform.searchProfiles(query, 5).then((profiles) => {
          const hoods = Array.from(
            new Set(posts.map((post) => post.hoodId).filter((hood): hood is string => !!hood)),
          ).slice(0, 3);
          const topics = Array.from(new Set(posts.map((post) => post.tag).filter(Boolean))).slice(
            0,
            3,
          );
          this.results.set([
            ...this.quickActions(query),
            ...profiles.map((profile) => this.toProfileResult(profile)),
            ...hoods.map((hood) => ({
              id: `hood-${hood}`,
              title: hood,
              subtitle: 'Neighborhood',
              route: ['/neighborhood', this.slug(hood)],
              icon: 'bi-geo-alt',
            })),
            ...topics.map((tag) => ({
              id: `topic-${tag}`,
              title: `#${tag}`,
              subtitle: 'Topic',
              route: ['/feed'],
              icon: 'bi-hash',
            })),
            ...posts.map((post) => this.toCommandResult(post)),
          ]);
          this.isSearching.set(false);
        });
      },
      error: () => {
        this.results.set(this.quickActions(query));
        this.isSearching.set(false);
      },
    });
  }

  private quickActions(query = ''): CommandResult[] {
    const suffix = query ? ` for "${query}"` : '';
    return [
      {
        id: 'qa-feed',
        title: `Search Feed${suffix}`,
        subtitle: 'Scan nearby posts and neighborhood updates',
        route: ['/feed'],
        icon: 'bi-list-ul',
      },
      {
        id: 'qa-map',
        title: 'Open Map Workspace',
        subtitle: 'View tags, heatmaps, filters, and local context',
        route: ['/hood'],
        icon: 'bi-map',
      },
      {
        id: 'qa-report',
        title: 'Review Reports',
        subtitle: 'Open moderation queue and hidden content',
        route: ['/reports'],
        icon: 'bi-flag',
      },
    ];
  }

  private toCommandResult(post: Tag): CommandResult {
    const id = post.id ?? `${post.userId}-${post.createdAt}`;
    return {
      id,
      title: post.highlight || 'Untitled post',
      subtitle: `${post.hoodId || 'Nearby'} - #${post.tag || 'tag'} - ${post.username || 'Anonymous'}`,
      route: ['/posts', id],
      icon: post.tag === 'alert' ? 'bi-exclamation-triangle' : 'bi-geo-alt',
    };
  }

  private toProfileResult(profile: SocialProfile): CommandResult {
    return {
      id: `user-${profile.uid}`,
      title: profile.name,
      subtitle: `${profile.reputation} reputation · Neighbor profile`,
      route: ['/users', profile.uid],
      icon: 'bi-person',
    };
  }

  private slug(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'nearby'
    );
  }

  private isFeedBetaUrl(url: string): boolean {
    return url.split('?')[0].split('#')[0] === '/feed-beta';
  }

  private categoryOptionsFor(areaId: string): readonly string[] {
    return (
      this.workspace.feedBetaAreas().find((item: FeedBetaArea) => item.id === areaId)?.categories ??
      this.workspace.feedBetaCategories()
    );
  }

}
