-- Follow-up to 20260803000000_home_hood.sql — the existing
-- `handle_new_auth_user` trigger inserts into public.users with only a subset
-- of columns, so the NOT NULL home_hood columns caused signup to 500.
--
-- Fix: teach the trigger to read home_hood from raw_user_meta_data, and add
-- defaults on the columns as a safety net for any other insert path.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  hood jsonb := new.raw_user_meta_data->'home_hood';
begin
  insert into public.users (
    uid, name, email, is_guest, created_at,
    home_state, home_country, home_district, home_place, home_lat, home_lng, home_updated_at
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
    now() - interval '30 days'
  )
  on conflict (uid) do update
  set
    name = coalesce(excluded.name, public.users.name),
    email = coalesce(excluded.email, public.users.email),
    is_guest = false;

  return new;
end;
$function$;

ALTER TABLE public.users
  ALTER COLUMN home_state       SET DEFAULT 'Karnataka',
  ALTER COLUMN home_country     SET DEFAULT 'India',
  ALTER COLUMN home_district    SET DEFAULT 'Bangalore Urban',
  ALTER COLUMN home_updated_at  SET DEFAULT now();

COMMIT;
