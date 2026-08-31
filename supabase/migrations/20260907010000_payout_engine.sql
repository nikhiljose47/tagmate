-- Referral + reward + scratch-and-win + cash payout system — Phase 4
-- (server-side payout engine). Every privileged write goes through these
-- SECURITY DEFINER functions, called only by the backend (Cloudflare Pages
-- Functions under functions/api/payouts/**) using the service-role key —
-- same pattern as the referral/reward engine in Phases 2-3. RLS on
-- payouts/payout_destinations/payout_rewards is untouched: read-own-row
-- only, no insert/update policy for `authenticated` anywhere.

begin;

-- ── payout_result ─────────────────────────────────────────────────────────
-- Shared shape-builder so every payout operation returns the same
-- client-facing result. Never includes anything the client didn't already
-- have a right to see (no raw destination identifiers, no internal ids
-- beyond the payout's own).
create or replace function public.payout_result(p_payout public.payouts)
returns jsonb
language sql
immutable
as $function$
  select jsonb_build_object(
    'payoutId', p_payout.id,
    'status', p_payout.status,
    'amount', p_payout.amount,
    'provider', p_payout.provider,
    'providerPayoutId', p_payout.provider_payout_id,
    'failureReason', p_payout.failure_reason,
    'requestedAt', p_payout.requested_at,
    'processedAt', p_payout.processed_at,
    'completedAt', p_payout.completed_at
  );
$function$;

revoke all on function public.payout_result(public.payouts) from public, anon, authenticated;

-- ── add_payout_destination ───────────────────────────────────────────────
-- Only ever called after the backend has already exchanged the raw
-- identifier with the payout provider (see functions/api/payouts/) — the
-- raw UPI id/bank account number is never passed here and never stored;
-- only the provider's own references plus a display-safe masked string.
-- `verified` always starts false: this repo has no real provider yet to
-- actually verify a destination against (see the Phase 4 report) — a real
-- integration's verification result would flip this server-side, never
-- from a client-side regex match.
create or replace function public.add_payout_destination(
  p_user_id text,
  p_type text,
  p_masked_identifier text,
  p_provider_contact_id text,
  p_provider_reference text
)
returns public.payout_destinations
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_row public.payout_destinations;
begin
  if p_type not in ('upi', 'bank_account') then
    raise exception 'invalid_destination_type';
  end if;
  if p_masked_identifier is null or length(trim(p_masked_identifier)) = 0 then
    raise exception 'invalid_destination';
  end if;

  insert into public.payout_destinations
    (user_id, type, masked_identifier, provider_contact_id, provider_reference, verified)
  values
    (p_user_id, p_type, p_masked_identifier, p_provider_contact_id, p_provider_reference, false)
  on conflict (user_id) do update set
    type = excluded.type,
    masked_identifier = excluded.masked_identifier,
    provider_contact_id = excluded.provider_contact_id,
    provider_reference = excluded.provider_reference,
    verified = false,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.add_payout_destination(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.add_payout_destination(text, text, text, text, text) to service_role;

-- ── request_payout ────────────────────────────────────────────────────────
create or replace function public.request_payout(
  p_user_id text,
  p_destination_id uuid,
  p_idempotency_key text,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.payouts;
  v_destination public.payout_destinations;
  v_config public.referral_program_config;
  v_available integer;
  v_reward_ids uuid[];
  v_payout public.payouts;
  v_daily_count integer;
  v_shared_destination_count integer;
  v_status text := 'REQUESTED';
  v_review_reason text;
begin
  -- Idempotent replay: a double-click, refresh, or client retry sending the
  -- same idempotency key must return the existing payout, never create a
  -- second one.
  select * into v_existing from public.payouts
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return public.payout_result(v_existing);
  end if;

  select * into v_config from public.referral_program_config where id = 1;
  if not v_config.payout_enabled then
    raise exception 'payouts_disabled';
  end if;

  select * into v_destination from public.payout_destinations
    where id = p_destination_id and user_id = p_user_id;
  if not found then
    raise exception 'destination_not_found';
  end if;

  -- Lock every currently-withdrawable reward for this user. SKIP LOCKED
  -- means a concurrent request_payout() call already holding some of these
  -- rows simply sees fewer (or none) here — combined with the partial
  -- unique index on payout_rewards(reward_id), the same reward can never
  -- end up spent by two payouts even if both calls race past this point.
  with locked_rewards as (
    select id, reward_amount from public.rewards
    where user_id = p_user_id and status = 'REVEALED'
    for update skip locked
  )
  select coalesce(sum(reward_amount), 0), coalesce(array_agg(id), '{}')
    into v_available, v_reward_ids
    from locked_rewards;

  if v_available < v_config.minimum_payout_amount then
    raise exception 'below_minimum_payout';
  end if;

  -- Fraud signals route to manual review — never an automatic block.
  select count(*) into v_daily_count from public.payouts
    where user_id = p_user_id and requested_at >= now() - interval '1 day';
  select count(distinct pd.user_id) into v_shared_destination_count
    from public.payout_destinations pd
    where pd.masked_identifier = v_destination.masked_identifier
      and pd.user_id <> p_user_id;

  if v_daily_count >= 3 then
    v_status := 'REVIEW_REQUIRED';
    v_review_reason := 'payout_velocity';
  elsif v_shared_destination_count >= 2 then
    v_status := 'REVIEW_REQUIRED';
    v_review_reason := 'shared_destination';
  end if;

  insert into public.payouts
    (user_id, payout_destination_id, amount, status, provider, idempotency_key, requested_at)
  values
    (p_user_id, p_destination_id, v_available, v_status, p_provider, p_idempotency_key, now())
  returning * into v_payout;

  insert into public.payout_rewards (payout_id, reward_id)
    select v_payout.id, r_id from unnest(v_reward_ids) as r_id;

  update public.rewards set status = 'PAYOUT_REQUESTED', updated_at = now()
    where id = any(v_reward_ids);

  insert into public.referral_reward_events
    (user_id, event_type, payout_id, action, amount, resulting_status, metadata)
  values
    (p_user_id, 'payout_requested', v_payout.id, 'request_payout', v_available, v_status,
     case when v_review_reason is not null
          then jsonb_build_object('reason', v_review_reason) else '{}'::jsonb end);

  return public.payout_result(v_payout);
end;
$function$;

revoke all on function public.request_payout(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.request_payout(text, uuid, text, text) to service_role;

-- ── apply_payout_result ───────────────────────────────────────────────────
-- The one place a payout's status actually advances after creation. Used
-- directly (by the backend, right after submitting to — or hearing back
-- from — the provider) and indirectly via apply_payout_webhook() below.
-- Every branch is guarded so a delayed, duplicated, or out-of-order call
-- can never double-apply a financial effect:
--   * FAILED/REVERSED are terminal — nothing more can happen to them.
--   * PAID is terminal except for the one path out of it: REVERSED.
create or replace function public.apply_payout_result(
  p_payout_id uuid,
  p_status text,
  p_provider_payout_id text,
  p_provider_status text,
  p_failure_code text,
  p_failure_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_payout public.payouts;
  v_reward record;
begin
  if p_status not in ('PROCESSING', 'QUEUED', 'PAID', 'FAILED', 'REVERSED') then
    raise exception 'invalid_payout_status';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'payout_not_found';
  end if;

  if v_payout.status in ('FAILED', 'REVERSED') then
    return public.payout_result(v_payout);
  end if;
  if v_payout.status = 'PAID' and p_status <> 'REVERSED' then
    return public.payout_result(v_payout);
  end if;

  if p_status in ('PROCESSING', 'QUEUED') then
    update public.payouts
      set status = p_status,
          provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id),
          provider_status = p_provider_status,
          processed_at = coalesce(processed_at, now()),
          updated_at = now()
      where id = v_payout.id
      returning * into v_payout;

    update public.rewards r
      set status = 'PROCESSING', updated_at = now()
      from public.payout_rewards pr
      where pr.payout_id = v_payout.id and pr.reward_id = r.id and not pr.released
        and r.status = 'PAYOUT_REQUESTED';

  elsif p_status = 'PAID' then
    update public.payouts
      set status = 'PAID',
          provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id),
          provider_status = p_provider_status,
          completed_at = now(),
          updated_at = now()
      where id = v_payout.id
      returning * into v_payout;

    for v_reward in
      select r.* from public.rewards r
      join public.payout_rewards pr on pr.reward_id = r.id
      where pr.payout_id = v_payout.id and not pr.released
    loop
      update public.rewards set status = 'PAID', updated_at = now() where id = v_reward.id;
      insert into public.reward_ledger (user_id, reward_id, payout_id, type, amount, balance_effect, metadata)
        values (v_payout.user_id, v_reward.id, v_payout.id, 'payout_debit', v_reward.reward_amount, 'debit',
                jsonb_build_object('payoutId', v_payout.id));
    end loop;

    insert into public.referral_reward_events
      (user_id, event_type, payout_id, action, amount, resulting_status, provider_reference, metadata)
      values (v_payout.user_id, 'payout_completed', v_payout.id, 'apply_payout_result', v_payout.amount,
              'PAID', p_provider_payout_id, '{}'::jsonb);

  elsif p_status = 'FAILED' then
    update public.payouts
      set status = 'FAILED',
          provider_status = p_provider_status,
          failure_code = p_failure_code,
          failure_reason = p_failure_reason,
          completed_at = now(),
          updated_at = now()
      where id = v_payout.id
      returning * into v_payout;

    -- Release safely: the reward becomes withdrawable again, and the
    -- partial unique index on payout_rewards(reward_id) frees up as soon as
    -- `released` flips, so a later request_payout() can pick it up. No new
    -- ledger entry is needed here — a payout_debit is only ever written
    -- once PAID (above), so nothing was debited to reverse.
    update public.rewards r
      set status = 'REVEALED', updated_at = now()
      from public.payout_rewards pr
      where pr.payout_id = v_payout.id and pr.reward_id = r.id and not pr.released
        and r.status in ('PAYOUT_REQUESTED', 'PROCESSING');

    update public.payout_rewards
      set released = true, released_at = now()
      where payout_id = v_payout.id and not released;

    insert into public.referral_reward_events
      (user_id, event_type, payout_id, action, amount, resulting_status, metadata)
      values (v_payout.user_id, 'payout_failed', v_payout.id, 'apply_payout_result', v_payout.amount,
              'FAILED', jsonb_build_object('failureCode', p_failure_code));

  elsif p_status = 'REVERSED' then
    if v_payout.status <> 'PAID' then
      return public.payout_result(v_payout);
    end if;

    update public.payouts
      set status = 'REVERSED',
          provider_status = p_provider_status,
          failure_code = p_failure_code,
          failure_reason = p_failure_reason,
          updated_at = now()
      where id = v_payout.id
      returning * into v_payout;

    -- A reversal means the money never actually landed after all — the
    -- earlier payout_debit is offset with an explicit payout_reversal
    -- credit (never delete the original debit; both stay in the ledger).
    for v_reward in
      select r.* from public.rewards r
      join public.payout_rewards pr on pr.reward_id = r.id
      where pr.payout_id = v_payout.id
    loop
      update public.rewards set status = 'REVEALED', updated_at = now() where id = v_reward.id;
      insert into public.reward_ledger (user_id, reward_id, payout_id, type, amount, balance_effect, metadata)
        values (v_payout.user_id, v_reward.id, v_payout.id, 'payout_reversal', v_reward.reward_amount, 'credit',
                jsonb_build_object('payoutId', v_payout.id));
    end loop;

    update public.payout_rewards set released = true, released_at = now()
      where payout_id = v_payout.id and not released;

    insert into public.referral_reward_events
      (user_id, event_type, payout_id, action, amount, resulting_status, metadata)
      values (v_payout.user_id, 'payout_reversed', v_payout.id, 'apply_payout_result', v_payout.amount,
              'REVERSED', '{}'::jsonb);
  end if;

  return public.payout_result(v_payout);
end;
$function$;

revoke all on function public.apply_payout_result(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_payout_result(uuid, text, text, text, text, text) to service_role;

-- ── apply_payout_webhook ──────────────────────────────────────────────────
-- Webhook-specific wrapper: gates on provider_webhook_events' unique
-- (provider, provider_event_id) constraint FIRST, so a redelivered event
-- never reaches apply_payout_result at all — apply_payout_result's own
-- terminal-state guards are the second, independent layer of protection.
create or replace function public.apply_payout_webhook(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_payout_id text,
  p_status text,
  p_provider_status text,
  p_failure_code text,
  p_failure_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_is_new boolean;
  v_payout public.payouts;
  v_result jsonb;
begin
  insert into public.provider_webhook_events (provider, provider_event_id, event_type)
    values (p_provider, p_provider_event_id, p_event_type)
    on conflict (provider, provider_event_id) do nothing;
  v_is_new := found;

  if not v_is_new then
    return jsonb_build_object('duplicate', true);
  end if;

  select * into v_payout from public.payouts
    where provider = p_provider and provider_payout_id = p_provider_payout_id;
  if not found then
    update public.provider_webhook_events
      set processed = true, processed_at = now()
      where provider = p_provider and provider_event_id = p_provider_event_id;
    return jsonb_build_object('duplicate', false, 'payoutFound', false);
  end if;

  v_result := public.apply_payout_result(
    v_payout.id, p_status, p_provider_payout_id, p_provider_status, p_failure_code, p_failure_reason
  );

  update public.provider_webhook_events
    set processed = true, processed_at = now()
    where provider = p_provider and provider_event_id = p_provider_event_id;

  return v_result;
end;
$function$;

revoke all on function public.apply_payout_webhook(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_payout_webhook(text, text, text, text, text, text, text, text)
  to service_role;

commit;
