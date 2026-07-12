-- TagMate social suite: public profiles, follows, safety, durable notifications,
-- comment reactions, conversation state, and verified local updates.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Public profile fields. Email remains private and is never selected by the
-- public-profile client queries introduced with this migration.
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- Efficient status rendering on every post surface; immutable history lives in
-- post_status_history below.
alter table public.tags add column if not exists current_status text not null default 'active';
alter table public.tags add column if not exists status_updated_at timestamptz;
alter table public.tags add column if not exists verification_count integer not null default 0;

do $$ begin
  alter table public.tags
    add constraint tags_current_status_check
    check (current_status in ('active', 'resolved', 'cancelled', 'closed'));
exception when duplicate_object then null;
end $$;

-- Existing installations use boolean read fields. Keep them for compatibility,
-- while read_at becomes the source of truth for new clients.
alter table public.notifications add column if not exists actor_id uuid references public.users(uid) on delete set null;
alter table public.notifications add column if not exists target_type text;
alter table public.notifications add column if not exists target_id text;
alter table public.notifications add column if not exists read_at timestamptz;
update public.notifications set read_at = coalesce(read_at, created_at)
where read = true and read_at is null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in ('reply','mention','love','follow','alert','rsvp','message','verification','status')
);

alter table public.direct_messages add column if not exists read_at timestamptz;
update public.direct_messages set read_at = coalesce(read_at, created_at)
where read = true and read_at is null;

alter table public.post_comments add column if not exists updated_at timestamptz;
alter table public.post_comments add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Social graph and safety
-- ---------------------------------------------------------------------------
create table if not exists public.user_follows (
  follower_id uuid not null references public.users(uid) on delete cascade,
  followed_user_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_user_id),
  constraint user_follows_not_self check (follower_id <> followed_user_id)
);

create table if not exists public.user_followed_hoods (
  user_id uuid not null references public.users(uid) on delete cascade,
  hood_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, hood_id),
  constraint followed_hood_nonempty check (length(trim(hood_id)) > 0)
);

create table if not exists public.user_followed_topics (
  user_id uuid not null references public.users(uid) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag),
  constraint followed_topic_nonempty check (length(trim(tag)) > 0)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(uid) on delete cascade,
  blocked_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.muted_threads (
  user_id uuid not null references public.users(uid) on delete cascade,
  thread_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references public.users(uid) on delete cascade,
  reporter_id uuid not null references public.users(uid) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  unique (reported_user_id, reporter_id),
  constraint user_reports_not_self check (reported_user_id <> reporter_id)
);

create index if not exists user_follows_followed_idx on public.user_follows(followed_user_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);
create index if not exists followed_hoods_hood_idx on public.user_followed_hoods(hood_id);
create index if not exists followed_topics_tag_idx on public.user_followed_topics(tag);

