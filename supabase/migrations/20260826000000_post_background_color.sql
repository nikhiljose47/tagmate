-- Adds an optional background_color to posts (public.tags) so a personal
-- post can carry a preset card-background color chosen in the composer.
-- Null on every existing row and on posts where the author didn't pick one.

begin;

alter table public.tags
  add column if not exists background_color text;

commit;
