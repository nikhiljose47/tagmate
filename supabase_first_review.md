# Supabase First-Level Review

## 1. Application overview

Tagmate is an Angular/Supabase social neighbourhood application. The primary post object is currently named `public.tags`, not `posts`; code and migrations treat `tags` as the feed/post table. The app supports public profiles, location-based posts, comments, likes, polls, RSVPs, saves, hides, reports, notifications, direct messages, neighbourhood chat, follows, topic/hood follows, blocks, muted threads, and post status/verification flows.

Live database catalog access was not available from this workspace: there is no local `psql`/Supabase CLI connection configuration, and Supabase REST with the anon client cannot query `information_schema` or `pg_catalog`. I did not select application rows. Findings below are based on project code, visible migrations, service/repository usage, and the checked-in table list at `src/info/supabase-tables.txt`. Run the metadata SQL from the original request in the Supabase SQL Editor to confirm the live deployed state.

Visible roles:

| Role | Evidence | Apparent purpose |
| --- | --- | --- |
| Guest | `is_guest`, guest auth flows | Can use limited app/session flows; durable social writes generally require authenticated UID. |
| Authenticated user | RLS policies `to authenticated`; app session UID checks | Create profiles, posts, comments, likes, saves, messages, reports, follows, blocks, notifications. |
| Administrator | `auth.jwt() -> app_metadata ->> role = 'admin'` | Can read reports and delete tags/posts through admin policy. |

No service-provider, business-owner, booking-manager, or moderator role was visible in the code reviewed.

## 2. Existing feature summary

| Feature | Status | Main tables/objects |
| --- | --- | --- |
| User profiles | Implemented | `users`, `auth.users` via UID convention |
| Posts/feed/tags | Implemented | `tags`; no separate `posts` table found in code/migrations |
| Comments/replies | Implemented | `post_comments`, `post_comment_reactions`, `comment_reports` |
| Likes | Implemented | `post_likes`, triggers update notifications |
| Polls | Partially implemented | `tags.poll_options`, `tags.poll_votes`, `post_poll_votes` |
| Event RSVPs | Implemented | `post_rsvps`, triggers update notifications |
| Saved posts | Implemented | `user_saved_posts` |
| Hidden posts | Implemented | `user_hidden_posts` |
| Reports/moderation queue | Implemented | `post_reports`, `comment_reports`, `message_reports`, `user_reports` |
| Notifications | Implemented | `notifications`, notification trigger functions |
| Neighbourhood/community posts | Implemented | `tags.hood_id`, `hood_messages`, `user_followed_hoods` |
| Following/blocking | Implemented | `user_follows`, `user_blocks`, `user_followed_topics`, `muted_threads` |
| Direct messaging | Implemented | `direct_messages`, `message_reports`, `muted_threads` |
| Conversation lists | Partially implemented | Derived from `direct_messages.thread_id`; no `conversations` table visible |
| Group messaging | Referenced but database support is unclear | No group/conversation participant table visible |
| Message attachments | Not found | No message attachment table or storage bucket usage found |
| Message read status | Implemented | `direct_messages.read`, `direct_messages.read_at` |
| Message deletion | Not found | No delete/soft-delete message flow found |
| Service listings/categories/providers | Not found | No service tables visible |
| Bookings/availability/pricing/reviews | Not found | No booking/service tables visible |
| Addresses/payments/refunds | Not found | No service/payment tables visible |
| Location search | Implemented outside DB | Nominatim edge function/proxy; post lat/lng/hood/state/country fields |
| Upload files | Implemented for posts | Storage bucket `tag-images` via `StorageService` |

Simple access summary:

| Action | Apparent access |
| --- | --- |
| View profiles | Authenticated users can read public profiles, restricted by block policy. |
| Create/edit posts | Needs confirmation. Code creates/updates `tags`; migrations shown only include read/delete admin policies, not full owner insert/update policies. |
| Create comments/likes | Comments: author UID must equal `auth.uid()`. Likes: Needs confirmation for base `post_likes` RLS, not visible in migrations. |
| Read direct messages | Participants only, via `from_uid = auth.uid()` or `to_uid = auth.uid()`. |
| Update notifications | Owner only, `user_id = auth.uid()`. |
| Create service listings | Not found. |
| Manage bookings | Not found. |
| Upload files | Needs confirmation. Code uploads to `tag-images`; storage bucket policies were not available. |

## 3. Public table summary

Known/visible core tables:

- `direct_messages`
- `hood_messages`
- `notifications`
- `post_comments`
- `post_likes`
- `post_poll_votes`
- `post_reports`
- `post_rsvps`
- `tags`
- `user_hidden_posts`
- `user_saved_posts`
- `users`

