import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';
import {
  Referral,
  ReferralCode,
  ReferralEvaluationResult,
  ReferralProgramSettings,
} from '../models/referral-reward.model';
import { ReferralStatus, RewardType } from '../enums/referral-reward.enum';

export type RegisterReferralResult =
  | { ok: true; result: ReferralEvaluationResult }
  | { ok: false; code: string; message: string };

/**
 * Referral code/link + referral-relationship reads. Every privileged
 * decision (who a code belongs to, who gets attributed, whether/when a
 * referral qualifies) is made server-side — see functions/api/referrals/**
 * and the RPCs in supabase/migrations/20260905000000_referral_reward_engine.sql.
 * This service only ever forwards the current user's authenticated request
 * or reads rows RLS already restricts to their own.
 */
@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly auth = inject(AuthService);
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

  /** Fetches the signed-in user's referral code, creating it server-side on
   *  first request. Never generates or guesses a code client-side. */
  getReferralCode(): Promise<ReferralCode> {
    return this.requestReferralEndpoint<ReferralCode>('/api/referrals/code', 'GET');
  }

  /** Builds the shareable signup link for a code, using this app's own
   *  origin — never a hard-coded production domain. */
  buildReferralLink(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/signup?ref=${encodeURIComponent(code)}`;
  }

  /**
   * Registers the current (already authenticated) user as referred by
   * `code`. Idempotent and safe to call more than once — the server never
   * lets a later call change who gets credited (see register_referral()).
   * Returns a typed result rather than throwing for expected outcomes
   * (invalid code, self-referral, already attributed) — those aren't app
   * failures.
   */
  async registerReferral(code: string): Promise<RegisterReferralResult> {
    try {
      const result = await this.requestReferralEndpoint<ReferralEvaluationResult>(
        '/api/referrals/register',
        'POST',
        { referralCode: code },
      );
      return { ok: true, result };
    } catch (err) {
      const error = err as Error & { code?: string };
      return {
        ok: false,
        code: error.code ?? 'referral_failed',
        message: error.message || 'Could not register this referral.',
      };
    }
  }

  /** Re-runs server-side qualification for the current user's own inbound
   *  referral. Safe to call repeatedly; returns `null` if there's nothing to
   *  evaluate or the request fails. */
  async evaluateOwnReferral(): Promise<ReferralEvaluationResult | null> {
    try {
      return await this.requestReferralEndpoint<ReferralEvaluationResult>(
        '/api/referrals/evaluate',
        'POST',
      );
    } catch {
      return null;
    }
  }

  /** Non-sensitive program settings (whether referrals/rewards are enabled,
   *  the current fixed reward amount, campaign window, minimum payout) —
   *  read straight from `referral_program_settings`, a read-only view over
   *  the server-only config table. Angular uses this only to decide what to
   *  *display*, never to compute a reward itself. */
  async getProgramSettings(): Promise<ReferralProgramSettings> {
    const { data, error } = await this.client
      .from('referral_program_settings')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return {
      referralEnabled: data?.referral_enabled ?? false,
      rewardEnabled: data?.reward_enabled ?? false,
      rewardType: (data?.reward_type as RewardType) ?? RewardType.Fixed,
      fixedRewardAmount: data?.fixed_reward_amount ?? 0,
      minimumPayoutAmount: data?.minimum_payout_amount ?? 0,
      campaignStart: data?.campaign_start ?? null,
      campaignEnd: data?.campaign_end ?? null,
      payoutEnabled: data?.payout_enabled ?? false,
    };
  }

  /** Every referral where the current user is the referrer, newest first —
   *  read directly via RLS ("participant can read own referrals"); no
   *  privileged endpoint needed for a plain read of the caller's own rows. */
  async getReferralHistory(): Promise<Referral[]> {
    const { data, error } = await this.client
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(ReferralService.mapReferral);
  }

  /** The current user's own inbound referral (they are the referred user),
   *  if any. */
  async getReferralStatus(): Promise<Referral | null> {
    const session = await firstValueFrom(this.auth.session$);
    const uid = session?.user.id;
    if (!uid) return null;

    const { data, error } = await this.client
      .from('referrals')
      .select('*')
      .eq('referred_user_id', uid)
      .maybeSingle();
    if (error) throw error;
    return data ? ReferralService.mapReferral(data) : null;
  }

  private static mapReferral(row: {
    id: string;
    referrer_user_id: string;
    referred_user_id: string;
    referral_code_id: string;
    status: string;
    qualifying_event: string | null;
    qualified_at: string | null;
    created_at: string;
    updated_at: string;
  }): Referral {
    return {
      id: row.id,
      referrerUserId: row.referrer_user_id,
      referredUserId: row.referred_user_id,
      referralCodeId: row.referral_code_id,
      status: row.status as ReferralStatus,
      qualifyingEvent: row.qualifying_event,
      qualifiedAt: row.qualified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async requestReferralEndpoint<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      const error: Error & { code?: string } = new Error('You must be signed in.');
      error.code = 'unauthenticated';
      throw error;
    }

    const response = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    const payload = isJson
      ? ((await response.json().catch(() => null)) as { error?: string; code?: string } | null)
      : null;

    if (!response.ok || !payload) {
      const error: Error & { code?: string } = new Error(
        payload?.error || 'Referral service unavailable.',
      );
      error.code = payload?.code;
      throw error;
    }
    return payload as T;
  }
}
