// POST /api/payouts/reconcile — lets the authenticated owner of a
// PROCESSING/QUEUED payout ask the provider for its current status and
// apply it. This exists for the case webhook delivery fails or is delayed —
// it is a manual, user-initiated action (a "Check status" button), never
// something Angular polls automatically. Ownership is re-verified
// server-side before touching anything.
//
// Body: { "payoutId": "<uuid>" }
import {
  authenticateRequest,
  callRpc,
  isRateLimited,
  isValidUuid,
  json,
  readJson,
  requiredEnv,
  serviceRoleRest,
} from './_shared.js';
import { getPayoutProvider } from './providers/index.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'payout-reconcile', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'Payouts are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) {
    return json({ error: 'You must be signed in.' }, 401);
  }

  const body = await readJson(context.request);
  const payoutId = typeof body?.payoutId === 'string' ? body.payoutId.trim() : '';
  if (!isValidUuid(payoutId)) {
    return json({ error: 'Invalid payout id.', code: 'invalid_payout' }, 400);
  }

  try {
    const lookup = await serviceRoleRest(
      env,
      `payouts?id=eq.${encodeURIComponent(payoutId)}&select=id,user_id,status,provider,provider_payout_id`,
    );
    const rows = await lookup.json();
    const payoutRow = rows?.[0];
    if (!payoutRow || payoutRow.user_id !== uid) {
      return json({ error: 'Payout not found.', code: 'not_found' }, 404);
    }
    if (!['PROCESSING', 'QUEUED'].includes(payoutRow.status) || !payoutRow.provider_payout_id) {
      // Already terminal (or never submitted to a provider) — nothing to
      // reconcile; just report the current, already-authoritative state.
      return json({ payoutId: payoutRow.id, status: payoutRow.status });
    }

    const { provider } = getPayoutProvider(env);
    const result = await provider.getPayoutStatus(env, {
      providerPayoutId: payoutRow.provider_payout_id,
    });

    const applied = await callRpc(env, 'apply_payout_result', {
      p_payout_id: payoutRow.id,
      p_status: result.status,
      p_provider_payout_id: payoutRow.provider_payout_id,
      p_provider_status: result.providerStatus ?? null,
      p_failure_code: result.failureCode ?? null,
      p_failure_reason: result.failureReason ?? null,
    });
    return json(applied);
  } catch (err) {
    console.error('payouts.reconcile: failed to reconcile payout', err?.message);
    return json({ error: 'Could not check this payout right now. Please try again.' }, 502);
  }
}
