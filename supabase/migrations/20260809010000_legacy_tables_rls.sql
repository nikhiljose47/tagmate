-- Migration: Enable RLS and define security policies for legacy social tables

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'reported',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS public.user_saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.user_hidden_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.hood_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hood_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  username text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS across all legacy tables
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hood_messages ENABLE ROW LEVEL SECURITY;

-- 1. post_likes policies
DROP POLICY IF EXISTS "authenticated users read post_likes" ON public.post_likes;
CREATE POLICY "authenticated users read post_likes" ON public.post_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users manage own likes" ON public.post_likes;
CREATE POLICY "users manage own likes" ON public.post_likes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. post_rsvps policies
DROP POLICY IF EXISTS "authenticated users read post_rsvps" ON public.post_rsvps;
CREATE POLICY "authenticated users read post_rsvps" ON public.post_rsvps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users manage own rsvps" ON public.post_rsvps;
CREATE POLICY "users manage own rsvps" ON public.post_rsvps
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. post_poll_votes policies
DROP POLICY IF EXISTS "authenticated users read poll_votes" ON public.post_poll_votes;
CREATE POLICY "authenticated users read poll_votes" ON public.post_poll_votes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users manage own poll_votes" ON public.post_poll_votes;
CREATE POLICY "users manage own poll_votes" ON public.post_poll_votes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. post_reports policies
DROP POLICY IF EXISTS "reporters and admins read reports" ON public.post_reports;
CREATE POLICY "reporters and admins read reports" ON public.post_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "users submit post reports" ON public.post_reports;
CREATE POLICY "users submit post reports" ON public.post_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- 5. user_saved_posts policies
DROP POLICY IF EXISTS "users manage own saved posts" ON public.user_saved_posts;
CREATE POLICY "users manage own saved posts" ON public.user_saved_posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. user_hidden_posts policies
DROP POLICY IF EXISTS "users manage own hidden posts" ON public.user_hidden_posts;
CREATE POLICY "users manage own hidden posts" ON public.user_hidden_posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. hood_messages policies
DROP POLICY IF EXISTS "authenticated users read hood_messages" ON public.hood_messages;
CREATE POLICY "authenticated users read hood_messages" ON public.hood_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users send hood_messages" ON public.hood_messages;
CREATE POLICY "users send hood_messages" ON public.hood_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
