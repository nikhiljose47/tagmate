-- Migration: Idempotent cron expiration and foreign key / functional index optimizations

-- 1. Idempotent Cron Job for Expiring Tags (Soft status update instead of hard delete)
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('delete-expired-hot-now-posts');
    PERFORM cron.unschedule('expire-tagmate-posts');
    PERFORM cron.schedule(
      'expire-tagmate-posts',
      '*/15 * * * *',
      $job$
        UPDATE public.tags
        SET current_status = 'closed',
            status_updated_at = now()
        WHERE current_status = 'active'
          AND expires_in IS NOT NULL
          AND expires_in >= 0
          AND created_at + make_interval(mins => expires_in) < now();
      $job$
    );
  END IF;
EXCEPTION WHEN undefined_function THEN NULL;
END $do$;

-- 2. Foreign Key Indexes & Index-Defeating Functional Indexes
CREATE INDEX IF NOT EXISTS tags_user_id_idx ON public.tags (user_id);
CREATE INDEX IF NOT EXISTS tags_hood_id_idx ON public.tags (hood_id);
CREATE INDEX IF NOT EXISTS tags_created_at_idx ON public.tags (created_at DESC);

CREATE INDEX IF NOT EXISTS user_followed_hoods_user_id_idx ON public.user_followed_hoods (user_id);
CREATE INDEX IF NOT EXISTS user_followed_topics_user_id_idx ON public.user_followed_topics (user_id);
CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx ON public.user_follows (follower_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocker_id_idx ON public.user_blocks (blocker_id);

-- Functional indexes for lower(hood_id) queries in fetch_following_feed
CREATE INDEX IF NOT EXISTS user_followed_hoods_lower_hood_idx ON public.user_followed_hoods (lower(hood_id));
CREATE INDEX IF NOT EXISTS tags_lower_hood_idx ON public.tags (lower(hood_id));
