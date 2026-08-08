-- Personal vs business accounts.
--
-- Adds `account_type` ('personal' | 'business') and `business_name` to
-- public.users, and teaches the signup trigger to persist them from the
-- auth.users signup metadata (mirrors the home_hood pattern in
-- 20260803120000_home_hood_defaults.sql).

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type  text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS business_name text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_type_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('personal', 'business'));

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  hood jsonb := new.raw_user_meta_data->'home_hood';
  acct_type text := coalesce(nullif(new.raw_user_meta_data->>'account_type', ''), 'personal');
begin
  insert into public.users (
    uid, name, email, is_guest, created_at,
    home_state, home_country, home_district, home_place, home_lat, home_lng, home_updated_at,
    account_type, business_name
  )
  values (
    new.id::text,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1),
      'User'
    ),
    new.email,
    false,
    coalesce(new.created_at, now()),
    coalesce(nullif(hood->>'state', ''),    'Karnataka'),
    coalesce(nullif(hood->>'country', ''),  'India'),
    coalesce(nullif(hood->>'district', ''), 'Bangalore Urban'),
    nullif(hood->>'place', ''),
    nullif(hood->>'lat', '')::double precision,
    nullif(hood->>'lng', '')::double precision,
    -- Grace window: stamp 30 days in the past so the user's FIRST hood change
    -- is free. The cooldown trigger then enforces 30 days between subsequent
    -- changes.
    now() - interval '30 days',
    acct_type,
    nullif(new.raw_user_meta_data->>'business_name', '')
  )
  on conflict (uid) do update
  set
    name          = coalesce(excluded.name, public.users.name),
    email         = coalesce(excluded.email, public.users.email),
    is_guest      = false,
    account_type  = excluded.account_type,
    business_name = coalesce(excluded.business_name, public.users.business_name);

  return new;
end;
$function$;

COMMIT;
