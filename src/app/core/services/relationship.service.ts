import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TagRow } from './tag.mapper';
import { UserRow } from './social.mapper';

/** Typed boundary for follows, blocks, muted threads, profiles, and following feeds. */
@Injectable({ providedIn: 'root' })
export class RelationshipService {
  private readonly supabase = inject(SupabaseService);

  getProfile(uid: string) {
    return this.supabase.getUserById(uid);
  }

  searchProfiles(
    query: string,
    limit: number,
  ): Observable<{
    data: UserRow[] | null;
    error: unknown;
  }> {
    return this.supabase.searchUsers(query, limit);
  }

  updateProfile(uid: string, name: string, bio: string, updatedAt: string) {
    return this.supabase.updateRowsWhere('users', { uid }, { name, bio, updated_at: updatedAt });
  }

  setFollow(
    table: 'user_follows' | 'user_followed_hoods' | 'user_followed_topics',
    row: Record<string, unknown>,
    enabled: boolean,
  ) {
    return enabled ? this.supabase.addRow(table, row) : this.supabase.deleteRowsWhere(table, row);
  }

  setBlock(blockerId: string, blockedId: string, enabled: boolean) {
    const row = { blocker_id: blockerId, blocked_id: blockedId };
    return enabled
      ? this.supabase.addRow('user_blocks', row)
      : this.supabase.deleteRowsWhere('user_blocks', row);
  }

  setThreadMuted(uid: string, threadId: string, enabled: boolean) {
    const row = { user_id: uid, thread_id: threadId };
    return enabled
      ? this.supabase.addRow('muted_threads', row)
      : this.supabase.deleteRowsWhere('muted_threads', row);
  }

  followingFeed(limit: number, offset: number, query: string) {
    return this.supabase.callRpc<TagRow[]>('fetch_following_feed', {
      page_limit: limit,
      page_offset: offset,
      query: query || null,
    });
  }

  reportUser(reportedUserId: string, reporterId: string, reason: string) {
    return this.supabase.addRow('user_reports', {
      reported_user_id: reportedUserId,
      reporter_id: reporterId,
      reason,
    });
  }
}
