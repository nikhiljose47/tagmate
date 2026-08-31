-- Referral + reward + scratch-and-win + cash payout system — Phase 3
-- (server-side reveal + a Phase 2 leak fix). No payout logic here.
--
-- Phase 2 correction: `rewards.reward_amount` and `reward_ledger.amount` were
-- both directly SELECT-able by `authenticated` (via the plain RLS "owner can
-- read own rewards/ledger" policies), which let a client read a reward's
-- amount straight from the table before ever calling reveal_reward() — i.e.
-- before the scratch-card interaction the Angular UI is supposed to gate on.
-- RLS controls which ROWS are visible, not which of their columns are safe
-- to show pre-reveal, so the fix is the same column-grant + safe-view
-- pattern already used for `public.users`/`my_user_profile`: revoke the raw
-- column from `authenticated`, expose it only through a view that nulls it
-- out until the reward has actually been revealed.

begin;

-- ── reveal_reward ─────────────────────────────────────────────────────────
-- The only place `rewards.status` ever moves ELIGIBLE -> REVEALED. Ownership
-- is re-verified here (never trusted from the client) — `p_user_id` is the
-- backend-derived, JWT-verified caller, not a value from the request body.
create or replace function public.reveal_reward(p_user_id text, p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_reward public.rewards;
begin
  select * into v_reward from public.rewards where id = p_reward_id for update;

  -- Same generic error whether the reward doesn't exist or belongs to
  -- someone else — never confirms/denies the existence of another user's
  -- reward id.
  if not found or v_reward.user_id <> p_user_id then
    raise exception 'reward_not_found';
  end if;

  if v_reward.status = 'ELIGIBLE' then
    update public.rewards
      set status = 'REVEALED', revealed_at = now(), updated_at = now()
      where id = v_reward.id
      returning * into v_reward;

    insert into public.referral_reward_events
      (user_id, event_type, reward_id, referral_id, action, amount, resulting_status)
      values (v_reward.user_id, 'reward_revealed', v_reward.id, v_reward.referral_id,
              'reveal_reward', v_reward.reward_amount, 'REVEALED');
  elsif v_reward.status not in
        ('REVEALED', 'PAYOUT_REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED') then
    -- LOCKED (or any future pre-eligible state): nothing to reveal yet —
    -- never invent or return an amount.
    return jsonb_build_object(
      'rewardId', v_reward.id, 'status', v_reward.status, 'rewardAmount', null, 'revealedAt', null
    );
  end if;
  -- REVEALED and every later status already have a stored amount — a
  -- repeated reveal call (double-click, retry, refresh) is a safe no-op
  -- that just returns the same amount again.

  return jsonb_build_object(
    'rewardId', v_reward.id,
    'status', v_reward.status,
    'rewardAmount', v_reward.reward_amount,
    'revealedAt', v_reward.revealed_at
  );
end;
$function$;

revoke all on function public.reveal_reward(text, uuid) from public, anon, authenticated;
grant execute on function public.reveal_reward(text, uuid) to service_role;

-- ── column-level fix: rewards.reward_amount ──────────────────────────────
revoke select on table public.rewards from authenticated;
grant select (
  id, user_id, referral_id, reward_type, status, eligible_at, revealed_at, created_at, updated_at
) on table public.rewards to authenticated;

-- Safe read surface: reward_amount is nulled out until the reward has been
-- revealed (or later — PAID etc. all imply an earlier reveal), so reading
-- this view can never show an amount the scratch-card UI hasn't earned yet.
create or replace view public.my_rewards
with (security_barrier = true)
as
select
  id, user_id, referral_id, reward_type, status,
  case when status in ('LOCKED', 'ELIGIBLE') then null else reward_amount end as reward_amount,
  eligible_at, revealed_at, created_at, updated_at
from public.rewards
where user_id = auth.uid()::text;

grant select on public.my_rewards to authenticated;

-- ── column-level fix: reward_ledger.amount ───────────────────────────────
revoke select on table public.reward_ledger from authenticated;
grant select (
  id, user_id, reward_id, payout_id, type, balance_effect, metadata, created_at
) on table public.reward_ledger to authenticated;

create or replace view public.my_reward_ledger
with (security_barrier = true)
as
select
  l.id, l.user_id, l.reward_id, l.payout_id, l.type, l.balance_effect,
  case
    when l.reward_id is null then l.amount
    when r.status in ('LOCKED', 'ELIGIBLE') then null
    else l.amount
  end as amount,
  l.metadata, l.created_at
from public.reward_ledger l
left join public.rewards r on r.id = l.reward_id
where l.user_id = auth.uid()::text;

grant select on public.my_reward_ledger to authenticated;

-- ── my_reward_summary fix ─────────────────────────────────────────────────
-- Phase 2 defined this view `with (security_invoker = true)`, which runs the
-- view body with the CALLING role's own table privileges — now that
-- `authenticated` no longer has direct SELECT on `rewards.reward_amount`
-- (above), that broke this view for every user. Recreated definer-style
-- (no security_invoker), matching `my_user_profile`'s existing pattern:
-- `auth.uid()` + security_barrier is the security boundary instead. Also
-- stops counting unrevealed (ELIGIBLE/LOCKED) amounts in any total, so the
-- summary itself can never leak a reward's amount ahead of its reveal.
create or replace view public.my_reward_summary
with (security_barrier = true)
as
select
  coalesce(sum(r.reward_amount) filter (where r.status = 'REVEALED'), 0) as available_amount,
  coalesce(sum(r.reward_amount) filter (where r.status in ('PAYOUT_REQUESTED', 'PROCESSING')), 0) as pending_amount,
  coalesce(sum(r.reward_amount) filter (where r.status = 'PAID'), 0) as paid_amount,
  coalesce(sum(r.reward_amount) filter (
    where r.status in ('REVEALED', 'PAYOUT_REQUESTED', 'PROCESSING', 'PAID')
  ), 0) as total_earned_amount,
  (select count(*) from public.referrals ref where ref.referrer_user_id = auth.uid()::text) as total_referrals,
  (select count(*) from public.referrals ref
     where ref.referrer_user_id = auth.uid()::text and ref.status in ('QUALIFIED', 'REWARDED')) as qualified_referrals,
  -- Appended after the Phase 2 columns rather than inserted among them:
  -- `create or replace view` can only add columns at the end, not reorder
  -- or rename existing ones (Postgres error 42P16).
  count(*) filter (where r.status = 'ELIGIBLE') as unrevealed_count
from public.rewards r
where r.user_id = auth.uid()::text;

revoke all on table public.my_reward_summary from public, anon;
grant select on public.my_reward_summary to authenticated;

commit;