Additional social-suite tables from migrations:

- `comment_reports`
- `message_reports`
- `muted_threads`
- `post_comment_reactions`
- `post_confirmations`
- `post_status_history`
- `user_blocks`
- `user_followed_hoods`
- `user_followed_topics`
- `user_follows`
- `user_reports`

Main posts object: code consistently uses `public.tags` as the posts/feed table. No `public.posts` table or view was found in the project files reviewed.

Important columns inferred from code:

- `tags`: `id`, `user_id`, `username`, `highlight`, `lat`, `lng`, `expires_in`, `tag`, `created_at`, `images`, `hood_id`, `state`, `country`, poll fields, aggregate counts, status fields.
- `users`: `uid`, `name`, `is_guest`, `email`, `reputation`, `bio`, timestamps.
- `direct_messages`: `id`, `thread_id`, `post_id`, `from_uid`, `to_uid`, `to_name`, `text`, `read`, `read_at`, `created_at`.
- `post_comments`: `id`, `post_id`, `parent_id`, `author_uid`, `author_name`, `text`, `mentions`, `upvotes`, timestamps, `deleted_at`.
- `notifications`: `id`, `user_id`, `type`, `title`, `body`, `post_id`, `actor_id`, `target_type`, `target_id`, `read`, `read_at`, `created_at`.

## 4. Important relationships

Visible migrations define foreign keys for newer tables:

- Social graph tables reference `public.users(uid)`.
- `post_comment_reactions.comment_id` references `post_comments(id)`.
- `comment_reports.comment_id` references `post_comments(id)`.
- `message_reports.message_id` references `direct_messages(id)`.
- `post_confirmations.post_id` and `post_status_history.post_id` reference `tags(id)`.
- Notification actor fields reference `users(uid)`.

Needs live confirmation:

- Whether base tables (`tags`, `post_comments`, `direct_messages`, `post_likes`, `post_rsvps`, `post_reports`, `user_saved_posts`, `user_hidden_posts`, `post_poll_votes`, `hood_messages`, `notifications`, `users`) all have primary keys and foreign keys in the deployed database.
- Whether `users.uid` has a foreign key to `auth.users(id)`. The app assumes the values match, but the visible migrations do not show that base constraint.
- Whether duplicate likes/saves/RSVPs/poll votes/reports are prevented on all legacy social tables. Newer tables use primary keys or unique constraints; legacy tables need metadata confirmation.

## 5. RLS and security findings

Positive findings:

- RLS is enabled in migrations for `users`, `tags`, `post_comments`, `direct_messages`, `notifications`, and the newer social graph/report/status tables.
- Direct-message reads are participant-limited.
- Direct-message inserts require `from_uid = auth.uid()` and reject blocked users.
- Notification reads/updates are owner-limited.
- Profile updates/inserts are owner-limited.
- Comment inserts/updates/deletes are author-limited.
- Block relationships are enforced with restrictive policies on profiles, posts, comments, and message inserts.
- Admin authorization uses `app_metadata.role`, not user-editable metadata.

Findings:

| Priority | Affected table/object | Problem | Recommended action |
| --- | --- | --- | --- |
| Fix now | `post_likes`, `post_rsvps`, `post_poll_votes`, `post_reports`, `user_saved_posts`, `user_hidden_posts`, `hood_messages` | RLS policies for these legacy tables are not visible in the migrations reviewed. The app writes to them from the frontend. | Run the requested `pg_policies` query and confirm each table has owner/participant policies. Add policies if missing. |
| Fix now | `tags` | Migrations reviewed show broad authenticated read and admin delete, but not owner insert/update/delete policies for normal users. | Confirm deployed `tags` insert/update/delete RLS. Ensure users can insert/update/delete only their own `user_id = auth.uid()` rows. |
| Fix now | `users` | `users.uid` to `auth.users.id` relationship is assumed but not visible in reviewed migrations. | Confirm FK or equivalent trigger. Add FK if absent and compatible with existing data. |
| Improve soon | Public profile read policy | `users` read uses `true` for authenticated users, with a restrictive block policy. This may be acceptable for public profiles but should stay limited to non-sensitive columns in client queries. | Keep sensitive fields such as email out of public selects; consider splitting private profile data if needed. |
| Improve soon | `direct_messages` | The table stores private text directly; RLS appears participant-limited, but realtime publication status needs live confirmation. | Confirm realtime does not broadcast private messages beyond RLS expectations; keep participant filters in client subscriptions. |
| Improve soon | Security definer functions | Several notification/count sync functions are `SECURITY DEFINER`. They use `set search_path = public`, which is good. | Confirm function ownership is a trusted DB role and execute grants are minimal. |

