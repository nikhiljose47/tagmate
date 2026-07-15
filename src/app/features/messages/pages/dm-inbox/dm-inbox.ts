import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, filter } from 'rxjs';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { SocialDataService } from '../../../../core/services/social-data.service';
import { TagDataService } from '../../../../core/services/tag-data.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { DirectMessage, Tag } from '../../../../core/models/tag.model';
import { LoggerService } from '../../../../core/services/logger.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { SocialPlatformService } from '../../../../core/services/social-platform.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TagRow } from '../../../../core/services/tag.mapper';

interface ChatThread {
  threadId: string;
  postId: string;
  otherUid: string;
  otherName: string;
  lastMessage: string;
  lastMessageDate: string;
  unread: boolean;
  postPreview?: string;
}

@Component({
  selector: 'app-dm-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe, RouterLink],
  templateUrl: './dm-inbox.html',
  styleUrls: ['./dm-inbox.scss'],
})
export class DmInboxComponent implements OnInit {
  private readonly session = inject(UserSessionService);
  private readonly socialData = inject(SocialDataService);
  private readonly tagData = inject(TagDataService);
  protected readonly social = inject(SocialInteractionsService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly platform = inject(SocialPlatformService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  threads = signal<ChatThread[]>([]);
  selectedThread = signal<ChatThread | null>(null);
  messageText = signal('');
  searchText = signal('');
  isLoading = signal(true);
  filteredThreads = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    return query
      ? this.threads().filter((thread) =>
          `${thread.otherName} ${thread.lastMessage} ${thread.postPreview ?? ''}`
            .toLowerCase()
            .includes(query),
        )
      : this.threads();
  });

  // Computes the active thread's messages in real-time from the social service
  activeMessages = computed<DirectMessage[]>(() => {
    const thread = this.selectedThread();
    if (!thread) return [];

    return this.social.threadById(thread.threadId);
  });

  constructor() {
    toObservable(this.session.user)
      .pipe(
        filter((user): user is NonNullable<typeof user> => !!user),
        takeUntilDestroyed(),
      )
      .subscribe((user) => {
        this.loadInbox(user.uid);
      });
  }

  ngOnInit(): void {}

