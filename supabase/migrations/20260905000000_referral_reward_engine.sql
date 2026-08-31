-- Referral + reward + scratch-and-win + cash payout system — Phase 2
-- (server-side referral/reward engine). Builds on the Phase 1 foundation
-- (20260904000000_referral_reward_foundation.sql) without altering its
-- tables or RLS policies — every privileged write introduced here goes
-- through the SECURITY DEFINER functions below, called exclusively by the
-- backend (Cloudflare Pages Functions under functions/api/referrals/**)
-- using the service-role key. RLS stays enabled and unchanged: it still
-- correctly blocks direct client INSERT/UPDATE on referrals/rewards/ledger,
-- and SECURITY DEFINER functions execute with the owning role's privileges
-- regardless of RLS or the caller's grants.
--
-- Qualifying event (Phase 2): the safest meaningful signal already available
-- in this app is "the referred user actually completed registration" — a
-- real, non-guest, non-test row exists in `public.users` for them (guest
-- sessions and internal test accounts can be created with zero friction, so
-- neither should ever trigger a reward). This is intentionally the ONLY
-- qualifying condition checked in `evaluate_referral()` below; later phases
-- can extend it (verified phone, first transaction, etc.) by editing that
-- one function without touching the schema, the Cloudflare endpoints, or
-- the Angular services.

begin;

-- ── generate_referral_code ────────────────────────────────────────────────
-- Not itself exposed via RPC (no EXECUTE grant to any client-facing role) —
-- only called from create_or_get_referral_code() below. Excludes visually
-- ambiguous characters (0/O, 1/I/L) since this code is read and typed by
-- humans, unlike an API key.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..7 loop
    result := result || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
  end loop;
  return result;
end;
$function$;

revoke all on function public.generate_referral_code() from public, anon, authenticated;

-- ── create_or_get_referral_code ──────────────────────────────────────────
-- Idempotent: a user gets exactly one code, ever. Retries on a colliding
-- code (extremely unlikely at 7 chars from a 31-char alphabet) and on a
-- concurrent call for the same user racing this one.
create or replace function public.create_or_get_referral_code(p_user_id text)
returns public.referral_codes
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_row public.referral_codes;
  v_attempts int := 0;
begin
  select * into v_row from public.referral_codes where user_id = p_user_id;
  if found then
    return v_row;
  end if;

  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'Could not generate a unique referral code.';
    end if;

    begin
      insert into public.referral_codes (user_id, code)
      values (p_user_id, public.generate_referral_code())
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      -- Either the generated code collided with an existing one (retry with
      -- a fresh code) or a concurrent call already created this user's row
      -- (return that instead of erroring).
      select * into v_row from public.referral_codes where user_id = p_user_id;
      if found then
        return v_row;
      end if;
    end;
  end loop;
end;
$function$;

revoke all on function public.create_or_get_referral_code(text) from public, anon, authenticated;
grant execute on function public.create_or_get_referral_code(text) to service_role;

-- ── referral_evaluation_result ───────────────────────────────────────────
-- Small shared shape-builder so register_referral()/evaluate_referral()
-- always return the same safe, client-facing result.
create or replace function public.referral_evaluation_result(
  p_ref public.referrals,
  p_reward public.rewards default null
)
returns jsonb
language sql
immutable
as $function$
  select jsonb_build_object(
    'referralId', p_ref.id,
    'status', p_ref.status,
    'qualifyingEvent', p_ref.qualifying_event,
    'qualifiedAt', p_ref.qualified_at,
    'rewardId', p_reward.id,
    'rewardAmount', p_reward.reward_amount,
    'rewardStatus', p_reward.status
  );
$function$;

revoke all on function public.referral_evaluation_result(public.referrals, public.rewards)
  from public, anon, authenticated;

-- ── evaluate_referral ─────────────────────────────────────────────────────
-- The whole qualification + reward-creation transaction, in one place.
-- `select ... for update` on the referral row means two concurrent calls for
-- the same referral serialize on this lock — the second one sees the first
-- one's committed status and becomes a no-op, so retries/replays/concurrent
-- requests can never produce a second reward. The unique constraints on
-- `rewards.referral_id` and the ledger existence check are backstops for the
-- same guarantee, not the primary mechanism.
create or replace function public.evaluate_referral(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ref public.referrals;
  v_config public.referral_program_config;
  v_referred public.users;
  v_referrer public.users;
  v_reward public.rewards;
  v_daily_count integer;
  v_monthly_count integer;
begin
  select * into v_ref from public.referrals where id = p_referral_id for update;
  if not found then
    raise exception 'referral_not_found';
  end if;

  -- Already at a terminal state — idempotent no-op.
  if v_ref.status in ('REWARDED', 'REJECTED') then
    return public.referral_evaluation_result(v_ref);
  end if;

  select * into v_config from public.referral_program_config where id = 1;

  if not v_config.referral_enabled then
    update public.referrals set status = 'REJECTED', updated_at = now()
      where id = v_ref.id returning * into v_ref;
    insert into public.referral_reward_events
      (user_id, event_type, referral_id, action, resulting_status, metadata)
      values (v_ref.referrer_user_id, 'referral_evaluated', v_ref.id, 'evaluate_referral',
              'REJECTED', jsonb_build_object('reason', 'referral_program_disabled'));
    return public.referral_evaluation_result(v_ref);
  end if;

  select * into v_referred from public.users where uid = v_ref.referred_user_id;
  select * into v_referrer from public.users where uid = v_ref.referrer_user_id;

  -- Internal test accounts never qualify or generate rewards, on either
  -- side of the relationship — otherwise they'd be a free reward farm.
  if coalesce(v_referred.is_test, false) or coalesce(v_referrer.is_test, false) then
    update public.referrals set status = 'REJECTED', updated_at = now()
      where id = v_ref.id returning * into v_ref;
    insert into public.referral_reward_events
      (user_id, event_type, referral_id, action, resulting_status, metadata)
      values (v_ref.referrer_user_id, 'referral_evaluated', v_ref.id, 'evaluate_referral',
              'REJECTED', jsonb_build_object('reason', 'test_account'));
    return public.referral_evaluation_result(v_ref);
  end if;

  -- Qualifying event: registration genuinely completed (see migration
  -- header). Not met yet -> stay PENDING; a later evaluate_referral call
  -- (Phase 2's evaluate endpoint, or a future qualifying-event trigger) can
  -- qualify it once it's true.
  if v_referred.uid is null or v_referred.is_guest then
    return public.referral_evaluation_result(v_ref);
  end if;

  if v_ref.status = 'PENDING' then
    -- Referral velocity guard: routes suspiciously fast referrers to manual
    -- review instead of auto-rewarding. Never an automatic ban.
    select count(*) into v_daily_count from public.referrals
      where referrer_user_id = v_ref.referrer_user_id and created_at >= now() - interval '1 day';
    select count(*) into v_monthly_count from public.referrals
      where referrer_user_id = v_ref.referrer_user_id and created_at >= date_trunc('month', now());

    if v_daily_count > v_config.maximum_referrals_per_day
       or v_monthly_count > v_config.maximum_referrals_per_month then
      update public.referrals
        set status = 'REVIEW_REQUIRED', qualifying_event = 'registration_completed', updated_at = now()
        where id = v_ref.id returning * into v_ref;
      insert into public.referral_reward_events
        (user_id, event_type, referral_id, action, resulting_status, metadata)
        values (v_ref.referrer_user_id, 'referral_evaluated', v_ref.id, 'evaluate_referral',
                'REVIEW_REQUIRED', jsonb_build_object(
                  'reason', 'referral_velocity', 'dailyCount', v_daily_count, 'monthlyCount', v_monthly_count
                ));
      return public.referral_evaluation_result(v_ref);
    end if;

    update public.referrals
      set status = 'QUALIFIED', qualifying_event = 'registration_completed', qualified_at = now(), updated_at = now()
      where id = v_ref.id
      returning * into v_ref;
  end if;

  -- v_ref.status is now QUALIFIED — create exactly one reward, idempotently.
  if not v_config.reward_enabled then
    return public.referral_evaluation_result(v_ref);
  end if;

  insert into public.rewards (user_id, referral_id, reward_type, reward_amount, status, eligible_at)
    values (v_ref.referrer_user_id, v_ref.id, v_config.reward_type, v_config.fixed_reward_amount, 'ELIGIBLE', now())
    on conflict (referral_id) do nothing
    returning * into v_reward;

  if v_reward.id is null then
    select * into v_reward from public.rewards where referral_id = v_ref.id;
  end if;

  -- Belt-and-braces: only write the ledger credit if one doesn't already
  -- exist for this reward, so a retried call can never double-credit even
  -- if the insert above raced.
  if not exists (
    select 1 from public.reward_ledger where reward_id = v_reward.id and type = 'reward_credit'
  ) then
    insert into public.reward_ledger (user_id, reward_id, type, amount, balance_effect, metadata)
      values (v_ref.referrer_user_id, v_reward.id, 'reward_credit', v_reward.reward_amount, 'credit',
              jsonb_build_object('referralId', v_ref.id));
  end if;

  update public.referrals set status = 'REWARDED', updated_at = now()
    where id = v_ref.id returning * into v_ref;

  insert into public.referral_reward_events
    (user_id, event_type, referral_id, reward_id, action, amount, resulting_status, metadata)
    values (v_ref.referrer_user_id, 'referral_rewarded', v_ref.id, v_reward.id, 'evaluate_referral',
            v_reward.reward_amount, 'REWARDED', jsonb_build_object('rewardType', v_reward.reward_type));

  return public.referral_evaluation_result(v_ref, v_reward);
end;
$function$;

revoke all on function public.evaluate_referral(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_referral(uuid) to service_role;

-- ── register_referral ────────────────────────────────────────────────────
-- Resolves the referrer from the code, rejects self-referral, and — the key
-- anti-fraud invariant — never lets a referred user's attribution change:
-- if they already have a referral row (from this call racing another, or
-- from an earlier call with a different code), that row is returned as-is
-- and no new one is ever created.
create or replace function public.register_referral(p_referred_user_id text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_code_row public.referral_codes;
  v_ref public.referrals;
  v_normalized_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_normalized_code = '' then
    raise exception 'invalid_referral_code';
  end if;

  select * into v_ref from public.referrals where referred_user_id = p_referred_user_id;
  if found then
    return public.evaluate_referral(v_ref.id);
  end if;

  select * into v_code_row from public.referral_codes where code = v_normalized_code and active;
  if not found then
    raise exception 'invalid_referral_code';
  end if;

  if v_code_row.user_id = p_referred_user_id then
    raise exception 'self_referral';
  end if;

  begin
    insert into public.referrals (referrer_user_id, referred_user_id, referral_code_id)
      values (v_code_row.user_id, p_referred_user_id, v_code_row.id)
      returning * into v_ref;
  exception when unique_violation then
    -- Lost a race to a concurrent registration for the same referred user —
    -- the other request's referrer already won; never overwrite it.
    select * into v_ref from public.referrals where referred_user_id = p_referred_user_id;
  end;

  return public.evaluate_referral(v_ref.id);
end;
$function$;

revoke all on function public.register_referral(text, text) from public, anon, authenticated;
grant execute on function public.register_referral(text, text) to service_role;

-- ── my_reward_summary ─────────────────────────────────────────────────────
-- Read-only aggregate for the Rewards page. security_invoker + the
-- `auth.uid()` predicate mean this can never return another user's totals,
-- so it's safe to expose directly to `authenticated` — no Cloudflare
-- Function needed for a plain read.
create or replace view public.my_reward_summary
with (security_invoker = true, security_barrier = true)
as
select
  coalesce(sum(r.reward_amount) filter (where r.status in ('ELIGIBLE', 'REVEALED')), 0) as available_amount,
  coalesce(sum(r.reward_amount) filter (where r.status in ('PAYOUT_REQUESTED', 'PROCESSING')), 0) as pending_amount,
  coalesce(sum(r.reward_amount) filter (where r.status = 'PAID'), 0) as paid_amount,
  coalesce(sum(r.reward_amount) filter (where r.status not in ('FAILED', 'CANCELLED')), 0) as total_earned_amount,
  (select count(*) from public.referrals ref where ref.referrer_user_id = auth.uid()::text) as total_referrals,
  (select count(*) from public.referrals ref
     where ref.referrer_user_id = auth.uid()::text and ref.status in ('QUALIFIED', 'REWARDED')) as qualified_referrals
from public.rewards r
where r.user_id = auth.uid()::text;

revoke all on table public.my_reward_summary from public, anon;
grant select on public.my_reward_summary to authenticated;

commit;