## 6. Index and performance findings

Visible indexes:

- `users_name_ci_unique` on `lower(name)`.
- `user_follows(followed_user_id)`.
- `user_blocks(blocked_id)`.
- `user_followed_hoods(hood_id)`.
- `user_followed_topics(tag)`.
- `post_confirmations(post_id, created_at desc)`.
- `post_status_history(post_id, created_at desc)`.
- `tags(state)`.
- `tags(country)`.

Likely useful indexes to confirm/add:

| Priority | Affected table/object | Problem | Recommended action |
| --- | --- | --- | --- |
| Fix now | `tags` | Feed queries order by `created_at desc`, filter by `user_id`, `hood_id`, `tag`, `country`, `state`, and search text. Only state/country indexes are visible. | Confirm indexes on `tags(created_at desc)`, `tags(user_id)`, `tags(hood_id)`, `tags(tag)`, and useful compound indexes for common feed filters. |
| Fix now | `direct_messages` | Inbox queries filter `from_uid` or `to_uid` and order by `created_at`; thread read updates filter by `thread_id` and `to_uid`. | Confirm indexes on `from_uid`, `to_uid`, `(thread_id, to_uid)`, and possibly `(thread_id, created_at)`. |
| Fix now | `post_comments` | Comments are fetched by `post_id`; replies use `parent_id`. | Confirm indexes on `post_id`, `parent_id`, and `created_at` if chronological rendering grows. |
| Improve soon | `post_likes`, `post_rsvps`, `post_poll_votes` | App batch-loads rows by `post_id`. | Confirm indexes/PKs beginning with `post_id`. |
| Improve soon | `notifications` | Hydration loads latest notifications and mark-all filters by `user_id`. | Confirm index on `(user_id, created_at desc)` and optionally `(user_id, read)`. |
| Improve soon | `user_saved_posts`, `user_hidden_posts` | Viewer state hydrates by `user_id`; following feed excludes hidden posts by `(user_id, post_id)`. | Confirm composite keys/indexes on `(user_id, post_id)`. |

## 7. Messaging design review

Current direct messaging is sufficient for simple one-to-one chat:

- Messages have sender, recipient, thread ID, read flag, and read timestamp.
- Users can list messages where they are sender or recipient.
- Recipients can mark thread messages as read.
- Block checks prevent messages across blocked relationships.
- Reports and muted threads exist.

Limitations:

- No `conversations` table, no `conversation_participants` table, and no group membership model.
- `thread_id` is text and appears derived by the app; this works for one-to-one but becomes brittle for group chat.
- No message attachment table was found.
- No message deletion/soft-delete flow was found.

Recommendation: keep the current table for one-to-one DMs. Add `conversations` and `conversation_participants` only when group chat, per-user deletion, richer unread state, or attachments become real product requirements.

## 8. Social feature review

The social schema is generally suitable for the current application. The main unusual design choice is naming the post table `tags`; this is workable but may continue to confuse code, reports, and future contributors.

Answered review questions:

1. Existing tables are generally suitable for the current social app, pending live confirmation of legacy RLS/FKs/indexes.
2. Important core tables clearly missing only for advanced/group messaging and service features, not for current feed/social basics.
3. No clearly duplicated social tables were found; `tags` is the post table, not a duplicate of `posts`.
4. Newer relationships are present in migrations; legacy table FKs need live confirmation.
5. Duplicate prevention is visible for newer relationship/report tables; likes/votes/saves/RSVPs need live constraint confirmation.
6. `public.users` is code-connected to auth UIDs, but an FK to `auth.users` needs confirmation.
7. Private direct messages appear protected by participant RLS.
8. Users appear restricted to their own profiles, comments, messages, notifications, follows/blocks; post ownership needs live policy confirmation.
9. Important indexes may be missing on feed, comment, messaging, and notification paths.
10. Current direct-message design is sufficient for basic one-to-one chat.
11. Conversation-related tables would be needed for group chat or more advanced messaging.
12. Storage protection needs live bucket/policy confirmation.
13. Scalability concerns are mostly feed search (`ilike`), realtime breadth, and missing/unknown indexes on hot tables.

## 9. Service feature review

No service marketplace schema was found. There are no visible tables for service listings, categories, providers, bookings, provider availability, pricing, reviews, addresses, payments, or refunds. Do not add these until the application has real service-provider workflows.

## 10. Storage review

