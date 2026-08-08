alter table public.tags
  add column if not exists post_type text not null default 'personal';

alter table public.tags
  drop constraint if exists tags_post_type_check;

alter table public.tags
  add constraint tags_post_type_check
  check (post_type in ('personal', 'business'));

create index if not exists tags_post_type_created_at_idx
  on public.tags (post_type, created_at desc);
