-- Optional business contact info — phone and website, shown on business-style
-- post cards when the poster has them set. Same snapshot pattern as
-- business_name: stored on public.users (source of truth, editable from the
-- profile) and copied onto public.tags at post-creation time so a card never
-- needs a live join to render.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_phone   text,
  ADD COLUMN IF NOT EXISTS business_website text;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS business_phone   text,
  ADD COLUMN IF NOT EXISTS business_website text;

-- Extend the signup trigger to persist these two alongside business_name.
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
    account_type, business_name, business_phone, business_website
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
    now() - interval '30 days',
    acct_type,
    nullif(new.raw_user_meta_data->>'business_name', ''),
    nullif(new.raw_user_meta_data->>'business_phone', ''),
    nullif(new.raw_user_meta_data->>'business_website', '')
  )
  on conflict (uid) do update
  set
    name              = coalesce(excluded.name, public.users.name),
    email             = coalesce(excluded.email, public.users.email),
    is_guest          = false,
    account_type      = excluded.account_type,
    business_name     = coalesce(excluded.business_name, public.users.business_name),
    business_phone    = coalesce(excluded.business_phone, public.users.business_phone),
    business_website  = coalesce(excluded.business_website, public.users.business_website);

  return new;
end;
$function$;

COMMIT;
