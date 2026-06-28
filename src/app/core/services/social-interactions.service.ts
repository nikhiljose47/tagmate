import { Injectable, signal } from '@angular/core';
import { Tag } from '../models/tag.model';

export interface LocalComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SocialInteractionsService {
  private readonly likedKey = 'tagmate.likedPosts';
  private readonly savedKey = 'tagmate.savedPosts';
  private readonly commentsKey = 'tagmate.comments';
  private readonly hiddenKey = 'tagmate.hiddenPosts';
  private readonly reportedKey = 'tagmate.reportedPosts';

  readonly likedPosts = signal(new Set<string>());
  readonly savedPosts = signal(new Set<string>());
  readonly hiddenPosts = signal(new Set<string>());
  readonly reportedPosts = signal(new Set<string>());
  readonly comments = signal<Record<string, LocalComment[]>>({});

  constructor() {
    this.likedPosts.set(new Set(this.readJson<string[]>(this.likedKey, [])));
    this.savedPosts.set(new Set(this.readJson<string[]>(this.savedKey, [])));
    this.hiddenPosts.set(new Set(this.readJson<string[]>(this.hiddenKey, [])));
    this.reportedPosts.set(new Set(this.readJson<string[]>(this.reportedKey, [])));
    this.comments.set(this.readJson<Record<string, LocalComment[]>>(this.commentsKey, {}));
  }

  postKey(post: Tag): string {
    return post.id ?? `${post.userId}-${post.createdAt}`;
  }

  isLiked(post: Tag): boolean {
    return this.likedPosts().has(this.postKey(post));
  }

  isSaved(post: Tag): boolean {
    return this.savedPosts().has(this.postKey(post));
  }

  isHidden(post: Tag): boolean {
    return this.hiddenPosts().has(this.postKey(post));
  }

  likeCount(post: Tag): number {
    return Math.max(0, post.loves ?? 0) + (this.isLiked(post) ? 1 : 0);
  }

  commentCount(post: Tag): number {
    return (post.comments?.length ?? 0) + this.commentsFor(post).length;
  }

  commentsFor(post: Tag): LocalComment[] {
    return this.comments()[this.postKey(post)] ?? [];
  }

  toggleLike(post: Tag): boolean {
    return this.toggleSet(this.likedPosts, this.postKey(post), this.likedKey);
  }

  toggleSave(post: Tag): boolean {
    return this.toggleSet(this.savedPosts, this.postKey(post), this.savedKey);
  }

  addComment(post: Tag, text: string, author = 'You'): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const key = this.postKey(post);
    const comment: LocalComment = {
      id: `${key}-${Date.now()}`,
      author,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    this.comments.update((current) => {
      const next = { ...current, [key]: [...(current[key] ?? []), comment] };
      this.writeJson(this.commentsKey, next);
      return next;
    });
  }

  reportPost(post: Tag): void {
    const key = this.postKey(post);
    this.addToSet(this.reportedPosts, key, this.reportedKey);
    this.addToSet(this.hiddenPosts, key, this.hiddenKey);
  }

  private toggleSet(
    setSignal: ReturnType<typeof signal<Set<string>>>,
    key: string,
    storageKey: string
  ): boolean {
    let hasKey = false;

    setSignal.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
        hasKey = false;
      } else {
        next.add(key);
        hasKey = true;
      }

      this.writeJson(storageKey, [...next]);
      return next;
    });

    return hasKey;
  }

  private addToSet(
    setSignal: ReturnType<typeof signal<Set<string>>>,
    key: string,
    storageKey: string
  ): void {
    setSignal.update((current) => {
      const next = new Set(current);
      next.add(key);
      this.writeJson(storageKey, [...next]);
      return next;
    });
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeJson<T>(key: string, value: T): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local social state should never block the main posting flow.
    }
  }
}
