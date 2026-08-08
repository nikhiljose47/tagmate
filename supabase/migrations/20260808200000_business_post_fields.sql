-- Structured business-post fields (price/availability/CTA/link/intent) plus
-- the missing owner-scoped RLS policies for public.tags (SELECT + admin-only
-- DELETE existed; INSERT/UPDATE/DELETE-by-owner did not, per the security
-- audit in supabase_first_review.md).

BEGIN;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS intent            text,
  ADD COLUMN IF NOT EXISTS price             numeric,
  ADD COLUMN IF NOT EXISTS original_price    numeric,
  ADD COLUMN IF NOT EXISTS availability_note text,
  ADD COLUMN IF NOT EXISTS cta               text,
  ADD COLUMN IF NOT EXISTS product_link      text;

ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_intent_check;
ALTER TABLE public.tags
  ADD CONSTRAINT tags_intent_check
  CHECK (intent IS NULL OR intent IN (
    'offer', 'available_now', 'open_slot', 'happening', 'looking_for', 'sell_give'
  ));

ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_cta_check;
ALTER TABLE public.tags
  ADD CONSTRAINT tags_cta_check
  CHECK (cta IS NULL OR cta IN (
    'message', 'call', 'whatsapp', 'directions', 'visit_shop',
    'view_product', 'book', 'join', 'interested'
  ));

-- Owner-scoped write policies — SELECT and admin-DELETE already existed
-- (20260710000000_security_hardening.sql, 20260712000000_social_suite.sql);
-- this fills the gap for normal users creating/editing/removing their own posts.
DROP POLICY IF EXISTS "authors insert own tags" ON public.tags;
CREATE POLICY "authors insert own tags"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "authors update own tags" ON public.tags;
CREATE POLICY "authors update own tags"
  ON public.tags FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "authors delete own tags" ON public.tags;
CREATE POLICY "authors delete own tags"
  ON public.tags FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

COMMIT;
