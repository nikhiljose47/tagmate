-- Business profile expansion: cover image, opening hours, Google Maps link,
-- social links, About (bio), and normalized offers/items tables.
-- bio/cover_image_url/opening_hours/google_maps_url/social_* are net-new;
-- business_offers auto-prunes expired rows via pg_cron (hard delete, not a
-- status flag, per product decision — unlike tags.expires_in/current_status).

begin;

-- ── New columns on users ──────────────────────────────────────────────────
alter table public.users
  add column if not exists bio text,
  add column if not exists cover_image_url text,
  add column if not exists opening_hours jsonb,
  add column if not exists google_maps_url text,
  add column if not exists social_instagram text,
  add column if not exists social_facebook text,
  add column if not exists social_x text,
  add column if not exists social_linkedin text,
  add column if not exists social_youtube text,
  add column if not exists social_whatsapp text;

-- ── business_offers (rows are hard-deleted once expired) ─────────────────
create table if not exists public.business_offers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  image_url text,
  title text not null,
  description text,
  valid_until date not null,
  created_at timestamptz not null default now()
);

alter table public.business_offers enable row level security;

create policy "authenticated can read business offers"
  on public.business_offers for select
  to authenticated
  using (true);

create policy "owner can insert own business offers"
  on public.business_offers for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "owner can update own business offers"
  on public.business_offers for update
  to authenticated
  using (user_id = auth.uid()::text);

create policy "owner can delete own business offers"
  on public.business_offers for delete
  to authenticated
  using (user_id = auth.uid()::text);

-- ── business_items (products / services, no expiry) ──────────────────────
create table if not exists public.business_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(uid) on delete cascade,
  image_url text,
  name text not null,
  description text,
  price numeric,
  offer_price numeric,
  created_at timestamptz not null default now()
);

alter table public.business_items enable row level security;

create policy "authenticated can read business items"
  on public.business_items for select
  to authenticated
  using (true);

create policy "owner can insert own business items"
  on public.business_items for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "owner can update own business items"
  on public.business_items for update
  to authenticated
  using (user_id = auth.uid()::text);

create policy "owner can delete own business items"
  on public.business_items for delete
  to authenticated
  using (user_id = auth.uid()::text);

-- ── Daily prune of expired offers ─────────────────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-business-offers') then
    perform cron.unschedule('expire-business-offers');
  end if;
end $$;

select cron.schedule(
  'expire-business-offers',
  '0 0 * * *',
  $$delete from public.business_offers where valid_until < current_date$$
);

-- ── Widen the public.users column grant (public_user_profiles is
-- security_invoker, so the caller needs SELECT on every selected column) ──
grant select (
  uid, name, is_guest, reputation, created_at,
  account_type, business_name, business_website,
  business_category, business_images, avatar_url, business_established_year,
  business_phone, bio, cover_image_url, opening_hours, google_maps_url,
  social_instagram, social_facebook, social_x, social_linkedin, social_youtube, social_whatsapp
) on table public.users to authenticated;

-- ── Re-point the profile views at the wider column set ────────────────────
create or replace view public.public_user_profiles
with (security_invoker = true, security_barrier = true)
as
select uid, name, is_guest, reputation, created_at,
       account_type, business_name, business_website,
       business_category, business_images, avatar_url, business_established_year,
       business_phone, bio, cover_image_url, opening_hours, google_maps_url,
       social_instagram, social_facebook, social_x, social_linkedin, social_youtube, social_whatsapp
from public.users;

create or replace view public.my_user_profile
with (security_barrier = true)
as
select uid, name, email, is_guest, reputation, created_at,
       home_state, home_country, home_district, home_place, home_lat, home_lng, home_updated_at,
       account_type, business_name, business_phone, business_website, business_category, business_images,
       avatar_url, business_established_year,
       bio, cover_image_url, opening_hours, google_maps_url,
       social_instagram, social_facebook, social_x, social_linkedin, social_youtube, social_whatsapp
from public.users
where uid = auth.uid()::text;

commit;
