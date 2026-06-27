import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { Tag } from '../../models/tag.model';
import { Observable, of } from 'rxjs';
import { TagRow, rowToTag } from '../../services/tag.mapper';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { SharedStateService } from '../../services/shared-state.service';

type ProfileTab = 'posts' | 'saved' | 'settings';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private shared = inject(SharedStateService);
  readonly user$ = this.auth.user$;

  myTags$: Observable<Tag[]> | null = null;
  isLoading = true;
  activeTab = signal<ProfileTab>('posts');
  editMode = signal(false);

  private readonly TAG_COLORS: Record<string, [string, string]> = {
    news: ['#3b82f6', '#1d4ed8'], weather: ['#06b6d4', '#0284c7'],
    food: ['#f97316', '#c2410c'], event: ['#8b5cf6', '#6d28d9'],
    alert: ['#ef4444', '#b91c1c'], fitness: ['#22c55e', '#15803d'],
    shopping: ['#ec4899', '#be185d'], business: ['#6366f1', '#4338ca'],
    tech: ['#14b8a6', '#0f766e'], health: ['#84cc16', '#4d7c0f'],
    art: ['#f59e0b', '#b45309'], sports: ['#0ea5e9', '#0369a1'],
    environment: ['#10b981', '#065f46'], traffic: ['#fb923c', '#c2410c'],
  };

  private readonly TAG_EMOJIS: Record<string, string> = {
    news: '📰', weather: '⛅', food: '🍜', event: '🎉', alert: '⚠️',
    fitness: '💪', shopping: '🛍️', business: '🏢', tech: '💻',
    health: '🏥', art: '🎨', sports: '⚽', environment: '🌿', traffic: '🚦',
  };

  private readonly AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
    '#22c55e', '#06b6d4', '#f59e0b', '#3b82f6',
  ];

  private readonly COVER_GRADIENTS = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #fd7543, #f7ba2a)',
    'linear-gradient(135deg, #30cfd0, #667eea)',
  ];

  ngOnInit() {
    this.auth.user$.subscribe((user) => {
      if (user.isGuest) {
        this.myTags$ = of([]);
        this.isLoading = false;
        return;
      }
      this.supabase
        .getRows<TagRow>('tags', { field: 'user_id', op: '==', value: user.uid })
        .subscribe(({ data }) => {
          this.myTags$ = of((data ?? []).map(rowToTag));
          this.isLoading = false;
        });
    });
  }

  coverGradient(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return this.COVER_GRADIENTS[Math.abs(hash) % this.COVER_GRADIENTS.length];
  }

  avatarBg(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  tagGradient(tag: string): string {
    const [from, to] = this.TAG_COLORS[tag] ?? ['#6366f1', '#4f46e5'];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  tagEmoji(tag: string): string {
    return this.TAG_EMOJIS[tag] ?? '📌';
  }

  deleteTag(id: string | undefined) {
    if (!id) return;
    if (confirm('Are you sure you want to delete this post?')) {
      this.supabase.deleteRow('tags', id).subscribe();
      this.toast.show('Post deleted.', 'success');
    }
  }

  setTab(tab: ProfileTab): void { this.activeTab.set(tab); }
  toggleEditProfile(): void { this.editMode.update((v) => !v); }

  saveProfile(): void {
    this.editMode.set(false);
    this.toast.show('Profile saved.', 'success');
  }

  viewOnMap(tag: Tag): void {
    this.shared.updateCoordinates(tag.lat, tag.lng);
    this.shared.updateText(tag.highlight || tag.hoodId || 'Selected post');
    void this.router.navigate(['/hood']);
  }

  editPost(tag: Tag): void {
    this.toast.show(`Editing "${tag.highlight || 'this post'}" is coming soon.`, 'info');
  }

  saveSettings(): void { this.toast.show('Settings saved.', 'success'); }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      this.toast.show('Logged out.', 'success');
      await this.router.navigate(['/login']);
    } catch {
      this.toast.show('Could not log out. Please try again.', 'danger');
    }
  }
}
