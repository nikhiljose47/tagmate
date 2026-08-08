-- Periodically delete expired hot-now posts.
-- expires_in is minutes-from-created_at (see tag.mapper.ts / post.ts).
-- Runs every 20 minutes via pg_cron.

create extension if not exists pg_cron;

select cron.schedule(
  'delete-expired-hot-now-posts',
  '*/20 * * * *',
  $$
    delete from public.tags
    where tag = 'hot-now'
      and created_at + (expires_in || ' minutes')::interval < now();
  $$
);
