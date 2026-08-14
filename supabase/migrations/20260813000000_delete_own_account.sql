-- Lets a signed-in user delete their own account data with no service-role
-- key involved: SECURITY DEFINER bypasses per-table RLS, but auth.uid() =
-- uid keeps the blast radius to exactly the calling user's own row. Every
-- other app table cascades off public.users(uid) via ON DELETE CASCADE
-- (see 20260709000000_baseline_schema.sql / 20260712000000_social_suite.sql
-- / 20260809010000_legacy_tables_rls.sql / 20260809040000_reputation_rewards.sql),
-- so this one delete removes posts, comments, reactions, saves, follows,
-- blocks, reports, notifications, direct messages, and reputation rewards
-- along with it.
--
-- This does NOT remove the auth.users row (needs the admin API / service
-- role) or the actual files in the tag-images Storage bucket (Storage
-- objects live outside Postgres; deleting their storage.objects metadata
-- row does not delete the underlying bytes) — both are handled by the
-- Cloudflare function that calls this RPC.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users where uid = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
