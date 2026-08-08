-- The client writes `location_type` on every tag insert (see tag.mapper.ts:47)
-- but the column was never added to the DB, so PGRST204 fires on every post.

BEGIN;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS location_type text
    CHECK (location_type IN ('pinpoint', 'place')) DEFAULT 'pinpoint';

COMMIT;
