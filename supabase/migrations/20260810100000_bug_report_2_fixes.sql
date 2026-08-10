-- Durable fixes for Bug Report #2: email preferences, poll validation, and
-- media MIME support. Apply through the normal Supabase migration workflow.

begin;

create extension if not exists pgcrypto;

-- The token itself is sent only in the user's confirmation email metadata.
-- Store a one-way hash in the profile so a database export cannot be used to
-- create an unsubscribe link.
alter table public.users
  add column if not exists email_opted_out boolean not null default false,
  add column if not exists email_opted_out_at timestamptz,
  add column if not exists email_opt_out_reason text,
  add column if not exists email_opt_out_token_hash text;

create unique index if not exists users_email_opt_out_token_hash_unique
  on public.users (email_opt_out_token_hash)
  where email_opt_out_token_hash is not null;

do $$ begin
  alter table public.users
    add constraint users_email_opt_out_reason_check
    check (
      email_opt_out_reason is null
      or email_opt_out_reason in ('other', 'too_many', 'not_signed_up', 'spam')
    );
exception when duplicate_object then null;
end $$;

-- Keep the auth trigger current with every profile field added so far, and
-- capture a hashed per-user opt-out token on new account creation.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hood jsonb := new.raw_user_meta_data->'home_hood';
  acct_type text := coalesce(nullif(new.raw_user_meta_data->>'account_type', ''), 'personal');
  opt_out_token_hash text := case
    when nullif(new.raw_user_meta_data->>'email_opt_out_token', '') is null then null
    else encode(digest(new.raw_user_meta_data->>'email_opt_out_token', 'sha256'), 'hex')
  end;
begin
  insert into public.users (
    uid, name, email, is_guest, created_at,
    home_state, home_country, home_district, home_place, home_lat, home_lng, home_updated_at,
    account_type, business_name, business_phone, business_website, email_opt_out_token_hash
  )
  values (
    new.id::text,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1),
      'User'
    ),
    new.email,
    false,
    coalesce(new.created_at, now()),
    coalesce(nullif(hood->>'state', ''),    'Karnataka'),
    coalesce(nullif(hood->>'country', ''),  'India'),
    coalesce(nullif(hood->>'district', ''), 'Bangalore Urban'),
    nullif(hood->>'place', ''),
    nullif(hood->>'lat', '')::double precision,
    nullif(hood->>'lng', '')::double precision,
    now() - interval '30 days',
    acct_type,
    nullif(new.raw_user_meta_data->>'business_name', ''),
    nullif(new.raw_user_meta_data->>'business_phone', ''),
    nullif(new.raw_user_meta_data->>'business_website', ''),
    opt_out_token_hash
  )
  on conflict (uid) do update
  set
    name                         = coalesce(excluded.name, public.users.name),
    email                        = coalesce(excluded.email, public.users.email),
    is_guest                     = false,
    account_type                 = excluded.account_type,
    business_name                = coalesce(excluded.business_name, public.users.business_name),
    business_phone               = coalesce(excluded.business_phone, public.users.business_phone),
    business_website             = coalesce(excluded.business_website, public.users.business_website),
    email_opt_out_token_hash     = coalesce(
      public.users.email_opt_out_token_hash,
      excluded.email_opt_out_token_hash
    );

  return new;
end;
$function$;

-- This RPC is deliberately callable without a session: the email link is the
-- credential. A UUID token has sufficient entropy and is compared by hash.
create or replace function public.unsubscribe_email(
  p_token uuid,
  p_reason text default 'other'
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  changed integer;
begin
  if p_reason not in ('other', 'too_many', 'not_signed_up', 'spam') then
    raise exception 'Invalid opt-out reason' using errcode = '22023';
  end if;

  update public.users
  set
    email_opted_out = true,
    email_opted_out_at = coalesce(email_opted_out_at, now()),
    email_opt_out_reason = p_reason
  where email_opt_out_token_hash = encode(digest(p_token::text, 'sha256'), 'hex');

  get diagnostics changed = row_count;
  return changed > 0;
end;
$function$;

revoke all on function public.unsubscribe_email(uuid, text) from public;
grant execute on function public.unsubscribe_email(uuid, text) to anon, authenticated;

-- Existing rows remain readable even if a prior release wrote malformed poll
-- data. PostgreSQL still enforces this NOT VALID constraint for every new or
-- changed row, which closes the publishing path without a destructive rewrite.
create or replace function public.poll_options_are_valid(options text[])
returns boolean
language sql
immutable
as $function$
  select options is null or (
    cardinality(options) between 2 and 5
    and not exists (
      select 1 from unnest(options) as option_value
      where length(btrim(option_value)) = 0
    )
  );
$function$;

alter table public.tags drop constraint if exists tags_poll_options_valid_check;
alter table public.tags
  add constraint tags_poll_options_valid_check
  check (public.poll_options_are_valid(poll_options)) not valid;

-- M4V files are accepted in the composer and normalized to this canonical MIME
-- type before upload. The bucket remains the final enforcement point.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tag-images',
  'tag-images',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
