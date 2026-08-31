-- Referral + reward + scratch-and-win + cash payout system — Phase 1
-- (foundation only: schema, constraints, RLS). No Edge Functions/Pages
-- Functions, no scratch-card UI, no randomized rewards, no payout execution
-- yet — those are later phases.
--
-- Security model, matching this repo's existing convention (see
-- business_integrations / whatsapp_* migrations):
--   * `public.users.uid` (text) is the identity key throughout, matching
--     `auth.uid()::text` — never a client-supplied user id.
--   * Every table gets RLS enabled with narrow, read-mostly policies for
--     `authenticated`. Fields that decide money (reward_amount, statuses,
--     qualified_at, provider payout ids, ...) are never writable by the
--     client — only the backend, using the service-role key (which bypasses
--     RLS entirely), may set them. Where no insert/update policy exists for
--     `authenticated` below, that is intentional, not an oversight.
--   * Idempotency is enforced at the database level (unique constraints),
--     not just in application code, so a retried/replayed request cannot
--     create a duplicate referral, reward, or payout.

begin;

-- ── referral_program_config ──────────────────────────────────────────────
-- Singleton config row. Business rules live here, not hard-coded in Angular
-- or scattered across backend endpoints. `authenticated` gets read-only
-- access to a safe subset via the view below; only service-role can write.
create table if not exists public.referral_program_config (
  id smallint primary key default 1,
  referral_enabled boolean not null default true,
  reward_enabled boolean not null default true,
  -- 'fixed' is the only supported value for now. Randomized/promotional
  -- reward types can be added later (server-side selection only — see the
  -- migration header of this file and FUTURE_PLAN.md); Angular must never
  -- gain a code path that picks its own reward type or amount.
  reward_type text not null default 'fixed' check (reward_type in ('fixed')),
  -- Amounts are stored in paise (smallest currency unit) to avoid float
  -- rounding issues, matching how money should be handled server-side.
  fixed_reward_amount integer not null default 1000 check (fixed_reward_amount >= 0),
  minimum_payout_amount integer not null default 10000 check (minimum_payout_amount >= 0),
  maximum_referrals_per_day integer not null default 20 check (maximum_referrals_per_day >= 0),
  maximum_referrals_per_month integer not null default 200 check (maximum_referrals_per_month >= 0),
  campaign_start timestamptz,
  campaign_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_program_config_singleton check (id = 1)
);

insert into public.referral_program_config (id) values (1)
  on conflict (id) do nothing;

alter table public.referral_program_config enable row level security;

-- Safe read surface: the full table has no secrets, but a view keeps the
-- same "client never sees a column we didn't intend" discipline as
-- my_business_integrations/my_user_profile.
create or replace view public.referral_program_settings
with (security_invoker = true, security_barrier = true)
as
select
  referral_enabled, reward_enabled, reward_type, fixed_reward_amount,
  minimum_payout_amount, campaign_start, campaign_end
from public.referral_program_config
where id = 1;

revoke all on table public.referral_program_config from public, anon, authenticated;
grant select on public.referral_program_settings to authenticated;

-- ── referral_codes ────────────────────────────────────────────────────────
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- One active/inactive code slot per user for now; the backend can still
  -- reissue by deactivating the old row and inserting a new one.
  unique (user_id)
);

create index if not exists referral_codes_user_id_idx on public.referral_codes (user_id);

alter table public.referral_codes enable row level security;

create policy "owner can read own referral code"
  on public.referral_codes for select
  to authenticated
  using (user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` — codes are generated and
-- retired only by the backend (create-or-get-referral-code endpoint, Phase 2).

-- ── referrals ─────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id text not null references public.users(uid) on delete cascade,
  referred_user_id text not null references public.users(uid) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED', 'REVIEW_REQUIRED')),
  qualifying_event text,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A user cannot refer themselves.
  constraint referrals_no_self_referral check (referrer_user_id <> referred_user_id),
  -- The core anti-fraud invariant: one referred user can only ever be
  -- credited to a single referrer, enforced by the database, not just
  -- application logic.
  constraint referrals_referred_user_unique unique (referred_user_id)
);

create index if not exists referrals_referrer_user_id_idx on public.referrals (referrer_user_id, status);
create index if not exists referrals_status_idx on public.referrals (status);
create index if not exists referrals_created_at_idx on public.referrals (created_at);

alter table public.referrals enable row level security;

create policy "participant can read own referrals"
  on public.referrals for select
  to authenticated
  using (referrer_user_id = auth.uid()::text or referred_user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` — referral capture happens at
-- registration and qualification is evaluated server-side only (Phase 2).

-- ── rewards ───────────────────────────────────────────────────────────────
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  reward_type text not null default 'fixed' check (reward_type in ('fixed')),
  reward_amount integer not null check (reward_amount >= 0),
  status text not null default 'LOCKED'
    check (status in (
      'LOCKED', 'ELIGIBLE', 'REVEALED', 'PAYOUT_REQUESTED',
      'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'
    )),
  eligible_at timestamptz,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- At most one reward per referral — a replayed "referral qualified" event
  -- cannot mint a second reward.
  constraint rewards_referral_unique unique (referral_id)
);

