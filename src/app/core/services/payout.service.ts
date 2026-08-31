import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';
import {
  Payout,
  PayoutDestination,
  PayoutOperationResult,
} from '../models/referral-reward.model';
import { PayoutDestinationType, PayoutStatus } from '../enums/referral-reward.enum';

/**
 * Payout destination + request reads/writes for the current user. Every
 * money-moving decision — available balance, minimum threshold, which
 * rewards get spent, provider submission, and every status transition — is
 * made server-side (see request_payout()/apply_payout_result() in
 * supabase/migrations/20260907010000_payout_engine.sql and
 * functions/api/payouts/**). This service only ever reads rows RLS already
 * restricts to their owner, or forwards an authenticated request.
 */
@Injectable({ providedIn: 'root' })
export class PayoutService {
  private readonly auth = inject(AuthService);
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

  /** The current user's saved payout destination, if any — read directly
   *  via RLS ("owner can read own payout destinations"). Only one is
   *  supported per user for now (see `payout_destinations_user_id_key`). */
  async getDestination(): Promise<PayoutDestination | null> {
    const { data, error } = await this.client
      .from('payout_destinations')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? PayoutService.mapDestination(data) : null;
  }

  /** Adds/replaces the user's UPI payout destination. The raw UPI id is
   *  exchanged with the payout provider server-side and never stored as-is
   *  — only a masked display string and the provider's own references come
   *  back. Frontend format checks are convenience only; the server
   *  validates (and, once a real provider exists, verifies) again. */
  async addUpiDestination(upiId: string): Promise<PayoutDestination> {
    const payload = await this.requestPayoutEndpoint<{
      id: string;
      type: string;
      maskedIdentifier: string;
      verified: boolean;
      createdAt: string;
      updatedAt: string;
    }>('/api/payouts/destinations', { type: 'upi', identifier: upiId });

    return {
      id: payload.id,
      userId: '',
      type: payload.type as PayoutDestinationType,
      maskedIdentifier: payload.maskedIdentifier,
      providerReference: null,
      verified: payload.verified,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  }

  /** Requests a withdrawal to `destinationId`. The server independently
   *  derives the identity, balance, and amount — this call sends nothing
   *  else. Safe to call repeatedly within a short window: the server
   *  generates its own idempotency key, so a double-click/retry returns the
   *  same payout rather than creating a second one. */
  requestPayout(destinationId: string): Promise<PayoutOperationResult> {
    return this.requestPayoutEndpoint<PayoutOperationResult>('/api/payouts/request', {
      destinationId,
    });
  }

  /** Manually checks a PROCESSING/QUEUED payout's real status with the
   *  provider and applies it. User-initiated only (e.g. a "Check status"
   *  button) — never call this on an interval/poll. */
  reconcilePayout(payoutId: string): Promise<PayoutOperationResult> {
    return this.requestPayoutEndpoint<PayoutOperationResult>('/api/payouts/reconcile', {
      payoutId,
    });
  }

  /** Every payout belonging to the current user, newest first — read
   *  directly via RLS ("owner can read own payouts"). */
  async getPayoutHistory(): Promise<Payout[]> {
    const { data, error } = await this.client
      .from('payouts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(PayoutService.mapPayout);
  }

  private static mapDestination(row: {
    id: string;
    user_id: string;
    type: string;
    masked_identifier: string;
    provider_reference: string | null;
    verified: boolean;
    created_at: string;
    updated_at: string;
  }): PayoutDestination {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as PayoutDestinationType,
      maskedIdentifier: row.masked_identifier,
      providerReference: row.provider_reference,
      verified: row.verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapPayout(row: {
    id: string;
    user_id: string;
    payout_destination_id: string | null;
    amount: number;
    status: string;
    provider: string | null;
    provider_payout_id: string | null;
    failure_reason: string | null;
    created_at: string;
    updated_at: string;
  }): Payout {
    return {
      id: row.id,
      userId: row.user_id,
      payoutDestinationId: row.payout_destination_id,
      amount: row.amount,
      status: row.status as PayoutStatus,
      provider: row.provider,
      providerPayoutId: row.provider_payout_id,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async requestPayoutEndpoint<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      const error: Error & { code?: string } = new Error('You must be signed in.');
      error.code = 'unauthenticated';
      throw error;
    }

    const response = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    const payload = isJson
      ? ((await response.json().catch(() => null)) as
          | (T & { error?: string; code?: string })
          | null)
      : null;

    if (!response.ok || !payload) {
      const error: Error & { code?: string } = new Error(
        payload?.error || 'Could not complete this payout request.',
      );
      error.code = payload?.code;
      throw error;
    }
    return payload;
  }
}
