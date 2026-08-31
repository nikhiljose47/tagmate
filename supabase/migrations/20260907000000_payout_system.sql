-- Referral + reward + scratch-and-win + cash payout system — Phase 4
-- (secure real-money payout system). Builds on Phases 1-3 without touching
-- their tables/policies except where explicitly widened below.
--
-- Provider inspection (repeated for Phase 4, per the brief): this repo has
-- no Razorpay/RazorpayX/Stripe/Cashfree/PayU integration anywhere, and no
-- Supabase Edge Functions in use (confirmed via `supabase/config.toml` —
-- edge_runtime is default/unused). The trusted backend remains Cloudflare
-- Pages Functions (functions/api/**), same as Phases 2-3. No payout-capable
-- provider exists to reuse, so this migration only builds the
-- provider-agnostic schema + state machine; the actual provider call goes
-- through a small server-side abstraction (see functions/api/payouts/
-- providers/) with only a MockPayoutProvider implemented for now — see the
-- Phase 4 report for what a real provider integration still needs.
--
-- `referral_program_config.payout_enabled` (added below, default false) is
-- the master real-money kill switch: every payout-mutating RPC checks it
-- independently of whatever Angular sends, so the feature can be deployed
-- with payouts fully wired but inert until deliberately turned on.

begin;

-- ── referral_program_config: payout_enabled ──────────────────────────────
-- Appended at the end of both the table and `referral_program_settings` —
-- `create or replace view` can only add columns at the end (see the
-- 42P16 lesson from 20260906000000_referral_reward_reveal.sql).
alter table public.referral_program_config
  add column if not exists payout_enabled boolean not null default false;

create or replace view public.referral_program_settings
with (security_invoker = true, security_barrier = true)
as
select
  referral_enabled, reward_enabled, reward_type, fixed_reward_amount,
  minimum_payout_amount, campaign_start, campaign_end, payout_enabled
from public.referral_program_config
where id = 1;

-- ── payouts: widen the state machine + provider/timestamp columns ───────
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status in (
    'REQUESTED', 'PROCESSING', 'QUEUED', 'PAID', 'FAILED', 'REVERSED',
    'CANCELLED', 'REVIEW_REQUIRED'
  ));

alter table public.payouts
  add column if not exists provider_status text,
  add column if not exists failure_code text,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists completed_at timestamptz;

-- ── payout_destinations: distinguish beneficiary vs fund-account refs ────
-- `provider_reference` (Phase 1) becomes the destination/fund-account id;
-- `provider_contact_id` is the separate beneficiary/contact id most payout
-- providers (e.g. RazorpayX) require. Neither ever holds a raw UPI id/bank
-- account number — those are never persisted here at all (see
-- add_payout_destination() below and the Mock provider).
alter table public.payout_destinations
  add column if not exists provider_contact_id text;

-- Only one destination per user for the initial launch — matches the
-- referral_codes "one row per user" pattern; replacing it is a new
-- add_payout_destination() call (upsert), not multiple stored destinations.
alter table public.payout_destinations
  drop constraint if exists payout_destinations_user_id_key;
alter table public.payout_destinations
  add constraint payout_destinations_user_id_key unique (user_id);

-- ── payout_rewards ────────────────────────────────────────────────────────
-- Join table connecting a payout to exactly the reward rows it consumed.
-- `released` distinguishes "still reserved by this payout" from "this
-- payout failed/reversed and the reward became withdrawable again" — a
-- released row is kept for audit history rather than deleted, and the
-- partial unique index below is what actually prevents a reward being
-- spent by two payouts at once (not the join row's mere existence).
create table if not exists public.payout_rewards (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  released boolean not null default false,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists payout_rewards_payout_id_idx on public.payout_rewards (payout_id);
create unique index if not exists payout_rewards_reward_id_active_key
  on public.payout_rewards (reward_id)
  where not released;

alter table public.payout_rewards enable row level security;

create policy "owner can read own payout reward links"
  on public.payout_rewards for select
  to authenticated
  using (
    exists (
      select 1 from public.payouts p
      where p.id = payout_rewards.payout_id and p.user_id = auth.uid()::text
    )
  );

-- No insert/update/delete for `authenticated` — every link is created and
-- released only by request_payout()/apply_payout_result() below.

-- ── provider_webhook_events ───────────────────────────────────────────────
-- Idempotency ledger for inbound webhooks. A provider redelivering the same
-- event must never apply twice — `record_webhook_event()` below is the only
-- writer, gated by the unique constraint, not just an in-app check.
create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  processed boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

alter table public.provider_webhook_events enable row level security;
-- No policies at all: this table is never meant to be read or written by
-- `anon`/`authenticated` — only the webhook handler (service-role) touches
-- it. RLS with zero policies denies all access from those roles by default.

commit;
