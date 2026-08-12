-- Keep reputation and first-action quest rewards in Postgres.
-- Client metadata may still remember which badges were shown, but it never
-- becomes the source of truth for the score.

CREATE TABLE IF NOT EXISTS public.reputation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  event_type text NOT NULL,
  source_id text NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, source_id)
);

ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reputation_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_reputation(
  target_user_id uuid,
  reward_type text,
  reward_source text,
  reward_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF target_user_id IS NULL OR reward_points = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.reputation_events (user_id, event_type, source_id, points)
  VALUES (target_user_id, reward_type, reward_source, reward_points)
  ON CONFLICT (user_id, event_type, source_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.users
    SET reputation = GREATEST(0, reputation + reward_points),
        updated_at = now()
    WHERE uid = target_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_reputation(uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reward_like_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM public.tags WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.award_reputation(post_owner, 'post_like_received', NEW.id::text, 1);
  END IF;
  PERFORM public.award_reputation(NEW.user_id, 'quest_love', 'first-action', 5);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_comment_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_reputation(NEW.author_uid, 'comment_created', NEW.id::text, 1);
  PERFORM public.award_reputation(NEW.author_uid, 'quest_comment', 'first-action', 5);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_poll_voter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_reputation(NEW.user_id, 'quest_poll', 'first-action', 5);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_rsvp_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_reputation(NEW.user_id, 'quest_rsvp', 'first-action', 5);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS award_reputation_for_like ON public.post_likes;
CREATE TRIGGER award_reputation_for_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.reward_like_participants();

DROP TRIGGER IF EXISTS award_reputation_for_comment ON public.post_comments;
CREATE TRIGGER award_reputation_for_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.reward_comment_author();

DROP TRIGGER IF EXISTS award_reputation_for_poll_vote ON public.post_poll_votes;
CREATE TRIGGER award_reputation_for_poll_vote
  AFTER INSERT ON public.post_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.reward_poll_voter();

DROP TRIGGER IF EXISTS award_reputation_for_rsvp ON public.post_rsvps;
CREATE TRIGGER award_reputation_for_rsvp
  AFTER INSERT ON public.post_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.reward_rsvp_user();
