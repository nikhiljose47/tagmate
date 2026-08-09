-- Periodically close expired posts without destroying their history.
-- expires_in is minutes-from-created_at (see tag.mapper.ts / post.ts).
-- The job is safe to re-run and covers every expiring tag category.

create extension if not exists pg_cron;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('delete-expired-hot-now-posts');
    PERFORM cron.schedule(
      'delete-expired-hot-now-posts',
      '*/20 * * * *',
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
