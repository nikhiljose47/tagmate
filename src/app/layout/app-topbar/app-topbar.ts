import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppTheme, ThemeService } from '../../core/services/theme.service';
import { UserSessionService } from '../../core/services/user-session.service';
import { TAG_REPOSITORY } from '../../core/repositories/repository.tokens';
import { Tag } from '../../core/models/tag.model';
import { CommandResult, WorkspaceStateService } from '../workspace/workspace-state.service';
import { SocialInteractionsService } from '../../core/services/social-interactions.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './app-topbar.html',
  styleUrl: './app-topbar.scss',
})
export class AppTopbarComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly tagRepo = inject(TAG_REPOSITORY, { optional: true });
  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(UserSessionService);
  protected readonly social = inject(SocialInteractionsService);
  protected readonly workspace = inject(WorkspaceStateService);

  protected readonly query = signal('');
  protected readonly results = signal<CommandResult[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly userMenuOpen = signal(false);

  protected readonly themes: { key: AppTheme; label: string; icon: string }[] = [
    { key: 'light', label: 'Light', icon: 'bi-sun-fill' },
    { key: 'dark', label: 'Dark', icon: 'bi-moon-fill' },
    { key: 'midnight', label: 'Midnight', icon: 'bi-moon-stars-fill' },
    { key: 'forest', label: 'Forest', icon: 'bi-tree-fill' },
    { key: 'sepia', label: 'Sepia', icon: 'bi-cup-hot-fill' },
  ];

  private searchTimeout?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
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

  protected async goTo(result: CommandResult): Promise<void> {
    this.closeCommand();
    this.query.set('');
    this.results.set([]);
    await this.router.navigate(result.route);
  }

  protected setTheme(theme: AppTheme): void {
    this.theme.setTheme(theme);
    this.userMenuOpen.set(false);
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
    this.userMenuOpen.set(false);
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
        this.results.set([...this.quickActions(query), ...posts.map((post) => this.toCommandResult(post))]);
        this.isSearching.set(false);
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
}
