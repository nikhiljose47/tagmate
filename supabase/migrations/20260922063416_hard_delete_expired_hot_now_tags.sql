-- Hot-now tags are meant to disappear, not linger closed. The existing
-- pg_cron job only sets tags.current_status='closed' on expiry; hot-now
-- posts get hard-deleted from the table 2 hours after created_at instead,
-- matching the fixed 120-minute expiresIn the composer assigns them
-- (see toggleHotNow() in post.ts).

begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-expired-hot-now-tags') then
    perform cron.unschedule('delete-expired-hot-now-tags');
  end if;
end $$;

select cron.schedule(
  'delete-expired-hot-now-tags',
  '*/15 * * * *',
  $$delete from public.tags where tag = 'hot-now' and created_at + interval '2 hours' < now()$$
);

commit;
