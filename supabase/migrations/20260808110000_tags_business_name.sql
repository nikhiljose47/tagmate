-- Snapshot the poster's business name onto the post, same pattern as
-- `username` — read at post-creation time from public.users, not joined live.
-- Null for posts made by a personal account.

BEGIN;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS business_name text;

COMMIT;
