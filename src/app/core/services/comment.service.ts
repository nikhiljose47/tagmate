import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CreateCommentInput {
  post_id: string | undefined;
  parent_id: string | null;
  author_uid: string;
  author_name: string;
  text: string;
  mentions: string[];
}

/** Database operations for comments, reactions, and comment reports. */
@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly supabase = inject(SupabaseService);

  create(input: CreateCommentInput) {
    return this.supabase.addRow('post_comments', { ...input });
  }

  update(commentId: string, text: string, updatedAt: string) {
    return this.supabase.updateRow('post_comments', commentId, { text, updated_at: updatedAt });
  }

  softDelete(commentId: string, deletedAt: string) {
    return this.supabase.updateRow('post_comments', commentId, {
      text: '',
      deleted_at: deletedAt,
      updated_at: deletedAt,
    });
  }

  setReaction(commentId: string, uid: string, enabled: boolean) {
    return enabled
      ? this.supabase.addRow('post_comment_reactions', { comment_id: commentId, user_id: uid })
      : this.supabase.deleteRowsWhere('post_comment_reactions', { comment_id: commentId, user_id: uid });
  }

  report(commentId: string, reporterId: string, reason = 'reported') {
    return this.supabase.addRow('comment_reports', {
      comment_id: commentId,
      reporter_id: reporterId,
      reason,
    });
  }
}
