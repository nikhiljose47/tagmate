-- State (admin-1) attached to each tag so the beta feed can group by state
-- (e.g. "Kerala") without any client-side geographic inference. Country is
-- already present; state is populated from Nominatim reverse geocoding at
-- post creation time. Additive and safe to run once per project.
alter table public.tags
  add column if not exists state text;

create index if not exists tags_state_idx on public.tags (state);
create index if not exists tags_country_idx on public.tags (country);
