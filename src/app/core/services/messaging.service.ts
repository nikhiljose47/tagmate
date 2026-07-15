import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CreateDirectMessageInput {
  thread_id: string;
  post_id: string | null;
  from_uid: string;
  to_uid: string;
  to_name: string;
  text: string;
  read: boolean;
}

/** Database operations for direct messages, hood chat, read state, and reports. */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly supabase = inject(SupabaseService);

  sendDirectMessage(input: CreateDirectMessageInput) {
    return this.supabase.addRow('direct_messages', { ...input });
  }

  sendHoodMessage(input: { hood_id: string; user_id: string; username: string; text: string }) {
    return this.supabase.addRow('hood_messages', input);
  }

  markThreadRead(threadId: string, uid: string, readAt: string) {
    return this.supabase.updateRowsWhere(
      'direct_messages',
      { thread_id: threadId, to_uid: uid },
      { read: true, read_at: readAt },
    );
  }

  report(messageId: string, reporterId: string, reason = 'reported') {
    return this.supabase.addRow('message_reports', {
      message_id: messageId,
      reporter_id: reporterId,
      reason,
    });
  }
}