The app uploads post media to a Supabase Storage bucket named `tag-images` and immediately calls `getPublicUrl`. This implies post media is intended to be public.

Needs live confirmation:

- Whether `tag-images` is public.
- Whether the bucket has file size limits.
- Whether allowed MIME types are restricted.
- Whether storage policies prevent users from overwriting or deleting other users' files.
- Whether any private messaging bucket exists. No message attachment bucket was found in code.

If post images are public by design, `tag-images` can be public, but bucket policies should still restrict uploads to authenticated users and enforce path ownership if paths include user IDs.

## 11. Recommended improvements

### Fix now

| Affected table or object | Problem | Recommended action |
| --- | --- | --- |
| Legacy social tables | RLS for `post_likes`, `post_rsvps`, `post_poll_votes`, `post_reports`, `user_saved_posts`, `user_hidden_posts`, and `hood_messages` was not visible in migrations. | Run the policy metadata query; add owner/participant policies where absent. |
| `tags` | Normal user insert/update/delete ownership policies were not visible in reviewed migrations. | Confirm deployed policies ensure `user_id = auth.uid()` on insert/update/delete. |
| `users` | FK from `users.uid` to `auth.users(id)` was not visible. | Confirm or add FK after data cleanup. |
| Duplicate interaction tables | Duplicate prevention for likes/saves/RSVPs/poll votes on legacy tables is not proven from repo files. | Confirm composite PK/unique constraints such as `(post_id, user_id)`. |
| Hot query indexes | Feed, comments, DM, notification indexes are not fully visible. | Confirm/add the indexes listed in the performance section. |
| Storage policies | Bucket metadata/policies were not available. | Run storage metadata and policy queries; verify upload/read rules for `tag-images`. |

### Improve soon

| Affected table or object | Problem | Recommended action |
| --- | --- | --- |
| `tags` naming | The post table name `tags` is confusing. | Keep it for now, but consider a `posts` view or future migration only if worth the churn. |
| Feed search | Current client queries use broad `ilike` filters. | Add trigram/full-text indexes if search volume grows. |
| Direct messages | One table works for 1:1 chat but is limited. | Add `conversations` and participants when group chat or per-user state is needed. |
| Realtime | Several tables are subscribed to. | Confirm realtime publication includes only tables that need it; avoid unnecessary high-churn streams. |
| Public profiles | Authenticated users can read profile rows. | Keep sensitive fields out of public queries or split private user settings into a separate table. |

### Optional later

| Affected table or object | Problem | Recommended action |
| --- | --- | --- |
| Services marketplace | Service features are not implemented. | Add service/provider/booking/payment tables only when product scope requires them. |
| Message attachments | Not implemented. | Add attachment metadata and private storage only when messaging needs files. |
| Moderation workflow | Reports exist, but moderation states/escalation may be basic. | Add report status/assignment tables only if moderation workload grows. |

## Metadata SQL to run in Supabase SQL Editor

Run these to confirm live state without selecting application rows:

```sql
select
    n.nspname as schema_name,
    c.relname as object_name,
    case c.relkind
        when 'r' then 'table'
        when 'p' then 'partitioned_table'
        when 'v' then 'view'
        when 'm' then 'materialized_view'
        else c.relkind::text
    end as object_type
from pg_class c
join pg_namespace n
    on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
order by object_name;
```

```sql
select
    table_name,
    ordinal_position,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

```sql
select
    t.relname as table_name,
    con.conname as constraint_name,
    case con.contype
        when 'p' then 'PRIMARY KEY'
        when 'f' then 'FOREIGN KEY'
        when 'u' then 'UNIQUE'
        when 'c' then 'CHECK'
        else con.contype::text
    end as constraint_type,
    pg_get_constraintdef(con.oid, true) as constraint_definition
from pg_constraint con
join pg_class t
    on t.oid = con.conrelid
join pg_namespace n
    on n.oid = t.relnamespace
where n.nspname = 'public'
order by t.relname, constraint_type;
```

```sql
select
    tablename,
    indexname,
    indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

```sql
select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n
    on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;
```

```sql
select
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

```sql
select
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c
    on c.oid = t.tgrelid
join pg_namespace n
    on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname in ('public', 'auth', 'storage')
order by n.nspname, c.relname;
```

```sql
select
    n.nspname as schema_name,
    p.proname as function_name,
    case
        when p.prosecdef then 'SECURITY DEFINER'
        else 'SECURITY INVOKER'
    end as security_mode,
    pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n
    on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
```

```sql
select
    schemaname,
    tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

```sql
select
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
from storage.buckets
order by name;
```
