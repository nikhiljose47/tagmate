import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PostStatus } from '../models/tag.model';
import { SupabaseService } from './supabase.service';

/** Durable confirmation and status-history writes for actionable posts. */
@Injectable({ providedIn: 'root' })
export class PostTrustService {
  private readonly supabase = inject(SupabaseService);

  setConfirmation(postId: string, uid: string, enabled: boolean) {
    const row = { post_id: postId, user_id: uid };
    return (
      enabled
        ? this.supabase.addRow('post_confirmations', row)
        : this.supabase.deleteRowsWhere('post_confirmations', row)
    ) as Observable<unknown>;
  }

  addStatus(postId: string, actorId: string, status: PostStatus, note: string | null) {
    return this.supabase.addRow('post_status_history', {
      post_id: postId,
      actor_id: actorId,
      status,
      note,
    });
  }
}
