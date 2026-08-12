-- Follow-up hardening: least-privilege profile access plus durable interaction
-- aggregates and poll-vote validation. Safe for existing deployments.

begin;

-- A table-level SELECT grant overrides a column-level REVOKE. Remove the
-- broad grant and explicitly expose only the fields used by public profiles.
revoke select on table public.users from anon, authenticated;
grant select (
  uid, name, is_guest, reputation, bio, created_at, updated_at,
  account_type, business_name, business_website
) on table public.users to authenticated;

-- Public profiles must obey the block policy on public.users. The private
-- self-profile view intentionally remains definer-owned: it exposes sensitive
-- fields only after its auth.uid() predicate has selected the caller's row.
create or replace view public.public_user_profiles
with (security_invoker = true, security_barrier = true)
as
select uid, name, is_guest, reputation, bio, created_at, updated_at,
       account_type, business_name, business_website
from public.users;

create or replace view public.my_user_profile
with (security_barrier = true)
as
select uid, name, email, is_guest, reputation, account_type, avatar_url, bio,
       home_state, home_country, home_district, home_place, home_lat, home_lng,
       home_updated_at, business_name, business_phone, business_website,
       created_at, updated_at
from public.users
where uid = auth.uid();

revoke all on table public.public_user_profiles from public, anon;
revoke all on table public.my_user_profile from public, anon;
grant select on table public.public_user_profiles to authenticated;
grant select on table public.my_user_profile to authenticated;

-- New usernames cannot be mistaken for email addresses. Existing legacy names
-- containing @ remain usable until changed, so normal profile updates do not
-- strand those accounts.
create or replace function public.validate_username_format()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' and position('@' in new.name) > 0 then
    raise exception 'Username cannot contain @.';
  end if;
  if tg_op = 'UPDATE' and new.name is distinct from old.name and position('@' in new.name) > 0 then
    raise exception 'Username cannot contain @.';
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_username_format on public.users;
create trigger enforce_username_format
  before insert or update of name on public.users
  for each row execute function public.validate_username_format();
revoke all on function public.validate_username_format() from public, anon, authenticated;

-- Keep aggregate counters authoritative in the database so reloads and other
-- clients see the same values as the optimistic UI.
create or replace function public.sync_tag_like_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op <> 'INSERT' then
    update public.tags tag
    set like_count = (select count(*)::integer from public.post_likes where post_id = old.post_id)
    where tag.id = old.post_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.tags tag
    set like_count = (select count(*)::integer from public.post_likes where post_id = new.post_id)
    where tag.id = new.post_id;
  end if;
  return null;
end;
$function$;

create or replace function public.sync_tag_rsvp_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op <> 'INSERT' then
    update public.tags tag
    set rsvp_count = (select count(*)::integer from public.post_rsvps where post_id = old.post_id)
    where tag.id = old.post_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.tags tag
    set rsvp_count = (select count(*)::integer from public.post_rsvps where post_id = new.post_id)
    where tag.id = new.post_id;
  end if;
  return null;
end;
$function$;

create or replace function public.sync_tag_comment_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op <> 'INSERT' then
    update public.tags tag
    set comment_count = (
      select count(*)::integer
      from public.post_comments
      where post_id = old.post_id and deleted_at is null
    )
    where tag.id = old.post_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.tags tag
    set comment_count = (
      select count(*)::integer
      from public.post_comments
      where post_id = new.post_id and deleted_at is null
    )
    where tag.id = new.post_id;
  end if;
  return null;
end;
$function$;

drop trigger if exists sync_tag_like_count on public.post_likes;
create trigger sync_tag_like_count
  after insert or delete or update of post_id on public.post_likes
  for each row execute function public.sync_tag_like_count();
revoke all on function public.sync_tag_like_count() from public, anon, authenticated;

drop trigger if exists sync_tag_rsvp_count on public.post_rsvps;
create trigger sync_tag_rsvp_count
  after insert or delete or update of post_id on public.post_rsvps
  for each row execute function public.sync_tag_rsvp_count();
revoke all on function public.sync_tag_rsvp_count() from public, anon, authenticated;

drop trigger if exists sync_tag_comment_count on public.post_comments;
create trigger sync_tag_comment_count
  after insert or delete or update of post_id, deleted_at on public.post_comments
  for each row execute function public.sync_tag_comment_count();
revoke all on function public.sync_tag_comment_count() from public, anon, authenticated;

update public.tags tag
set
  like_count = (select count(*)::integer from public.post_likes where post_id = tag.id),
  comment_count = (
    select count(*)::integer
    from public.post_comments
    where post_id = tag.id and deleted_at is null
  ),
  rsvp_count = (select count(*)::integer from public.post_rsvps where post_id = tag.id);

-- A vote must belong to a real poll option. This applies to insert and the
-- conflict-update path used by client upserts.
create or replace function public.validate_poll_vote()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  option_count integer;
begin
  select cardinality(poll_options)
  into option_count
  from public.tags
  where id = new.post_id and tag = 'poll';

  if not found or option_count is null or new.option_index < 0 or new.option_index >= option_count then
    raise exception 'Poll vote must target an existing option on a poll post.';
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_poll_vote_integrity on public.post_poll_votes;
create trigger enforce_poll_vote_integrity
  before insert or update of post_id, option_index on public.post_poll_votes
  for each row execute function public.validate_poll_vote();
revoke all on function public.validate_poll_vote() from public, anon, authenticated;

-- Discard rows that could never have represented a valid vote, so historical
-- totals cannot remain inflated after the new trigger is installed.
delete from public.post_poll_votes vote
using public.tags post
where post.id = vote.post_id
  and (
    post.tag is distinct from 'poll'
    or post.poll_options is null
    or vote.option_index < 0
    or vote.option_index >= cardinality(post.poll_options)
  );

commit;