  private async loadInbox(uid: string): Promise<void> {
    try {
      const { data, error } = await firstValueFrom(this.socialData.getDirectMessagesForUser(uid));
      if (error) throw error;

      if (!data || data.length === 0) {
        this.threads.set([]);
        this.isLoading.set(false);
        return;
      }

      // Group by thread_id to get last messages
      const threadMap = new Map<string, (typeof data)[0]>();
      const otherUids = new Set<string>();
      const unreadByThread = new Map<string, boolean>();

      for (const msg of data) {
        if (!threadMap.has(msg.thread_id)) {
          threadMap.set(msg.thread_id, msg);
        }
        if (!msg.read && msg.to_uid === uid) unreadByThread.set(msg.thread_id, true);
        otherUids.add(msg.from_uid === uid ? msg.to_uid : msg.from_uid);
      }

      // Fetch user profile names for other participants
      const userProfiles = new Map<string, string>();
      if (otherUids.size > 0) {
        const { data: users, error: userError } = await firstValueFrom(
          this.tagData.getRowsIn<{ uid: string; name: string }>(
            'users',
            'uid',
            Array.from(otherUids),
          ),
        );
        if (!userError && users) {
          for (const u of users) {
            userProfiles.set(u.uid, u.name);
          }
        }
      }

      const postPreviews = new Map<string, string>();
      const postIds = Array.from(
        new Set(data.map((message) => message.post_id).filter((id): id is string => !!id)),
      );
      if (postIds.length) {
        const { data: posts } = await firstValueFrom(
          this.tagData.getRowsIn<TagRow>('tags', 'id', postIds),
        );
        for (const post of posts ?? [])
          if (post.id) postPreviews.set(post.id, post.highlight || `#${post.tag}`);
      }

      const parsedThreads: ChatThread[] = [];
      for (const [threadId, lastMsg] of threadMap.entries()) {
        const otherUid = lastMsg.from_uid === uid ? lastMsg.to_uid : lastMsg.from_uid;
        const otherName = userProfiles.get(otherUid) || lastMsg.to_name || 'User';
        const parts = threadId.split(':');
        const postId = threadId.startsWith('profile:') ? '' : lastMsg.post_id || parts[0] || '';

        parsedThreads.push({
          threadId,
          postId,
          otherUid,
          otherName,
          lastMessage: lastMsg.text,
          lastMessageDate: lastMsg.created_at,
          unread: unreadByThread.get(threadId) ?? false,
          postPreview: postId ? postPreviews.get(postId) : undefined,
        });
      }

      this.threads.set(
        parsedThreads
          .filter((thread) => !this.platform.isBlocked(thread.otherUid))
          .sort((a, b) => b.lastMessageDate.localeCompare(a.lastMessageDate)),
      );
      this.openRequestedThread(uid);
    } catch (err) {
      this.logger.error('Failed to load DM inbox threads', err);
      this.toast.show('Could not load inbox.', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async selectThread(thread: ChatThread): Promise<void> {
    this.selectedThread.set(thread);
    if (thread.unread) {
      thread.unread = false;
      this.threads.update((curr) => [...curr]);
      this.social.markThreadReadLocal(thread.threadId);
      try {
        await this.platform.markThreadRead(thread.threadId);
      } catch (error) {
        this.logger.warn('Could not persist conversation read state', error);
      }
    }
  }

  async sendMessage(): Promise<void> {
    const thread = this.selectedThread();
    const text = this.messageText().trim();
    if (!thread || !text) return;

    try {
      this.social.sendMessageToUser(
        thread.otherUid,
        thread.otherName,
        text,
        thread.postId || undefined,
        'You',
        thread.threadId,
      );
      this.messageText.set('');

      // Update thread preview
      this.threads.update((curr) => {
        const found = curr.find((t) => t.threadId === thread.threadId);
        if (found) {
          found.lastMessage = text;
          found.lastMessageDate = new Date().toISOString();
        }
        return [...curr].sort(
          (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime(),
        );
      });
    } catch (err) {
      this.logger.error('Failed to send DM reply', err);
    }
  }

  closeThread(): void {
    this.selectedThread.set(null);
  }

  async toggleMute(): Promise<void> {
    const thread = this.selectedThread();
    if (!thread) return;
    const muted = await this.platform.toggleThreadMute(thread.threadId);
    this.toast.show(muted ? 'Conversation muted.' : 'Conversation unmuted.', 'success');
  }

  async blockParticipant(): Promise<void> {
    const thread = this.selectedThread();
    if (!thread) return;
    const confirmed = await this.confirmDialog.confirm({
      title: `Block ${thread.otherName}?`,
      message: 'Their content will be hidden and further contact will be prevented.',
      confirmText: 'Block',
      danger: true,
    });
    if (confirmed && (await this.platform.blockUser(thread.otherUid))) {
      this.threads.update((items) => items.filter((item) => item.otherUid !== thread.otherUid));
      this.selectedThread.set(null);
      this.toast.show(`${thread.otherName} blocked.`, 'warning');
    }
  }

  async reportConversation(): Promise<void> {
    const messages = this.activeMessages();
    const incoming = [...messages]
      .reverse()
      .find((message) => message.fromUid !== this.platform.myUid());
    if (!incoming) {
      this.toast.show('There is no incoming message to report.', 'info');
      return;
    }
    await this.platform.reportMessage(incoming.id);
  }

  private openRequestedThread(uid: string): void {
    const requestedThread = this.route.snapshot.queryParamMap.get('thread');
    const requestedUser = this.route.snapshot.queryParamMap.get('user');
    const requestedName = this.route.snapshot.queryParamMap.get('name') || 'Neighbor';
    if (requestedThread) {
      const found = this.threads().find((thread) => thread.threadId === requestedThread);
      if (found) void this.selectThread(found);
    } else if (requestedUser && requestedUser !== uid && !this.platform.isBlocked(requestedUser)) {
      const threadId = `profile:${[uid, requestedUser].sort().join(':')}`;
      const existing = this.threads().find((thread) => thread.threadId === threadId);
      const thread = existing ?? {
        threadId,
        postId: '',
        otherUid: requestedUser,
        otherName: requestedName,
        lastMessage: 'Start a conversation',
        lastMessageDate: new Date().toISOString(),
        unread: false,
      };
      if (!existing) this.threads.update((items) => [thread, ...items]);
      void this.selectThread(thread);
    }
  }
}
