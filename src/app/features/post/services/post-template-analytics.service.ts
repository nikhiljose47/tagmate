import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from '../../../core/services/supabase-client.service';
import { UserSessionService } from '../../../core/services/user-session.service';
import { LoggerService } from '../../../core/services/logger.service';

export type TemplateEventType = 'selected' | 'published' | 'draft_saved' | 'scheduled';

export interface TemplateUsageSummaryRow {
  category: string;
  postSubtype: string | null;
  selected: number;
  published: number;
}

/**
 * Lightweight, fire-and-forget usage analytics for business post templates
 * (Step 5.B) — answers "which templates are selected vs. actually lead to a
 * published post, per business category" without duplicating anything
 * already stored on `public.tags`.
 *
 * Every record* method is deliberately non-blocking: analytics failure must
 * never stop the composer from saving a draft, scheduling, or publishing.
 */
@Injectable({ providedIn: 'root' })
export class PostTemplateAnalyticsService {
  private readonly client = inject(SupabaseClientService).client;
  private readonly userSession = inject(UserSessionService);
  private readonly logger = inject(LoggerService);

  recordTemplateSelected(
    category: string,
    postSubtype: string | undefined,
    templateVersion: number | undefined,
  ): void {
    this.record('selected', category, postSubtype, templateVersion);
  }

  recordPublished(
    category: string,
    postSubtype: string | undefined,
    templateVersion: number | undefined,
    postId: string | undefined,
  ): void {
    this.record('published', category, postSubtype, templateVersion, postId);
  }

  recordDraftSaved(
    category: string,
    postSubtype: string | undefined,
    templateVersion: number | undefined,
    postId: string | undefined,
  ): void {
    this.record('draft_saved', category, postSubtype, templateVersion, postId);
  }

  recordScheduled(
    category: string,
    postSubtype: string | undefined,
    templateVersion: number | undefined,
    postId: string | undefined,
  ): void {
    this.record('scheduled', category, postSubtype, templateVersion, postId);
  }

  private record(
    eventType: TemplateEventType,
    category: string,
    postSubtype: string | undefined | null,
    templateVersion: number | undefined | null,
    postId?: string,
  ): void {
    const userId = this.userSession.user()?.uid;
    // No session, or not a business-template post (no category) — nothing useful to record.
    if (!userId || !category) return;

    void this.client
      .from('post_template_events')
      .insert({
        user_id: userId,
        category,
        post_subtype: postSubtype ?? null,
        template_version: templateVersion ?? null,
        event_type: eventType,
        post_id: postId ?? null,
      })
      .then(({ error }) => {
        if (error) this.logger.error('Template analytics event failed to record', error);
      });
  }

  /**
   * Small aggregate helper (not wired into any UI — no admin template section
   * exists yet). Requires an admin-role session; returns [] otherwise (RLS
   * denies the read rather than throwing). Counts "selected" vs "published"
   * per category+subtype — the two numbers product decisions actually need.
   */
  async getUsageSummary(): Promise<TemplateUsageSummaryRow[]> {
    const { data, error } = await this.client
      .from('post_template_events')
      .select('category, post_subtype, event_type');
    if (error || !data) {
      if (error) this.logger.error('Failed to load template usage summary', error);
      return [];
    }

    const byKey = new Map<string, TemplateUsageSummaryRow>();
    for (const row of data) {
      const key = `${row.category}::${row.post_subtype ?? ''}`;
      const entry = byKey.get(key) ?? {
        category: row.category,
        postSubtype: row.post_subtype,
        selected: 0,
        published: 0,
      };
      if (row.event_type === 'selected') entry.selected++;
      if (row.event_type === 'published') entry.published++;
      byKey.set(key, entry);
    }
    return [...byKey.values()];
  }
}
