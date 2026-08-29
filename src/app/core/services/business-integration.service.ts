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
  // flow, which only the backend (service-role key) can attest to. Step 2 adds
  // those as Cloudflare Pages Function endpoints once Instagram OAuth exists.
}
