-- Short-lived, single-use OAuth state for the Instagram Business Login flow
-- (Step 2). A signed/stateless token can't reliably enforce "single use", so
-- this is a real table: the connect endpoint inserts a row bound to the
-- authenticated business, the callback endpoint atomically claims it
-- (`used_at is null` in the WHERE clause) before trusting anything else in
-- the request. Only the backend (service-role key) ever touches this table —
-- no RLS policies are added for `authenticated`, so the table is
-- unconditionally inaccessible to the browser/anon roles once RLS is on.

begin;

create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  provider text not null check (provider in ('instagram')),
  nonce text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists oauth_states_nonce_idx on public.oauth_states (nonce);
create index if not exists oauth_states_user_id_idx on public.oauth_states (user_id);

alter table public.oauth_states enable row level security;
-- Deliberately no policies: RLS with zero policies denies all access to
-- `authenticated`/`anon`. Only the service-role key (used exclusively by
-- functions/api/integrations/instagram/*.js) can read or write this table.

-- Best-effort cleanup of stale state rows, mirroring the existing
-- expire-business-offers cron job pattern.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-oauth-states') then
    perform cron.unschedule('expire-oauth-states');
  end if;
end $$;

select cron.schedule(
  'expire-oauth-states',
  '0 * * * *',
  $$delete from public.oauth_states where expires_at < now() - interval '1 day'$$
);

commit;
