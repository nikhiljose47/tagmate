import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';
import {
  Reward,
  RewardLedgerEntry,
  RevealRewardResult,
  RewardSummary,
} from '../models/referral-reward.model';
import { RewardLedgerEntryType, RewardStatus, RewardType } from '../enums/referral-reward.enum';

/**
 * Reward reads for the current user, plus the one privileged write this
 * feature has: revealing a reward. Reward creation, amounts, and every
 * status transition are decided entirely server-side (see
 * evaluate_referral()/reveal_reward() in
 * supabase/migrations/20260905000000_referral_reward_engine.sql and
 * 20260906000000_referral_reward_reveal.sql) — this service only ever reads
 * `my_rewards`/`my_reward_ledger`/`my_reward_summary` (views that already
 * null out any amount the caller hasn't revealed yet) or forwards an
 * authenticated reveal request.
 */
@Injectable({ providedIn: 'root' })
export class RewardService {
  private readonly auth = inject(AuthService);
  private readonly clientService = inject(SupabaseClientService);
  private readonly client = this.clientService.client;

  /** Aggregated available/pending/paid/total-earned balances plus referral
   *  counts — read from `my_reward_summary`, a security-barrier view that
   *  filters by `auth.uid()` itself and never sums an unrevealed amount, so
   *  it can neither return another user's totals nor leak a reward's amount
   *  before its reveal. */
  async getRewardSummary(): Promise<RewardSummary> {
    const { data, error } = await this.client.from('my_reward_summary').select('*').maybeSingle();
    if (error) throw error;
    return {
      availableAmount: data?.available_amount ?? 0,
      pendingAmount: data?.pending_amount ?? 0,
      paidAmount: data?.paid_amount ?? 0,
      totalEarnedAmount: data?.total_earned_amount ?? 0,
      unrevealedCount: data?.unrevealed_count ?? 0,
      totalReferrals: data?.total_referrals ?? 0,
      qualifiedReferrals: data?.qualified_referrals ?? 0,
    };
  }

  /** Every reward belonging to the current user, newest first — read from
   *  `my_rewards`, which nulls `rewardAmount` for any reward still
   *  `LOCKED`/`ELIGIBLE` (i.e. not yet revealed). */
  async getRewards(): Promise<Reward[]> {
    const { data, error } = await this.client
      .from('my_rewards')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(RewardService.mapReward);
  }

  /** Full reward ledger for the current user, newest first — read from
   *  `my_reward_ledger`, which applies the same pre-reveal amount masking. */
  async getLedger(): Promise<RewardLedgerEntry[]> {
    const { data, error } = await this.client
      .from('my_reward_ledger')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(RewardService.mapLedgerEntry);
  }

  /**
   * Reveals an eligible reward. The server re-verifies ownership and status
   * and is the sole source of the returned amount — this call never sends
   * or trusts anything but the reward id. Safe to call repeatedly: an
   * already-revealed (or later) reward just returns its stored amount again
   * rather than erroring or changing anything.
   */
  async revealReward(rewardId: string): Promise<RevealRewardResult> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      const error: Error & { code?: string } = new Error('You must be signed in.');
      error.code = 'unauthenticated';
      throw error;
    }

    const response = await fetch('/api/rewards/reveal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId }),
      cache: 'no-store',
    });

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    const payload = isJson
      ? ((await response.json().catch(() => null)) as
          | (RevealRewardResult & { error?: string; code?: string })
          | null)
      : null;

    if (!response.ok || !payload) {
      const error: Error & { code?: string } = new Error(
        payload?.error || 'Could not reveal this reward.',
      );
      error.code = payload?.code;
      throw error;
    }
    return payload;
  }

  private static mapReward(row: {
    id: string | null;
    user_id: string | null;
    referral_id: string | null;
    reward_type: string | null;
    reward_amount: number | null;
    status: string | null;
    eligible_at: string | null;
    revealed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  }): Reward {
    return {
      id: row.id ?? '',
      userId: row.user_id ?? '',
      referralId: row.referral_id,
      rewardType: row.reward_type as RewardType,
      rewardAmount: row.reward_amount,
      status: row.status as RewardStatus,
      eligibleAt: row.eligible_at,
      revealedAt: row.revealed_at,
      createdAt: row.created_at ?? '',
      updatedAt: row.updated_at ?? '',
    };
  }

  private static mapLedgerEntry(row: {
    id: string | null;
    user_id: string | null;
    reward_id: string | null;
    payout_id: string | null;
    type: string | null;
    amount: number | null;
    balance_effect: string | null;
    metadata: unknown;
    created_at: string | null;
  }): RewardLedgerEntry {
    return {
      id: row.id ?? '',
      userId: row.user_id ?? '',
      rewardId: row.reward_id,
      payoutId: row.payout_id,
      type: row.type as RewardLedgerEntryType,
      amount: row.amount,
      balanceEffect: row.balance_effect as 'credit' | 'debit',
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at ?? '',
    };
  }
}
