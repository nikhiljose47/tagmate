-- Poll data used by question-tag posts. Existing deployments predate these
-- columns, so keep this migration additive and safe to run once per project.
alter table public.tags
  add column if not exists poll_options text[];

alter table public.tags
  add column if not exists poll_votes jsonb not null default '{}'::jsonb;

alter table public.tags
  drop constraint if exists tags_poll_options_size_check;

alter table public.tags
  add constraint tags_poll_options_size_check
  check (poll_options is null or cardinality(poll_options) between 2 and 5);