create or replace function public.users_are_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.users_are_blocked(uuid, uuid) from public;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Durable comment reactions and reports
-- ---------------------------------------------------------------------------
create table if not exists public.post_comment_reactions (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  reporter_id uuid not null references public.users(uid) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create or replace function public.sync_comment_upvotes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.post_comments
  set upvotes = (select count(*) from public.post_comment_reactions where comment_id = coalesce(new.comment_id, old.comment_id))
  where id = coalesce(new.comment_id, old.comment_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sync_comment_upvotes_trigger on public.post_comment_reactions;
create trigger sync_comment_upvotes_trigger
after insert or delete on public.post_comment_reactions
for each row execute function public.sync_comment_upvotes();

-- ---------------------------------------------------------------------------
-- DM safety/reporting
-- ---------------------------------------------------------------------------
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  reporter_id uuid not null references public.users(uid) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- ---------------------------------------------------------------------------
-- Verification and status history
-- ---------------------------------------------------------------------------
create table if not exists public.post_confirmations (
  post_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references public.users(uid) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_status_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.tags(id) on delete cascade,
  actor_id uuid references public.users(uid) on delete set null,
  status text not null check (status in ('active', 'resolved', 'cancelled', 'closed')),
  note text check (note is null or length(note) <= 250),
  created_at timestamptz not null default now()
);

create index if not exists post_confirmations_post_idx on public.post_confirmations(post_id, created_at desc);
create index if not exists post_status_history_post_idx on public.post_status_history(post_id, created_at desc);

create or replace function public.is_actionable_tag(tag_value text)
returns boolean language sql immutable as $$
  select tag_value = any(array[
    'alert','traffic','weather','utility','event','sale','market','shopping',
    'business','health','question'
  ]);
$$;

create or replace function public.sync_post_confirmation_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tags
  set verification_count = (select count(*) from public.post_confirmations where post_id = coalesce(new.post_id, old.post_id))
  where id = coalesce(new.post_id, old.post_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sync_post_confirmation_count_trigger on public.post_confirmations;
create trigger sync_post_confirmation_count_trigger
after insert or delete on public.post_confirmations
for each row execute function public.sync_post_confirmation_count();

create or replace function public.sync_post_current_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tags
  set current_status = new.status, status_updated_at = new.created_at
  where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists sync_post_current_status_trigger on public.post_status_history;
create trigger sync_post_current_status_trigger
after insert on public.post_status_history
for each row execute function public.sync_post_current_status();

-- ---------------------------------------------------------------------------
-- Notification creation. The helper rejects self-notifications and contact
-- across a block relationship.
-- ---------------------------------------------------------------------------
create or replace function public.create_social_notification(
  recipient uuid,
  actor uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  notification_target_type text,
  notification_target_id text,
  notification_post_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient is null or recipient = actor or public.users_are_blocked(recipient, actor) then
    return;
  end if;
  insert into public.notifications (
    user_id, actor_id, type, title, body, post_id, target_type, target_id,
    read, read_at, created_at
  ) values (
    recipient, actor, notification_type, notification_title, notification_body,
    notification_post_id, notification_target_type, notification_target_id,
    false, null, now()
  );
end;
$$;

create or replace function public.notify_post_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_name text;
begin
  select user_id into owner_id from public.tags where id = new.post_id;
  select name into actor_name from public.users where uid = new.user_id;
  perform public.create_social_notification(owner_id, new.user_id, 'love', 'New like',
    coalesce(actor_name, 'A neighbor') || ' liked your post.', 'post', new.post_id::text, new.post_id);
  return new;
end;
$$;
drop trigger if exists notify_post_like_trigger on public.post_likes;
create trigger notify_post_like_trigger after insert on public.post_likes
for each row execute function public.notify_post_like();

create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  select name into actor_name from public.users where uid = new.follower_id;
  perform public.create_social_notification(new.followed_user_id, new.follower_id, 'follow', 'New follower',
    coalesce(actor_name, 'A neighbor') || ' followed you.', 'user', new.follower_id::text, null);
  return new;
end;
$$;
drop trigger if exists notify_follow_trigger on public.user_follows;
create trigger notify_follow_trigger after insert on public.user_follows
for each row execute function public.notify_follow();

create or replace function public.notify_direct_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  if exists (select 1 from public.muted_threads where user_id = new.to_uid and thread_id = new.thread_id) then
    return new;
  end if;
  select name into actor_name from public.users where uid = new.from_uid;
  perform public.create_social_notification(new.to_uid, new.from_uid, 'message', 'New message',
    coalesce(actor_name, 'A neighbor') || ' sent you a message.', 'thread', new.thread_id, new.post_id);
  return new;
end;
$$;
drop trigger if exists notify_direct_message_trigger on public.direct_messages;
create trigger notify_direct_message_trigger after insert on public.direct_messages
for each row execute function public.notify_direct_message();

create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare post_owner uuid; reply_owner uuid; mentioned_user record;
begin
  select user_id into post_owner from public.tags where id = new.post_id;
  if new.parent_id is not null then
    select author_uid into reply_owner from public.post_comments where id = new.parent_id;
    perform public.create_social_notification(reply_owner, new.author_uid, 'reply', 'New reply',
      coalesce(new.author_name, 'A neighbor') || ' replied to your comment.', 'comment', new.id::text, new.post_id);
  else
    perform public.create_social_notification(post_owner, new.author_uid, 'reply', 'New comment',
      coalesce(new.author_name, 'A neighbor') || ' commented on your post.', 'comment', new.id::text, new.post_id);
  end if;
  for mentioned_user in select uid from public.users where lower(name) = any(
    select lower(value) from unnest(coalesce(new.mentions, array[]::text[])) value
  ) loop
    perform public.create_social_notification(mentioned_user.uid, new.author_uid, 'mention', 'You were mentioned',
      coalesce(new.author_name, 'A neighbor') || ' mentioned you in a comment.', 'comment', new.id::text, new.post_id);
  end loop;
  return new;
end;
$$;
drop trigger if exists notify_post_comment_trigger on public.post_comments;
create trigger notify_post_comment_trigger after insert on public.post_comments
for each row execute function public.notify_post_comment();

create or replace function public.notify_post_confirmation()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_name text;
begin
  select user_id into owner_id from public.tags where id = new.post_id;
  select name into actor_name from public.users where uid = new.user_id;
  perform public.create_social_notification(owner_id, new.user_id, 'verification', 'Update confirmed',
    coalesce(actor_name, 'A neighbor') || ' confirmed your update.', 'post', new.post_id::text, new.post_id);
  return new;
end;
$$;
drop trigger if exists notify_post_confirmation_trigger on public.post_confirmations;
create trigger notify_post_confirmation_trigger after insert on public.post_confirmations
for each row execute function public.notify_post_confirmation();

create or replace function public.notify_post_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid; actor_name text;
begin
  select user_id into owner_id from public.tags where id = new.post_id;
  select name into actor_name from public.users where uid = new.user_id;
  perform public.create_social_notification(owner_id, new.user_id, 'rsvp', 'New RSVP',
    coalesce(actor_name, 'A neighbor') || ' is going to your event.', 'post', new.post_id::text, new.post_id);
  return new;
end;
$$;
drop trigger if exists notify_post_rsvp_trigger on public.post_rsvps;
create trigger notify_post_rsvp_trigger after insert on public.post_rsvps
for each row execute function public.notify_post_rsvp();

create or replace function public.notify_post_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare confirmer record; actor_name text;
begin
  select name into actor_name from public.users where uid = new.actor_id;
  for confirmer in select user_id from public.post_confirmations where post_id = new.post_id loop
    perform public.create_social_notification(confirmer.user_id, new.actor_id, 'status', 'Update status changed',
      coalesce(actor_name, 'The author') || ' marked an update ' || new.status || '.', 'post', new.post_id::text, new.post_id);
  end loop;
  return new;
end;
$$;
drop trigger if exists notify_post_status_trigger on public.post_status_history;
create trigger notify_post_status_trigger after insert on public.post_status_history
for each row execute function public.notify_post_status();

-- ---------------------------------------------------------------------------
-- Following feed RPC. Chronological and transparent by design.
-- ---------------------------------------------------------------------------
create or replace function public.fetch_following_feed(page_limit integer default 25, page_offset integer default 0, query text default null)
returns setof public.tags
language sql
stable
security invoker
set search_path = public
as $$
  select t.* from public.tags t
  where auth.uid() is not null
    and t.tag <> 'bulletin'
    and not public.users_are_blocked(auth.uid(), t.user_id)
    and not exists (
      select 1 from public.user_hidden_posts h where h.user_id = auth.uid() and h.post_id = t.id
    )
    and (
      exists (select 1 from public.user_follows f where f.follower_id = auth.uid() and f.followed_user_id = t.user_id)
      or exists (select 1 from public.user_followed_hoods h where h.user_id = auth.uid() and lower(h.hood_id) = lower(t.hood_id))
      or exists (select 1 from public.user_followed_topics ft where ft.user_id = auth.uid() and ft.tag = t.tag)
    )
    and (
      query is null or trim(query) = '' or
      t.highlight ilike '%' || query || '%' or t.username ilike '%' || query || '%' or
      t.tag ilike '%' || query || '%' or t.hood_id ilike '%' || query || '%'
    )
  order by t.created_at desc
  limit greatest(1, least(page_limit, 100))
  offset greatest(page_offset, 0);
$$;
grant execute on function public.fetch_following_feed(integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.tags enable row level security;
alter table public.post_comments enable row level security;
alter table public.direct_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_followed_hoods enable row level security;
alter table public.user_followed_topics enable row level security;
alter table public.user_blocks enable row level security;
alter table public.muted_threads enable row level security;
alter table public.user_reports enable row level security;
alter table public.post_comment_reactions enable row level security;
alter table public.comment_reports enable row level security;
alter table public.message_reports enable row level security;
alter table public.post_confirmations enable row level security;
alter table public.post_status_history enable row level security;

-- Baseline policies for legacy tables. Restrictive block policies below apply
-- in addition to these permissions.
drop policy if exists "authenticated users read public profiles" on public.users;
create policy "authenticated users read public profiles" on public.users for select to authenticated using (true);
drop policy if exists "users update own profile" on public.users;
create policy "users update own profile" on public.users for update to authenticated
using (uid = auth.uid()) with check (uid = auth.uid());
drop policy if exists "users insert own profile" on public.users;
create policy "users insert own profile" on public.users for insert to authenticated with check (uid = auth.uid());

drop policy if exists "authenticated users read tags" on public.tags;
create policy "authenticated users read tags" on public.tags for select to authenticated using (true);
drop policy if exists "authenticated users read comments" on public.post_comments;
create policy "authenticated users read comments" on public.post_comments for select to authenticated using (true);
drop policy if exists "authors create comments" on public.post_comments;
create policy "authors create comments" on public.post_comments for insert to authenticated with check (author_uid = auth.uid());
drop policy if exists "participants read direct messages" on public.direct_messages;
create policy "participants read direct messages" on public.direct_messages for select to authenticated
using (from_uid = auth.uid() or to_uid = auth.uid());

drop policy if exists "manage own user follows" on public.user_follows;
create policy "manage own user follows" on public.user_follows for all to authenticated
using (follower_id = auth.uid())
with check (follower_id = auth.uid() and not public.users_are_blocked(follower_id, followed_user_id));

drop policy if exists "manage own hood follows" on public.user_followed_hoods;
create policy "manage own hood follows" on public.user_followed_hoods for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "manage own topic follows" on public.user_followed_topics;
create policy "manage own topic follows" on public.user_followed_topics for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "manage own blocks" on public.user_blocks;
create policy "manage own blocks" on public.user_blocks for all to authenticated
using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

drop policy if exists "manage own muted threads" on public.muted_threads;
create policy "manage own muted threads" on public.muted_threads for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "create own user reports" on public.user_reports;
create policy "create own user reports" on public.user_reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists "read own user reports" on public.user_reports;
create policy "read own user reports" on public.user_reports for select to authenticated
using (reporter_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "read comment reactions" on public.post_comment_reactions;
create policy "read comment reactions" on public.post_comment_reactions for select to authenticated using (true);
drop policy if exists "manage own comment reactions" on public.post_comment_reactions;
create policy "manage own comment reactions" on public.post_comment_reactions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "create own comment reports" on public.comment_reports;
create policy "create own comment reports" on public.comment_reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists "read own comment reports" on public.comment_reports;
create policy "read own comment reports" on public.comment_reports for select to authenticated
using (reporter_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "create own message reports" on public.message_reports;
create policy "create own message reports" on public.message_reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists "read own message reports" on public.message_reports;
create policy "read own message reports" on public.message_reports for select to authenticated
using (reporter_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "read post confirmations" on public.post_confirmations;
create policy "read post confirmations" on public.post_confirmations for select to authenticated using (true);
drop policy if exists "manage own post confirmations" on public.post_confirmations;
create policy "manage own post confirmations" on public.post_confirmations for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid() and exists (
    select 1 from public.tags t where t.id = post_id and t.user_id <> auth.uid() and public.is_actionable_tag(t.tag)
  )
);

drop policy if exists "read post status history" on public.post_status_history;
create policy "read post status history" on public.post_status_history for select to authenticated using (true);
drop policy if exists "authors update post status" on public.post_status_history;
create policy "authors update post status" on public.post_status_history for insert to authenticated
with check (
  actor_id = auth.uid() and exists (
    select 1 from public.tags t where t.id = post_id and public.is_actionable_tag(t.tag)
      and (t.user_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      and (t.tag = 'question' or status <> 'closed')
      and (t.tag <> 'question' or status in ('active','closed'))
  )
);

-- Blocks are an authorization rule, not merely a client-side preference.
-- Restrictive policies compose with legacy permissive policies on existing
-- installations and keep old routes from leaking blocked people.
drop policy if exists "blocked profiles stay private" on public.users;
create policy "blocked profiles stay private" on public.users as restrictive for select to authenticated
using (uid = auth.uid() or not public.users_are_blocked(auth.uid(), uid));

drop policy if exists "blocked posts stay hidden" on public.tags;
create policy "blocked posts stay hidden" on public.tags as restrictive for select to authenticated
using (not public.users_are_blocked(auth.uid(), user_id));

drop policy if exists "blocked comments stay hidden" on public.post_comments;
create policy "blocked comments stay hidden" on public.post_comments as restrictive for select to authenticated
using (not public.users_are_blocked(auth.uid(), author_uid));
drop policy if exists "mentions respect blocks" on public.post_comments;
create policy "mentions respect blocks" on public.post_comments as restrictive for insert to authenticated
with check (not exists (
  select 1 from public.users u
  where lower(u.name) = any(select lower(value) from unnest(coalesce(mentions, array[]::text[])) value)
    and public.users_are_blocked(auth.uid(), u.uid)
));
drop policy if exists "authors edit own comments" on public.post_comments;
create policy "authors edit own comments" on public.post_comments for update to authenticated
using (author_uid = auth.uid()) with check (author_uid = auth.uid());
drop policy if exists "authors delete own comments" on public.post_comments;
create policy "authors delete own comments" on public.post_comments for delete to authenticated
using (author_uid = auth.uid());

-- Tighten existing message writes without removing existing select policies.
drop policy if exists "participants send direct messages" on public.direct_messages;
create policy "participants send direct messages" on public.direct_messages for insert to authenticated
with check (from_uid = auth.uid() and not public.users_are_blocked(from_uid, to_uid));
drop policy if exists "blocked users cannot send direct messages" on public.direct_messages;
create policy "blocked users cannot send direct messages" on public.direct_messages as restrictive for insert to authenticated
with check (not public.users_are_blocked(from_uid, to_uid));
drop policy if exists "recipients update direct messages" on public.direct_messages;
create policy "recipients update direct messages" on public.direct_messages for update to authenticated
using (to_uid = auth.uid()) with check (to_uid = auth.uid());

-- Notification clients may only read/update their own rows. Trigger functions
-- run as definer and can create recipient notifications.
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated
using (user_id = auth.uid());
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users create own local notifications" on public.notifications;
create policy "users create own local notifications" on public.notifications for insert to authenticated
with check (user_id = auth.uid() and actor_id is null);

-- Publish new realtime tables when they are not already members.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'user_follows','user_blocks','post_comment_reactions','post_confirmations','post_status_history'
  ] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
