-- Foundation for third-party business integrations (Instagram, WhatsApp, ...).
-- This migration only adds the storage/authorization layer — no OAuth or
-- external API calls happen yet (that's Steps 2/3). Two new tables:
--
--   business_integrations — one row per (business, provider) OAuth connection.
--     Token columns are never selectable by `authenticated`; the client only
--     ever reads the safe `my_business_integrations` view below, and may only
--     flip its own row to 'disconnected' (connecting/erroring/expiring a row
--     requires the service-role key, used server-side once OAuth exists).
--
--   post_publications — per-post, per-destination publish status (mirrors the
--     post's own "published to our website" state, plus one row per external
--     destination once we start publishing there). No client writes at all —
--     rows are only ever created/updated by the backend.
--
-- Also snapshots `business_whatsapp` onto `tags`, matching the existing
-- `business_phone`/`business_website` snapshot-at-post-time pattern, so the
-- WhatsApp CTA can prefer the business's public click-to-chat link over their
-- plain phone number (see business-post-content.component.ts).

begin;

-- ── WhatsApp CTA snapshot ──────────────────────────────────────────────────
-- Mirrors business_phone/business_website: the public WhatsApp click-to-chat
-- link, snapshotted from the poster's `social_whatsapp` at post-creation time.
alter table public.tags
  add column if not exists business_whatsapp text;

-- ── business_integrations ──────────────────────────────────────────────────
create table if not exists public.business_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  provider text not null check (provider in ('instagram', 'whatsapp')),
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error', 'expired')),
  provider_account_id text,
  provider_account_name text,
  -- Ciphertext only — encrypted server-side (see functions/api/business/_crypto.js)
  -- before it ever reaches Postgres. Never selectable by `authenticated`;
  -- see the column list on `my_business_integrations` below.
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A business can have at most one connection per provider.
  unique (user_id, provider)
);

create index if not exists business_integrations_user_id_idx
  on public.business_integrations (user_id);
create index if not exists business_integrations_provider_idx
  on public.business_integrations (provider);

alter table public.business_integrations enable row level security;

create policy "owner can read own integrations"
  on public.business_integrations for select
  to authenticated
  using (user_id = auth.uid()::text);

-- Self-service disconnect only. A user may flip their own row to
-- 'disconnected'; every other status transition ('connected', 'error',
-- 'expired') only ever happens server-side via the service-role key, which
-- bypasses RLS entirely — so no policy is needed (or possible) for those here.
create policy "owner can disconnect own integration"
  on public.business_integrations for update
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text and status = 'disconnected');

-- No insert/delete policies for `authenticated` — connections are only
-- created or removed by the backend once real OAuth exists (Steps 2/3).

-- Safe read surface for the frontend: excludes both token columns entirely,
-- so `select('*')` on this view can never leak a credential, structurally,
-- regardless of future column additions to the base table. Mirrors the
-- `my_user_profile` pattern from 20260822120000_business_profile_expansion.sql.
create or replace view public.my_business_integrations
with (security_invoker = true, security_barrier = true)
as
select
  id, user_id, provider, status, provider_account_id, provider_account_name,
  token_expires_at, created_at, updated_at
from public.business_integrations
where user_id = auth.uid()::text;

grant select (
  id, user_id, provider, status, provider_account_id, provider_account_name,
  token_expires_at, created_at, updated_at
) on public.business_integrations to authenticated;

grant select on public.my_business_integrations to authenticated;

-- ── post_publications ──────────────────────────────────────────────────────
create table if not exists public.post_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.tags(id) on delete cascade,
  provider text not null check (provider in ('website', 'instagram')),
  status text not null default 'pending'
    check (status in ('pending', 'publishing', 'published', 'failed')),
  provider_post_id text,
  error_code text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One publication record per (post, destination).
  unique (post_id, provider)
);

create index if not exists post_publications_post_id_idx
  on public.post_publications (post_id);

alter table public.post_publications enable row level security;

-- Post owners can see how their own post's publications are progressing
-- (surfaced in a later step's UI). No insert/update/delete for `authenticated`
-- at all — every publication record is created and driven by the backend.
create policy "post owner can read own post publications"
  on public.post_publications for select
  to authenticated
  using (
    exists (
      select 1 from public.tags t
      where t.id = post_publications.post_id
        and t.user_id = auth.uid()::text
    )
  );

commit;
