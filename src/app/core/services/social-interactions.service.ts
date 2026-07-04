import { Injectable, signal } from '@angular/core';
import { DirectMessage, LocalNotification, Tag, ThreadedComment } from '../models/tag.model';

export type LocalComment = ThreadedComment;

@Injectable({ providedIn: 'root' })
export class SocialInteractionsService {
  private readonly likedKey = 'tagmate.likedPosts';
  private readonly savedKey = 'tagmate.savedPosts';
  private readonly commentsKey = 'tagmate.comments';
  private readonly hiddenKey = 'tagmate.hiddenPosts';
  private readonly reportedKey = 'tagmate.reportedPosts';
  private readonly rsvpsKey = 'tagmate.rsvps';
  private readonly messagesKey = 'tagmate.messages';
  private readonly notificationsKey = 'tagmate.notifications';
  private readonly reputationKey = 'tagmate.reputation';
  private readonly questsKey = 'tagmate.completedQuests';

  readonly likedPosts = signal(new Set<string>());
  readonly savedPosts = signal(new Set<string>());
  readonly hiddenPosts = signal(new Set<string>());
  readonly reportedPosts = signal(new Set<string>());
  readonly comments = signal<Record<string, LocalComment[]>>({});
  readonly rsvps = signal<Record<string, string[]>>({});
  readonly messages = signal<Record<string, DirectMessage[]>>({});
  readonly notifications = signal<LocalNotification[]>([]);
  readonly reputation = signal<Record<string, number>>({});
  readonly pollVotes = signal<Record<string, Record<string, string[]>>>({});
  readonly completedQuests = signal(new Set<string>());

  constructor() {
    this.likedPosts.set(new Set(this.readJson<string[]>(this.likedKey, [])));
    this.savedPosts.set(new Set(this.readJson<string[]>(this.savedKey, [])));
    this.hiddenPosts.set(new Set(this.readJson<string[]>(this.hiddenKey, [])));
    this.reportedPosts.set(new Set(this.readJson<string[]>(this.reportedKey, [])));
    this.comments.set(this.readJson<Record<string, LocalComment[]>>(this.commentsKey, {}));
    this.rsvps.set(this.readJson<Record<string, string[]>>(this.rsvpsKey, {}));
    this.messages.set(this.readJson<Record<string, DirectMessage[]>>(this.messagesKey, {}));
    this.notifications.set(this.readJson<LocalNotification[]>(this.notificationsKey, []));
    this.reputation.set(this.readJson<Record<string, number>>(this.reputationKey, {}));
    this.pollVotes.set(this.readJson<Record<string, Record<string, string[]>>>('tagmate.pollVotes', {}));
    this.completedQuests.set(new Set(this.readJson<string[]>(this.questsKey, [])));
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

  trustScore(username: string): number {
    return this.reputation()[username] ?? 0;
  }

  trustBadge(username: string): string {
    const score = this.trustScore(username);
    if (score >= 50) return 'Trusted';
    if (score >= 20) return 'Helpful';
    if (score >= 8) return 'Rising';
    return 'New';
  }

  commentCount(post: Tag): number {
    return (post.comments?.length ?? 0) + this.commentsFor(post).length;
  }

  commentsFor(post: Tag): LocalComment[] {
    return this.comments()[this.postKey(post)] ?? [];
  }

  topLevelCommentsFor(post: Tag): LocalComment[] {
    return this.commentsFor(post).filter((comment) => !comment.parentId);
  }

  repliesFor(post: Tag, parentId: string): LocalComment[] {
    return this.commentsFor(post).filter((comment) => comment.parentId === parentId);
  }

  toggleLike(post: Tag): boolean {
    const liked = this.toggleSet(this.likedPosts, this.postKey(post), this.likedKey);
    this.bumpReputation(post.username, liked ? 2 : -2);
    if (liked) {
      this.addNotification('love', 'New love', `${post.username || 'A neighbor'} got love on a post.`, this.postKey(post));
      this.completeQuest('love');
    }
    return liked;
  }

  toggleSave(post: Tag): boolean {
    return this.toggleSet(this.savedPosts, this.postKey(post), this.savedKey);
  }

  addComment(post: Tag, text: string, author = 'You', parentId?: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const key = this.postKey(post);
    const mentions = Array.from(trimmed.matchAll(/@([a-z0-9_.-]+)/gi)).map((match) => match[1]);
    const comment: LocalComment = {
      id: `${key}-${Date.now()}`,
      postId: key,
      author,
      text: trimmed,
      createdAt: new Date().toISOString(),
      upvotes: 0,
      mentions,
      parentId,
    };

    this.comments.update((current) => {
      const next = { ...current, [key]: [...(current[key] ?? []), comment] };
      this.writeJson(this.commentsKey, next);
      return next;
    });

    if (author === 'You' || author === 'Guest User') {
      this.completeQuest('comment');
    }

    this.addNotification(
      parentId ? 'reply' : 'reply',
      parentId ? 'New reply' : 'New comment',
      `${author} commented on ${post.highlight || 'a nearby tag'}.`,
      key
    );
  }

  toggleLoveComment(postKey: string, commentId: string): void {
    const state = { ...this.comments() };
    if (!state[postKey]) return;
    const comment = state[postKey].find(c => c.id === commentId);
    if (!comment) return;
    // Toggle logic: For local testing, just increment.
    comment.upvotes++;
    this.comments.set(state);
    this.writeJson(this.commentsKey, state);
  }

  // --- Polls ---

  getPollVotes(postKey: string): Record<string, string[]> {
    return this.pollVotes()[postKey] || {};
  }

  votePoll(postKey: string, optionIndex: number, username: string): void {
    const current = { ...this.pollVotes() };
    if (!current[postKey]) {
      current[postKey] = {};
    }
    
    // Remove user's previous votes on this poll
    for (const key of Object.keys(current[postKey])) {
      current[postKey][key] = current[postKey][key].filter(u => u !== username);
    }
    
    // Add vote
    const optKey = optionIndex.toString();
    if (!current[postKey][optKey]) {
      current[postKey][optKey] = [];
    }
    current[postKey][optKey].push(username);
    
    this.pollVotes.set(current);
    this.writeJson('tagmate.pollVotes', current);

    if (username === 'You' || username === 'Guest User') {
      this.completeQuest('poll');
    }
  }

  hasVotedPoll(postKey: string, optionIndex: number, username: string): boolean {
    const votes = this.getPollVotes(postKey);
    const optKey = optionIndex.toString();
    return !!votes[optKey] && votes[optKey].includes(username);
  }

  totalPollVotes(postKey: string): number {
    const votes = this.getPollVotes(postKey);
    return Object.values(votes).reduce((sum, arr) => sum + arr.length, 0);
  }

  upvoteComment(post: Tag, commentId: string): void {
    const key = this.postKey(post);
    this.comments.update((current) => {
      const next = {
        ...current,
        [key]: (current[key] ?? []).map((comment) =>
          comment.id === commentId ? { ...comment, upvotes: comment.upvotes + 1 } : comment
        ),
      };
      this.writeJson(this.commentsKey, next);
      return next;
    });
  }

  rsvpCount(post: Tag): number {
    return this.rsvps()[this.postKey(post)]?.length ?? 0;
  }

  isRsvped(post: Tag, user = 'You'): boolean {
    return (this.rsvps()[this.postKey(post)] ?? []).includes(user);
  }

  toggleRsvp(post: Tag, user = 'You'): boolean {
    const key = this.postKey(post);
    let attending = false;
    this.rsvps.update((current) => {
      const guests = new Set(current[key] ?? []);
      if (guests.has(user)) {
        guests.delete(user);
        attending = false;
      } else {
        guests.add(user);
        attending = true;
      }
      const next = { ...current, [key]: [...guests] };
      this.writeJson(this.rsvpsKey, next);
      return next;
    });
    if (attending) {
      this.addNotification('rsvp', 'RSVP saved', `You are attending ${post.highlight || 'this event'}.`, key);
      if (user === 'You' || user === 'Guest User') {
        this.completeQuest('rsvp');
      }
    }
    return attending;
  }

  sendMessage(post: Tag, text: string, from = 'You'): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const postId = this.postKey(post);
    const threadId = `${postId}:${post.userId || post.username || 'author'}`;
    const message: DirectMessage = {
      id: `${threadId}-${Date.now()}`,
      threadId,
      postId,
      from,
      to: post.username || 'Neighbor',
      text: trimmed,
      createdAt: new Date().toISOString(),
      read: false,
    };

    this.messages.update((current) => {
      const next = { ...current, [threadId]: [...(current[threadId] ?? []), message] };
      this.writeJson(this.messagesKey, next);
      return next;
    });
    this.addNotification('message', 'Message sent', `Private message sent to ${message.to}.`, postId);
  }

