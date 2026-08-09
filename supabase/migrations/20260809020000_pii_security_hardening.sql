-- Migration: Security hardening for user PII, self-service privilege escalation, tag updates, and storage bucket policies.

-- 1. PII Protection & Profile Access
-- PostgreSQL RLS is row-oriented, so protect sensitive columns with column
-- privileges and expose a separate self-only view for the current user's
-- private profile data.
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT uid, name, is_guest, reputation, bio, created_at, updated_at,
       account_type, business_name, business_website
FROM public.users;

CREATE OR REPLACE VIEW public.my_user_profile AS
SELECT uid, name, email, is_guest, reputation, account_type, avatar_url, bio,
       home_state, home_country, home_district, home_place, home_lat, home_lng,
       home_updated_at, business_name, business_phone, business_website,
       created_at, updated_at
FROM public.users
WHERE uid = auth.uid();

REVOKE SELECT (email, business_phone, home_lat, home_lng)
  ON public.users FROM anon, authenticated;
GRANT SELECT ON public.public_user_profiles TO anon, authenticated;
GRANT SELECT ON public.my_user_profile TO authenticated;

-- Secure users profile updates: allow ordinary profile fields, but not
-- reputation or account_type from a user-controlled REST update.
CREATE OR REPLACE FUNCTION public.validate_user_update_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Non-admins cannot alter their own reputation or account_type directly
  if pg_trigger_depth() = 1
     and (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    if new.reputation is distinct from old.reputation then
      raise exception 'Cannot self-update reputation score.';
    end if;
    if new.account_type is distinct from old.account_type then
      raise exception 'Cannot self-update account_type.';
    end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS enforce_user_update_privileges ON public.users;
CREATE TRIGGER enforce_user_update_privileges
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_update_privileges();

-- 2. Restrict Author Tag Updates (Prevent self-verification & status bypass)
CREATE OR REPLACE FUNCTION public.validate_tag_author_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Non-admins cannot self-verify posts or overwrite internal verification counters
  if pg_trigger_depth() = 1
     and (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    if new.verified is distinct from old.verified then
      raise exception 'Authors cannot modify verification status.';
    end if;
    if new.verification_count is distinct from old.verification_count then
      raise exception 'Authors cannot modify verification count.';
    end if;
    if new.current_status is distinct from old.current_status
       or new.status_updated_at is distinct from old.status_updated_at then
      raise exception 'Authors cannot bypass post status review.';
    end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS enforce_tag_author_updates ON public.tags;
CREATE TRIGGER enforce_tag_author_updates
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tag_author_updates();

-- 3. Storage Bucket Policies (storage.objects)
-- Ensure storage bucket 'tag-images' policies exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tag-images',
  'tag-images',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read tag images" ON storage.objects;
CREATE POLICY "public read tag images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'tag-images');

DROP POLICY IF EXISTS "authenticated upload tag images" ON storage.objects;
CREATE POLICY "authenticated upload tag images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tag-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "owners delete tag images" ON storage.objects;
CREATE POLICY "owners delete tag images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tag-images' AND auth.uid()::text = (storage.foldername(name))[1]);
