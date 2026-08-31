# Referral + Reward + Scratch + Payout system

Developer/maintainer notes for the referral program (`Phases 1-4`). Covers
what exists, where it lives, how to operate it safely, and the money flow
at a glance. Kept separate from the application code, same as
`docs/WHATSAPP_INTEGRATION_SETUP.md`.

## Flow at a glance

```
Referral link (?ref=CODE)
        ↓
Signup / login (Angular stashes code, never trusts it)
        ↓
POST /api/referrals/register  →  register_referral() RPC
        ↓
evaluate_referral() RPC  →  qualifying event met? ──no──→ stays PENDING
        │ yes
        ↓
Reward created (ELIGIBLE) + reward_ledger credit
        ↓
Rewards page: scratch card / "Reveal reward" button
        ↓
POST /api/rewards/reveal  →  reveal_reward() RPC  →  REVEALED (amount shown)
        ↓
Balance ≥ minimum_payout_amount → user adds UPI destination → "Withdraw"
        ↓
POST /api/payouts/request  →  request_payout() RPC (reserves rewards, PAYOUT_REQUESTED)
        ↓
Provider.createPayout()  →  apply_payout_result('PROCESSING')
        ↓
Webhook (signature-verified) or manual "Check status"  →  apply_payout_webhook()/reconcile
        ↓
   PAID  →  reward_ledger payout_debit, rewards → PAID
   FAILED → rewards released back to REVEALED (withdrawable again)
   REVERSED → reward_ledger payout_reversal, rewards → REVEALED
```

**Golden rule:** Angular never decides eligibility, amount, or status —
it only calls an authenticated endpoint and displays what comes back.

## How someone gets a referral

1. Any signed-in user opens `/referrals` — the page calls
   `GET /api/referrals/code`, which creates a code the first time
   (`create_or_get_referral_code()`) and just returns it after that. Same
   code forever, one per user.
2. They share the link shown on that page — `Copy link` or `Share`
   (`ReferralsPage.copyLink()`/`shareLink()` in
   `src/app/features/referrals/pages/referrals/referrals.ts`). The link is
   just `<app-origin>/signup?ref=<CODE>` — no secret, safe to post anywhere.
3. A new visitor opens that link and signs up. `SignupPage.ngOnInit()`
   stashes the `?ref=` code in local storage (`referral-attribution.util.ts`)
   — purely a temporary holding spot, not yet trusted.
4. Once the new account has a real session (right after signup, or after
   confirming the OTP), `attributeReferralIfPending()` calls
   `POST /api/referrals/register` with that code. The server resolves the
   referrer, rejects self-referral, and — the important part — this is the
   *only* moment attribution happens; nothing the referred user does later
   can change who gets credited.
5. `evaluate_referral()` runs immediately after registration. Today the
   qualifying event is "the new account is real (non-guest, non-test)" —
   see *Changing the qualifying event* below — so attribution and
   qualification typically happen in the same request. The referrer's
   reward is created right away, and shows up on their `/rewards` page as a
   scratch card.

There's no invite-code allowlist or admin approval step — anyone with an
account has a referral link the moment they visit `/referrals`.

## How to reproduce the whole flow locally

Needs two accounts (User A = referrer, User B = referred) and
`payout_enabled` on if you want to test withdrawal too.

1. Apply all five migrations (in order) and regenerate types — see
   *Regenerating types* below.
2. Set local env (`.dev.vars` or Cloudflare Preview vars):
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (already
   required by the rest of the app), plus `PAYOUT_PROVIDER=mock`,
   `PAYOUT_ENVIRONMENT=development`, `PAYOUT_WEBHOOK_SECRET=<any value>`.
3. `update referral_program_config set referral_enabled = true, reward_enabled = true where id = 1;`
4. Sign up as **User A**. Visit `/referrals`, copy the referral link.
5. Open a private/incognito window, visit that link
   (`/signup?ref=<A's code>`), sign up as **User B** with a real (non-guest)
   account.
6. Check the DB: `select * from referrals where referrer_user_id = '<A uid>'`
   should already show `status = 'REWARDED'`, and
   `select * from rewards where user_id = '<A uid>'` one row,
   `status = 'ELIGIBLE'`.
7. As **User A**, go to `/rewards` — scratch the card (or use the
   "Reveal reward" button) → amount appears, status becomes `REVEALED`.
   Reload the page — it stays revealed.
8. To test payout too: `update referral_program_config set payout_enabled = true, minimum_payout_amount = 500 where id = 1;`
   (lowering the minimum so one ₹10 reward clears it, for local testing
   only — put it back afterwards). Add a UPI destination on `/rewards`
   (any `name@bank`-shaped string works with the mock provider), click
   **Withdraw reward** → confirm. Status goes to `PROCESSING`; click
   **Check status** to resolve it to `PAID` (the mock provider always
   resolves to `PAID` on `getPayoutStatus()`).
