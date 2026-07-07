import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserSessionService } from '../../../../core/services/user-session.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { SocialInteractionsService } from '../../../../core/services/social-interactions.service';
import { DirectMessage, Tag } from '../../../../core/models/tag.model';
import { LoggerService } from '../../../../core/services/logger.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';

interface ChatThread {
  threadId: string;
  postId: string;
  otherUid: string;
  otherName: string;
  lastMessage: string;
  lastMessageDate: string;
  unread: boolean;
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
  private readonly supabase = inject(SupabaseService);
  protected readonly social = inject(SocialInteractionsService);
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  threads = signal<ChatThread[]>([]);
  selectedThread = signal<ChatThread | null>(null);
  messageText = signal('');
  isLoading = signal(true);

  // Computes the active thread's messages in real-time from the social service
  activeMessages = computed<DirectMessage[]>(() => {
    const thread = this.selectedThread();
    if (!thread) return [];
    
    // Create a mock post to hook into social service thread hydration
    const mockPost: Tag = {
      id: thread.postId,
      userId: thread.otherUid,
      username: thread.otherName,
      tag: '',
      highlight: '',
      lat: 0,
      lng: 0,
      expiresIn: 0,
      createdAt: '',
      images: [],
    };
    
    return this.social.threadFor(mockPost);
  });

  ngOnInit(): void {
    const currentUser = this.session.user();
    if (!currentUser) {
      this.toast.show('Please log in to view messages.', 'warning');
      void this.router.navigate(['/login']);
      return;
    }

    this.loadInbox(currentUser.uid);
  }

  private async loadInbox(uid: string): Promise<void> {
    try {
      const { data, error } = await firstValueFrom(this.supabase.getDirectMessagesForUser(uid));
      if (error) throw error;

      if (!data || data.length === 0) {
        this.threads.set([]);
        this.isLoading.set(false);
        return;
      }

      // Group by thread_id to get last messages
      const threadMap = new Map<string, typeof data[0]>();
      const otherUids = new Set<string>();

      for (const msg of data) {
        if (!threadMap.has(msg.thread_id)) {
          threadMap.set(msg.thread_id, msg);
        }
        otherUids.add(msg.from_uid === uid ? msg.to_uid : msg.from_uid);
      }

      // Fetch user profile names for other participants
      const userProfiles = new Map<string, string>();
      if (otherUids.size > 0) {
        const { data: users, error: userError } = await firstValueFrom(
          this.supabase.getRowsIn<{ uid: string; name: string }>('users', 'uid', Array.from(otherUids))
        );
        if (!userError && users) {
          for (const u of users) {
            userProfiles.set(u.uid, u.name);
          }
        }
      }

      const parsedThreads: ChatThread[] = [];
      for (const [threadId, lastMsg] of threadMap.entries()) {
        const otherUid = lastMsg.from_uid === uid ? lastMsg.to_uid : lastMsg.from_uid;
        const otherName = userProfiles.get(otherUid) || lastMsg.to_name || 'User';
        const parts = threadId.split(':');
        const postId = parts[0] || '';

        parsedThreads.push({
          threadId,
          postId,
          otherUid,
          otherName,
          lastMessage: lastMsg.text,
          lastMessageDate: lastMsg.created_at,
          unread: !lastMsg.read && lastMsg.to_uid === uid,
        });
      }

      this.threads.set(parsedThreads);
    } catch (err) {
      this.logger.error('Failed to load DM inbox threads', err);
      this.toast.show('Could not load inbox.', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  selectThread(thread: ChatThread): void {
    this.selectedThread.set(thread);
    // Mark as read in local view
    if (thread.unread) {
      thread.unread = false;
      this.threads.update((curr) => [...curr]);
    }
  }

  async sendMessage(): Promise<void> {
    const thread = this.selectedThread();
    const text = this.messageText().trim();
    if (!thread || !text) return;

    const mockPost: Tag = {
      id: thread.postId,
      userId: thread.otherUid,
      username: thread.otherName,
      tag: '',
      highlight: '',
      lat: 0,
      lng: 0,
      expiresIn: 0,
      createdAt: '',
      images: [],
    };

    try {
      this.social.sendMessage(mockPost, text);
      this.messageText.set('');
      
      // Update thread preview
      this.threads.update((curr) => {
        const found = curr.find((t) => t.threadId === thread.threadId);
        if (found) {
          found.lastMessage = text;
          found.lastMessageDate = new Date().toISOString();
        }
        return [...curr].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
      });
    } catch (err) {
      this.logger.error('Failed to send DM reply', err);
    }
  }

  closeThread(): void {
    this.selectedThread.set(null);
  }
}
