/**
 * Lifecycle of a single referral, enforced server-side. The client only ever
 * observes these values — it never sets or advances them (see the RLS
 * policies on `public.referrals`: no insert/update for `authenticated`).
 * `REVIEW_REQUIRED` is a deliberate escape hatch for suspicious-but-not-fraud
 * cases (see FUTURE_PLAN.md) instead of an automatic ban.
 */
export enum ReferralStatus {
  Pending = 'PENDING',
  Qualified = 'QUALIFIED',
  Rewarded = 'REWARDED',
  Rejected = 'REJECTED',
  ReviewRequired = 'REVIEW_REQUIRED',
}

/**
 * Lifecycle of a reward. `Locked`/`Eligible` distinguish "not yet qualified
 * for a scratch card" from "ready to scratch"; the scratch interaction only
 * ever moves `Eligible` -> `Revealed` via the reveal-reward endpoint — the
 * amount itself was already decided before the card existed.
 */
export enum RewardStatus {
  Locked = 'LOCKED',
  Eligible = 'ELIGIBLE',
  Revealed = 'REVEALED',
  PayoutRequested = 'PAYOUT_REQUESTED',
  Processing = 'PROCESSING',
  Paid = 'PAID',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

/** Only 'fixed' is implemented in the initial rollout — see
 *  `referral_program_config.reward_type` for where a randomized/promotional
 *  type would later be enabled, server-side only. */
export enum RewardType {
  Fixed = 'fixed',
}

export enum PayoutDestinationType {
  Upi = 'upi',
  BankAccount = 'bank_account',
}

export enum PayoutStatus {
  Requested = 'REQUESTED',
  Processing = 'PROCESSING',
  /** Provider has accepted it into its own processing queue — treated the
   *  same as `Processing` everywhere in the UI; kept distinct server-side
   *  since some providers report it separately. */
  Queued = 'QUEUED',
  Paid = 'PAID',
  Failed = 'FAILED',
  /** A previously `Paid` payout the provider later reversed (e.g. a bounced
   *  bank transfer) — the underlying rewards become withdrawable again. */
  Reversed = 'REVERSED',
  Cancelled = 'CANCELLED',
  ReviewRequired = 'REVIEW_REQUIRED',
}

export enum RewardLedgerEntryType {
  RewardCredit = 'reward_credit',
  PayoutDebit = 'payout_debit',
  PayoutReversal = 'payout_reversal',
  Adjustment = 'adjustment',
}