9. To exercise the failure/timeout paths instead: the mock provider reads
   signal from the payout amount's last two digits — an amount ending in
   `13` paise simulates a definitive failure (payout → `FAILED`, reward
   released back to `REVEALED`); ending in `07` simulates a timeout
   (payout stays `PROCESSING`, nothing duplicated). You won't naturally hit
   these with a single ₹10 reward — they're there for automated/manual
   testing with a config amount you control.
10. Reset `payout_enabled` back to `false` when done.

## Where things live

| Layer | Path |
|---|---|
| DB schema + RLS | `supabase/migrations/20260904000000_referral_reward_foundation.sql` |
| Referral/reward RPCs | `supabase/migrations/20260905000000_referral_reward_engine.sql` |
| Reveal RPC + amount-masking fix | `supabase/migrations/20260906000000_referral_reward_reveal.sql` |
| Payout schema | `supabase/migrations/20260907000000_payout_system.sql` |
| Payout RPCs | `supabase/migrations/20260907010000_payout_engine.sql` |
| Referral/reveal endpoints | `functions/api/referrals/*`, `functions/api/rewards/reveal.js` |
| Payout endpoints + provider | `functions/api/payouts/*`, `functions/api/payouts/providers/*` |
| Payout webhook | `functions/api/webhooks/payout.js` |
| Angular services | `src/app/core/services/{referral,reward,payout}.service.ts` |
| Angular pages | `/referrals`, `/rewards` (`src/app/features/referrals`, `src/app/features/rewards`) |
| Scratch component | `src/app/shared/components/scratch-reward/` |

## Server-controlled config (`referral_program_config`, singleton row `id=1`)

Read-only to the client via the `referral_program_settings` view. Change
with SQL, never in Angular:

```sql
update referral_program_config set
  referral_enabled = true,
  reward_enabled = true,
  fixed_reward_amount = 1000,      -- paise (₹10)
  minimum_payout_amount = 5000,    -- paise (₹50)
  payout_enabled = false           -- master real-money switch
where id = 1;
```

## Turning real payouts on/off

```sql
-- disable immediately (no deploy needed, takes effect on the next request)
update referral_program_config set payout_enabled = false where id = 1;

-- enable (only after a real provider is configured — see below)
update referral_program_config set payout_enabled = true where id = 1;
```

Environment variables (Cloudflare Pages → Settings → Environment variables,
never in Angular): `PAYOUT_PROVIDER`, `PAYOUT_ENVIRONMENT`,
`PAYOUT_ALLOW_MOCK_IN_PRODUCTION`, `PAYOUT_WEBHOOK_SECRET`.

`getPayoutProvider()` (`functions/api/payouts/providers/index.js`) refuses
to run the mock provider when `PAYOUT_ENVIRONMENT=production` unless
`PAYOUT_ALLOW_MOCK_IN_PRODUCTION=true` is explicitly set — this is what
stops a test/mock config from ever moving real money by accident.

## Adding a real payout provider later

1. Add `functions/api/payouts/providers/<name>-provider.js` implementing the
   same five methods as `mock-provider.js`: `createOrGetBeneficiary`,
   `createOrGetDestination`, `createPayout`, `getPayoutStatus`,
   `verifyWebhook`.
2. Register it in `providers/index.js`'s `PROVIDERS` map.
3. Set `PAYOUT_PROVIDER=<name>` in the target environment.
4. Point the provider's webhook at `/api/webhooks/payout`.
5. Nothing else changes — the RPCs, endpoints, and Angular UI are already
   provider-agnostic.

## Changing the qualifying event

Currently: "referred user has a real, non-guest, non-test profile row."
That's a single `if` block in `evaluate_referral()`
(`20260905000000_referral_reward_engine.sql`) — swap the condition there
(e.g. verified phone, first transaction) without touching the schema,
endpoints, or Angular.

## Money-safety invariants (don't break these)

- Every write to `rewards` / `payouts` / `reward_ledger` goes through a
  `SECURITY DEFINER` RPC — never a direct client `INSERT`/`UPDATE`. If you
  add a new privileged field, extend an RPC; don't add an RLS write policy.
- A reward can only ever belong to one active payout: the partial unique
  index `payout_rewards(reward_id) WHERE NOT released`. Don't remove it.
- Idempotency keys for payouts are server-generated
  (`buildPayoutIdempotencyKey`) — never accept one from the client.
- Amounts shown to the client for `LOCKED`/`ELIGIBLE` rewards must stay
  `null` (see `my_rewards`'s masking `case`) — don't select `reward_amount`
  straight off the base `rewards` table from Angular.

## Regenerating types after a migration

```bash
supabase gen types typescript --linked > src/app/core/models/database.types.ts
```

Run this after applying **any** new migration in this feature — the
services (`RewardService`, `PayoutService`, etc.) read views/tables that
must be in the generated `Database` type to compile.

## Known pre-existing, unrelated build issue

`src/app/core/services/tag-data.service.ts` (a generic pre-existing
data-access helper, not part of this feature) currently fails
`ng build`/`tsc --noEmit` due to an incomplete `any`-typed workaround. It
does not touch referral/reward/payout code and was not introduced by this
feature, but it blocks a clean production build — fix it separately before
deploying.
