import {
  PayoutDestinationType,
  PayoutStatus,
  ReferralStatus,
  RewardLedgerEntryType,
  RewardStatus,
  RewardType,
} from '../enums/referral-reward.enum';

/** A user's own referral code/link — the only shape Angular needs to render
 *  "share this link". Codes are generated server-side (Phase 2); this model
 *  just describes what `public.referral_codes` (RLS: read own row only)
 *  hands back. */
export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  active: boolean;
  createdAt: string;
}

/** One referral relationship, from either side's point of view. Amounts and
 *  status transitions are always decided server-side — see
 *  `public.referrals`, which has no insert/update policy for `authenticated`. */
export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referralCodeId: string;
  status: ReferralStatus;
  qualifyingEvent: string | null;
  qualifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A reward belonging to the current user. `rewardAmount` is only ever set
 *  by the backend before the row is ever visible to the client — Angular
 *  must never compute or guess this value (see `<app-scratch-reward>`, Phase 3). */
export interface Reward {
  id: string;
  userId: string;
  referralId: string | null;
  rewardType: RewardType;
  /** Smallest currency unit (paise). `null` while `status` is `LOCKED` or
   *  `ELIGIBLE` — the amount is only ever exposed once the reward has been
   *  revealed (see `my_rewards`'s masking `case`); Angular must render that
   *  as "not revealed yet", never substitute a guess or a zero. */
  rewardAmount: number | null;
  status: RewardStatus;
  eligibleAt: string | null;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One row of the append-only reward ledger — used to derive available /
 *  pending / paid / total-earned balances without trusting a single mutable
 *  counter. */
export interface RewardLedgerEntry {
  id: string;
  userId: string;
  rewardId: string | null;
  payoutId: string | null;
  type: RewardLedgerEntryType;
  /** `null` if the underlying reward hasn't been revealed yet (see
   *  `my_reward_ledger`'s masking `case`). */
  amount: number | null;
  balanceEffect: 'credit' | 'debit';
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** A saved payout destination. Only a masked identifier and an opaque
 *  provider reference ever reach the client/database — never a raw account
 *  number or full UPI VPA. */
export interface PayoutDestination {
  id: string;
  userId: string;
  type: PayoutDestinationType;
  maskedIdentifier: string;
  providerReference: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A cash-out request and its backend-driven lifecycle. */
export interface Payout {
  id: string;
  userId: string;
  payoutDestinationId: string | null;
  amount: number;
  status: PayoutStatus;
  provider: string | null;
  providerPayoutId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Non-sensitive program settings the UI may read (e.g. "earn ₹10 per
 *  referral", minimum payout amount) — sourced from
 *  `public.referral_program_settings`, a read-only view over the server-only
 *  `referral_program_config` table. Never contains anything Angular could
 *  use to compute a reward itself. */
export interface ReferralProgramSettings {
  referralEnabled: boolean;
  rewardEnabled: boolean;
  rewardType: RewardType;
  fixedRewardAmount: number;
  minimumPayoutAmount: number;
  campaignStart: string | null;
  campaignEnd: string | null;
  payoutEnabled: boolean;
}

/** Result of the server-side register-referral / evaluate-referral
 *  operations (see `register_referral()`/`evaluate_referral()` in
 *  `20260905000000_referral_reward_engine.sql`). Every field here was
 *  decided entirely server-side — Angular only ever displays it. */
export interface ReferralEvaluationResult {
  referralId: string;
  status: ReferralStatus;
  qualifyingEvent: string | null;
  qualifiedAt: string | null;
  rewardId: string | null;
  rewardAmount: number | null;
  rewardStatus: RewardStatus | null;
}

/** Result of the server-side reveal-reward operation (see `reveal_reward()`
 *  in `20260906000000_referral_reward_reveal.sql`). `rewardAmount` is `null`
 *  when the reward isn't eligible to reveal yet (e.g. still `LOCKED`) —
 *  Angular must never substitute a guessed value in that case. */
export interface RevealRewardResult {
  rewardId: string;
  status: RewardStatus;
  rewardAmount: number | null;
  revealedAt: string | null;
}

/** Result of a payout operation (request/reconcile/webhook-applied) — see
 *  `payout_result()` in `20260907010000_payout_engine.sql`. Every field is
 *  decided entirely server-side/provider-side; Angular only ever displays
 *  it. Optional fields are omitted by some callers that only need a status
 *  update (e.g. an idempotent-replay short-circuit). */
export interface PayoutOperationResult {
  payoutId: string;
  status: PayoutStatus;
  amount?: number;
  provider?: string | null;
  providerPayoutId?: string | null;
  failureReason?: string | null;
  requestedAt?: string | null;
  processedAt?: string | null;
  completedAt?: string | null;
}

/** Aggregated view for the Rewards page: available / pending / paid
 *  balances, total earned, and referral counts. Computed server-side (or
 *  derived client-side from ledger + reward rows) — never a raw client
 *  input. */
export interface RewardSummary {
  /** Sum of rewards already scratched/revealed but not yet requested for payout. */
  availableAmount: number;
  pendingAmount: number;
  paidAmount: number;
  /** Never includes ELIGIBLE/LOCKED rewards — only ever counts amounts the
   *  user has actually revealed, so this total can't leak an unrevealed
   *  reward's amount. */
  totalEarnedAmount: number;
  /** Rewards waiting to be scratched — a count only, deliberately no amount
   *  (see `my_reward_summary`). Lets the UI say "you have N rewards to
   *  scratch" without showing what they're worth. */
  unrevealedCount: number;
  totalReferrals: number;
  qualifiedReferrals: number;
}