create index if not exists rewards_user_id_idx on public.rewards (user_id, status);
create index if not exists rewards_status_idx on public.rewards (status);

alter table public.rewards enable row level security;

create policy "owner can read own rewards"
  on public.rewards for select
  to authenticated
  using (user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` — reward creation, reveal, and
-- every status transition are backend-only (create-reward / reveal-reward,
-- Phases 2/3). This is what stops a manipulated client request from ever
-- changing reward_amount or status directly.

-- ── reward_ledger ─────────────────────────────────────────────────────────
-- Append-only ledger: every credit/debit affecting a user's reward balance,
-- so "available / pending / paid / total earned" can always be derived by
-- summing rows rather than trusting a single mutable balance column.
create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  reward_id uuid references public.rewards(id) on delete set null,
  payout_id uuid, -- FK added once public.payouts exists, see below
  type text not null check (type in ('reward_credit', 'payout_debit', 'payout_reversal', 'adjustment')),
  amount integer not null check (amount >= 0),
  balance_effect text not null check (balance_effect in ('credit', 'debit')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reward_ledger_user_id_idx on public.reward_ledger (user_id, created_at desc);
create index if not exists reward_ledger_reward_id_idx on public.reward_ledger (reward_id);

alter table public.reward_ledger enable row level security;

create policy "owner can read own reward ledger"
  on public.reward_ledger for select
  to authenticated
  using (user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` — ledger rows are only ever
-- written by trusted backend operations, transactionally alongside the
-- reward/payout row they describe.

-- ── payout_destinations ───────────────────────────────────────────────────
-- Only a provider token/reference is stored, never raw account numbers or
-- full UPI VPAs — `masked_identifier` is display-only (e.g. "xxxx1234" /
-- "u***@okhdfc"), `provider_reference` is an opaque id from the payout
-- provider used to actually initiate a payout.
create table if not exists public.payout_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  type text not null check (type in ('upi', 'bank_account')),
  masked_identifier text not null,
  provider_reference text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_destinations_user_id_idx on public.payout_destinations (user_id);

alter table public.payout_destinations enable row level security;

create policy "owner can read own payout destinations"
  on public.payout_destinations for select
  to authenticated
  using (user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` yet. Linking a destination
-- still requires server-side validation (validateDestination(), Phase 4)
-- before a row should ever exist, so writes stay backend-only for now.

-- ── payouts ───────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  payout_destination_id uuid references public.payout_destinations(id) on delete restrict,
  amount integer not null check (amount >= 0),
  status text not null default 'REQUESTED'
    check (status in (
      'REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REVIEW_REQUIRED'
    )),
  provider text,
  provider_payout_id text,
  -- Server-generated, unique per logical payout request — the mechanism
  -- that stops a page refresh/double-click from creating two payouts.
  idempotency_key text not null unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payouts_user_id_idx on public.payouts (user_id, status);
-- A given provider payout id must not be recorded twice (duplicate webhook
-- delivery protection); null'd out for providers/requests that don't have
-- one yet, so those rows never collide with each other.
create unique index if not exists payouts_provider_payout_id_key
  on public.payouts (provider, provider_payout_id)
  where provider_payout_id is not null;

alter table public.payouts enable row level security;

create policy "owner can read own payouts"
  on public.payouts for select
  to authenticated
  using (user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` — payouts are initiated and
-- driven exclusively by the backend (Phase 4).

alter table public.reward_ledger
  add constraint reward_ledger_payout_id_fkey
  foreign key (payout_id) references public.payouts(id) on delete set null;

-- ── referral_reward_events ────────────────────────────────────────────────
-- Generic audit trail so any reward/payout can always be traced: who, what,
-- why, when, related referral, amount, which backend action performed it,
-- provider reference, and resulting status. Written by backend operations
-- only; never by the client.
create table if not exists public.referral_reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.users(uid) on delete set null,
  event_type text not null,
  referral_id uuid references public.referrals(id) on delete set null,
  reward_id uuid references public.rewards(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  action text not null,
  amount integer,
  provider_reference text,
  resulting_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_reward_events_user_id_idx
  on public.referral_reward_events (user_id, created_at desc);
create index if not exists referral_reward_events_referral_id_idx
  on public.referral_reward_events (referral_id);
create index if not exists referral_reward_events_reward_id_idx
  on public.referral_reward_events (reward_id);
create index if not exists referral_reward_events_payout_id_idx
  on public.referral_reward_events (payout_id);

alter table public.referral_reward_events enable row level security;

create policy "owner can read own referral/reward events"
  on public.referral_reward_events for select
  to authenticated
  using (user_id = auth.uid()::text);

-- No insert/update/delete for `authenticated` — every event is written by
-- the backend action that produced it.

commit;
