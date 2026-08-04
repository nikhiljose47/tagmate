-- Home hood for every user: state + country + district are required,
-- place is optional. Users can only change their home hood once every 30 days,
-- enforced by a BEFORE UPDATE trigger.

BEGIN;

-- 1. Add columns (nullable for now — backfill happens next).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_state       text,
  ADD COLUMN IF NOT EXISTS home_country     text,
  ADD COLUMN IF NOT EXISTS home_district    text,
  ADD COLUMN IF NOT EXISTS home_place       text,
  ADD COLUMN IF NOT EXISTS home_lat         double precision,
  ADD COLUMN IF NOT EXISTS home_lng         double precision,
  ADD COLUMN IF NOT EXISTS home_updated_at  timestamptz;

-- 2. Backfill: every existing user (only ~10 today) gets Marathahalli / Bangalore
--    Urban / Karnataka / India — the same default the client currently uses.
UPDATE public.users
SET
  home_state      = COALESCE(home_state,      'Karnataka'),
  home_country    = COALESCE(home_country,    'India'),
  home_district   = COALESCE(home_district,   'Bangalore Urban'),
  home_place      = COALESCE(home_place,      'Marathahalli'),
  home_lat        = COALESCE(home_lat,        12.952),
  home_lng        = COALESCE(home_lng,        77.7),
  home_updated_at = COALESCE(home_updated_at, now())
WHERE home_state IS NULL
   OR home_country IS NULL
   OR home_district IS NULL
   OR home_updated_at IS NULL;

-- 3. Enforce NOT NULL on the required columns.
ALTER TABLE public.users
  ALTER COLUMN home_state      SET NOT NULL,
  ALTER COLUMN home_country    SET NOT NULL,
  ALTER COLUMN home_district   SET NOT NULL,
  ALTER COLUMN home_updated_at SET NOT NULL,
  ALTER COLUMN home_updated_at SET DEFAULT now();

-- 4. Once-per-30-days enforcement.
CREATE OR REPLACE FUNCTION public.enforce_home_hood_cooldown()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.home_state    IS DISTINCT FROM OLD.home_state    OR
    NEW.home_country  IS DISTINCT FROM OLD.home_country  OR
    NEW.home_district IS DISTINCT FROM OLD.home_district OR
    NEW.home_place    IS DISTINCT FROM OLD.home_place    OR
    NEW.home_lat      IS DISTINCT FROM OLD.home_lat      OR
    NEW.home_lng      IS DISTINCT FROM OLD.home_lng
  ) THEN
    IF OLD.home_updated_at IS NOT NULL
       AND (now() - OLD.home_updated_at) < interval '30 days' THEN
      RAISE EXCEPTION
        'HOME_HOOD_COOLDOWN: home hood can only be changed once every 30 days (last change: %)',
        OLD.home_updated_at
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.home_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_home_hood_cooldown ON public.users;
CREATE TRIGGER trg_users_home_hood_cooldown
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_home_hood_cooldown();

COMMIT;
