-- Initial schema for clean Supabase projects.
--
-- This migration intentionally precedes every feature migration.  The
-- application calls the `tags` table "posts", so the schema uses the names
-- consumed by the Angular data mappers and by the social-suite migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  uid uuid PRIMARY KEY,
  name text NOT NULL,
  email text,
  is_guest boolean NOT NULL DEFAULT false,
  reputation integer NOT NULL DEFAULT 0,
  account_type text NOT NULL DEFAULT 'personal',
  avatar_url text,
  bio text,
  home_state text,
  home_country text,
  home_district text,
  home_place text,
  home_lat double precision,
  home_lng double precision,
  home_updated_at timestamptz,
  business_name text,
  business_phone text,
  business_website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  title text,
  description text,
  highlight text NOT NULL DEFAULT '',
  tag text NOT NULL,
  category text,
  state text,
  country text,
  location text,
  location_type text NOT NULL DEFAULT 'pinpoint',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  hood_id text,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  current_status text NOT NULL DEFAULT 'active',
  status_updated_at timestamptz,
  verification_count integer NOT NULL DEFAULT 0,
  expires_in integer NOT NULL DEFAULT 10080,
  images text[] NOT NULL DEFAULT '{}',
  loves integer NOT NULL DEFAULT 0,
  dislikes integer NOT NULL DEFAULT 0,
  comments text[] NOT NULL DEFAULT '{}',
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  rsvp_count integer NOT NULL DEFAULT 0,
  event_start timestamptz,
  event_end timestamptz,
  poll_options text[],
  poll_votes jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_name text,
  business_phone text,
  business_website text,
  post_type text NOT NULL DEFAULT 'personal',
  intent text,
  price numeric,
  original_price numeric,
  availability_note text,
  cta text,
  product_link text
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  author_uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  author_name text NOT NULL,
  text text NOT NULL,
  mentions text[] NOT NULL DEFAULT '{}',
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

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
  option_index integer NOT NULL CHECK (option_index >= 0 AND option_index < 5),
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

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  post_id uuid REFERENCES public.tags(id) ON DELETE SET NULL,
  from_uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  to_uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  to_name text NOT NULL DEFAULT 'Neighbor',
  text text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  post_id uuid REFERENCES public.tags(id) ON DELETE SET NULL,
  target_type text,
  target_id text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (uid, name, email, is_guest, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'username', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'User'
    ),
    NEW.email,
    COALESCE(NEW.is_anonymous, false),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (uid) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      is_guest = EXCLUDED.is_guest;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE INDEX IF NOT EXISTS tags_created_at_idx ON public.tags (created_at DESC);
CREATE INDEX IF NOT EXISTS tags_user_id_idx ON public.tags (user_id);
CREATE INDEX IF NOT EXISTS tags_hood_id_idx ON public.tags (hood_id);
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_thread_idx ON public.direct_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_idx ON public.direct_messages (to_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
