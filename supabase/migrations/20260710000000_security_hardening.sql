-- Security invariants required by the Angular client. Apply through the
-- Supabase migration workflow after resolving any pre-existing duplicate names.

create unique index if not exists users_name_ci_unique
  on public.users (lower(name));

-- Admin status must be assigned through auth.users.raw_app_meta_data by a
-- trusted server/admin workflow. Never grant it through user_metadata.
drop policy if exists "trusted admins may delete tags" on public.tags;
create policy "trusted admins may delete tags"
  on public.tags
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Existing owner CRUD, private-message participant, notification-owner, and
-- storage policies remain mandatory. This migration deliberately does not
-- replace project-specific policies whose definitions are not in this repo.
