import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { BusinessIntegrationRow, rowToBusinessIntegration } from './social.mapper';
import { BusinessIntegration, ConnectionSummary } from '../models/business-integration.model';
import { IntegrationProvider, IntegrationStatus } from '../enums/integration.enum';

/**
 * Read/self-service layer for a business's third-party connections
 * (Instagram, WhatsApp, ...). Deliberately thin: creating or repairing a
 * connection (`upsertIntegration`/`updateIntegrationStatus`, in the Step 1
 * spec) requires the service-role key and only ever happens server-side once
 * real OAuth exists (Steps 2/3) — see functions/api/business/_crypto.js for
 * the encryption helper those endpoints will use. Everything here reads from
 * `my_business_integrations`, a view that already scopes rows to the caller
 * and excludes token columns entirely, so business isolation and credential
 * safety are enforced by Postgres, not by this class.
 */
@Injectable({ providedIn: 'root' })
export class BusinessIntegrationService {
  private readonly supabase = inject(SupabaseService);

  /** All of the current business's connections (however many providers they've connected). */
  getBusinessIntegrations(): Observable<BusinessIntegration[]> {
    return this.supabase
      .getRows<BusinessIntegrationRow>('my_business_integrations')
      .pipe(map(({ data }) => (data ?? []).map(rowToBusinessIntegration)));
  }

  /** One provider's connection, or `null` if never connected. */
  getIntegration(provider: IntegrationProvider): Observable<BusinessIntegration | null> {
    return this.getBusinessIntegrations().pipe(
      map((rows) => rows.find((r) => r.provider === provider) ?? null),
    );
  }

  /** Every known provider as a UI-ready summary, synthesizing "not connected" for gaps. */
  getConnectionSummaries(): Observable<ConnectionSummary[]> {
    return this.getBusinessIntegrations().pipe(
      map((rows) => {
        const byProvider = new Map(rows.map((r) => [r.provider, r]));
        return Object.values(IntegrationProvider).map((provider) => {
          const row = byProvider.get(provider);
          return {
            provider,
            connected: row?.status === IntegrationStatus.Connected,
            status: row?.status ?? IntegrationStatus.Disconnected,
            accountName: row?.providerAccountName ?? null,
            metadata: row?.metadata ?? {},
          } satisfies ConnectionSummary;
        });
      }),
    );
  }

  /** Self-service disconnect — the only write this role is allowed to make
   *  (enforced by the "owner can disconnect own integration" RLS policy,
   *  which rejects any status other than 'disconnected'). */
  disconnectIntegration(userId: string, provider: IntegrationProvider): Observable<unknown> {
    return this.supabase.updateRowsWhere(
      'business_integrations',
      { user_id: userId, provider },
      {
        status: IntegrationStatus.Disconnected,
      },
    );
  }

  // upsertIntegration()/updateIntegrationStatus() are intentionally NOT implemented
  // client-side: writing a 'connected' row requires proof of a completed OAuth
  // flow, which only the backend (service-role key) can attest to — see the
  // functions/api/integrations/instagram/* Pages Functions below instead.

  /** Starts the Instagram OAuth flow: gets a one-time authorization URL from
   *  the backend (bound to this business via a server-side `state` row) and
   *  hands it back for the caller to navigate to. A plain top-level
   *  navigation can't carry an Authorization header, so this has to be a
   *  `fetch()` first, then `window.location.href = authorizationUrl`. */
  async requestInstagramAuthorizationUrl(): Promise<string> {
    const response = await this.authorizedFetch('/api/integrations/instagram/connect');
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not start Instagram sign-in.');
    }
    const { authorizationUrl } = (await response.json()) as { authorizationUrl: string };
    return authorizationUrl;
  }

  /** Disconnects Instagram through the backend (best-effort remote
   *  revocation + local credential removal) — prefer this over
   *  `disconnectIntegration()` for providers that have a real OAuth backend. */
  async disconnectInstagram(): Promise<void> {
    const response = await this.authorizedFetch('/api/integrations/instagram/disconnect', {
      method: 'POST',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not disconnect Instagram.');
    }
  }

  /** Starts a WhatsApp Embedded Signup attempt: mints a one-time session
   *  bound to this business (same pattern as Instagram's `oauth_states`),
   *  used to prove ownership when `completeWhatsAppSignup()` is called after
   *  Meta's Embedded Signup popup finishes. */
  async requestWhatsAppSignupSession(): Promise<string> {
    const response = await this.authorizedFetch('/api/integrations/whatsapp/connect-session');
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not start WhatsApp sign-in.');
    }
    const { sessionId } = (await response.json()) as { sessionId: string };
    return sessionId;
  }

  /** Finishes Embedded Signup with the authorization `code` Meta's JS SDK
   *  returned from the popup flow, plus the `sessionId` from
   *  `requestWhatsAppSignupSession()`. All Meta API calls happen server-side. */
  async completeWhatsAppSignup(sessionId: string, code: string): Promise<ConnectionSummary> {
    const response = await this.authorizedFetch('/api/integrations/whatsapp/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not connect WhatsApp.');
    }
    return response.json();
  }

  async disconnectWhatsApp(): Promise<void> {
    const response = await this.authorizedFetch('/api/integrations/whatsapp/disconnect', {
      method: 'POST',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'Could not disconnect WhatsApp.');
    }
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
