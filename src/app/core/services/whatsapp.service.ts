import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
  WhatsAppConversationRow,
  WhatsAppMessageRow,
  rowToWhatsAppConversation,
  rowToWhatsAppMessage,
} from './social.mapper';
import { WhatsAppConversation, WhatsAppMessage } from '../models/whatsapp.model';

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  /** Rendered preview text where Meta returns simple text components. */
  preview: string;
  /** Raw body text with `{{1}}`-style placeholders still in it. */
  bodyText: string;
  /** Number of positional variables the body requires (0 for none). */
  variableCount: number;
  /** Meta-supplied sample values for those variables, if any — used to hint
   *  the input fields instead of showing bare "{{1}}". */
  exampleValues: string[];
}

/**
 * Client-side layer for the WhatsApp inbox. Reads (`whatsapp_conversations`/
 * `whatsapp_messages`) go straight to Supabase — RLS already scopes every row
 * to the authenticated business (see the whatsapp-integration migration).
 * Every write (send, retry, mark-read, templates) goes through the backend,
 * which resolves the business's phone number ID server-side — the frontend
 * never chooses or sees a Meta phone number ID directly.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppService {
  private readonly supabase = inject(SupabaseService);

  getConversations(): Observable<WhatsAppConversation[]> {
    return this.supabase
      .getRows<WhatsAppConversationRow>('whatsapp_conversations')
      .pipe(map(({ data }) => (data ?? []).map(rowToWhatsAppConversation)));
  }

  /** Most recent `limit` messages, oldest-first for rendering. Pass `before`
   *  (an ISO timestamp) to page further back in history. */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string,
  ): Promise<WhatsAppMessage[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    const response = await this.authorizedFetch(
      `/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages?${params}`,
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not load messages.');
    }
    const rows = (await response.json()) as WhatsAppMessageRow[];
    return rows.map(rowToWhatsAppMessage).reverse();
  }

  async sendMessage(conversationId: string, text: string): Promise<WhatsAppMessage> {
    return this.postMessage(conversationId, { text });
  }

  /** Sends an approved template — the only way to message a customer outside
   *  Meta's 24-hour customer service window. `parameters` fills the body's
   *  `{{1}}`-style placeholders in order; omit/leave empty for a template
   *  with no variables. */
  async sendTemplate(
    conversationId: string,
    template: { name: string; language: string; parameters?: string[] },
  ): Promise<WhatsAppMessage> {
    return this.postMessage(conversationId, { template });
  }

  private async postMessage(
    conversationId: string,
    body:
      | { text: string }
      | { template: { name: string; language: string; parameters?: string[] } },
  ): Promise<WhatsAppMessage> {
    const response = await this.authorizedFetch(
      `/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorBody.error || 'Could not send this message.');
    }
    return rowToWhatsAppMessage(await response.json());
  }

  async retryMessage(messageId: string): Promise<void> {
    const response = await this.authorizedFetch(
      `/api/whatsapp/messages/${encodeURIComponent(messageId)}/retry`,
      { method: 'POST' },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not retry this message.');
    }
  }

  async markRead(conversationId: string): Promise<void> {
    await this.authorizedFetch(
      `/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/read`,
      { method: 'POST' },
    );
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    const response = await this.authorizedFetch('/api/whatsapp/templates');
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not load message templates.');
    }
    return response.json();
  }

  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.supabase.getAccessToken();
    if (!token) throw new Error('You must be signed in.');
    return fetch(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  }
}