  threadFor(post: Tag): DirectMessage[] {
    const threadId = `${this.postKey(post)}:${post.userId || post.username || 'author'}`;
    return this.messages()[threadId] ?? [];
  }

  unreadNotifications(): number {
    return this.notifications().filter((notification) => !notification.read).length;
  }

  addNotification(
    type: LocalNotification['type'],
    title: string,
    body: string,
    postId?: string
  ): void {
    const notification: LocalNotification = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      title,
      body,
      postId,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.notifications.update((current) => {
      const next = [notification, ...current].slice(0, 25);
      this.writeJson(this.notificationsKey, next);
      return next;
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  requestPushPermission(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    void Notification.requestPermission();
  }

  reportPost(post: Tag): void {
    const key = this.postKey(post);
    this.addToSet(this.reportedPosts, key, this.reportedKey);
    this.addToSet(this.hiddenPosts, key, this.hiddenKey);
  }

  private bumpReputation(username: string | undefined, delta: number): void {
    if (!username) return;
    this.reputation.update((current) => {
      const next = { ...current, [username]: Math.max(0, (current[username] ?? 0) + delta) };
      this.writeJson(this.reputationKey, next);
      return next;
    });
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

  completeQuest(questId: string): boolean {
    let newlyCompleted = false;
    this.completedQuests.update((current) => {
      const next = new Set(current);
      if (!next.has(questId)) {
        next.add(questId);
        newlyCompleted = true;
        this.writeJson(this.questsKey, [...next]);
        this.bumpReputation('You', 5);
        this.bumpReputation('Guest User', 5);
        this.addNotification('love', 'Quest Completed!', `You completed the "${this.questName(questId)}" quest! (+5 Reputation)`, undefined);
      }
      return next;
    });
    return newlyCompleted;
  }

  isQuestCompleted(questId: string): boolean {
    return this.completedQuests().has(questId);
  }

  resetQuests(): void {
    this.completedQuests.set(new Set());
    this.writeJson(this.questsKey, []);
    this.reputation.update((r) => {
      const next = { ...r };
      next['You'] = 0;
      next['Guest User'] = 0;
      this.writeJson(this.reputationKey, next);
      return next;
    });
  }

  private questName(id: string): string {
    const names: Record<string, string> = {
      love: 'Civic Love',
      comment: 'Chatty Neighbor',
      rsvp: 'Active Citizen',
      poll: 'Vocal Resident',
    };
    return names[id] || id;
  }
}
