// POST /api/payouts/request — requests a withdrawal to the authenticated
// user's saved payout destination. Everything that decides money —
// available balance, minimum threshold, which specific rewards get spent,
// fraud review routing — happens inside request_payout()/apply_payout_result()
// (SECURITY DEFINER, EXECUTE revoked from anon/authenticated); this function
// only derives `uid` from the verified session, generates the idempotency
// key server-side, and (once the DB has safely reserved the balance) talks
// to the payout provider. It never accepts or trusts a client-supplied
// amount, balance, or approval flag.
//
// Body: { "destinationId": "<uuid>" }
import {
  authenticateRequest,
  buildPayoutIdempotencyKey,
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
  if (isRateLimited(context.request, 'payout-request', 6)) {
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
  const destinationId = typeof body?.destinationId === 'string' ? body.destinationId.trim() : '';
  if (!isValidUuid(destinationId)) {
    return json({ error: 'Invalid payout destination.', code: 'invalid_destination' }, 400);
  }

  let providerName, provider;
  try {
    ({ name: providerName, provider } = getPayoutProvider(env));
  } catch (err) {
    console.error('payouts.request: no usable payout provider', err?.message);
    return json({ error: 'Payouts are temporarily unavailable.' }, 503);
  }

  const idempotencyKey = await buildPayoutIdempotencyKey(uid, destinationId);

  let payout;
  try {
    payout = await callRpc(env, 'request_payout', {
      p_user_id: uid,
      p_destination_id: destinationId,
      p_idempotency_key: idempotencyKey,
      p_provider: providerName,
    });
  } catch (err) {
    if (err.pgMessage === 'payouts_disabled') {
      return json({ error: 'Payouts are not enabled yet.', code: 'payouts_disabled' }, 403);
    }
    if (err.pgMessage === 'destination_not_found') {
      return json({ error: 'Payout destination not found.', code: 'destination_not_found' }, 404);
    }
    if (err.pgMessage === 'below_minimum_payout') {
      return json(
        { error: 'Your available balance is below the minimum withdrawal amount.', code: 'below_minimum' },
        400,
      );
    }
    console.error('payouts.request: request_payout failed', err?.message);
    return json({ error: 'Could not start this payout. Please try again.' }, 502);
  }

  // Already PROCESSING/PAID/etc. — this is a retry of an already-submitted
  // request (same idempotency key); nothing more to do here.
  if (payout.status !== 'REQUESTED') {
    return json(payout);
  }

  // REVIEW_REQUIRED: funds are safely reserved, but never automatically
  // submitted to the provider while flagged.
  if (payout.status === 'REVIEW_REQUIRED') {
    return json(payout);
  }

  try {
    const destinationResponse = await serviceRoleRest(
      env,
      `payout_destinations?id=eq.${encodeURIComponent(destinationId)}&select=provider_reference`,
    );
    const destinationRows = await destinationResponse.json();
    const fundAccountId = destinationRows?.[0]?.provider_reference;
    if (!fundAccountId) throw new Error('Payout destination has no provider reference.');

    const result = await provider.createPayout(env, {
      fundAccountId,
      amount: payout.amount,
      idempotencyKey,
    });

    const applied = await callRpc(env, 'apply_payout_result', {
      p_payout_id: payout.payoutId,
      p_status: result.status,
      p_provider_payout_id: result.providerPayoutId,
      p_provider_status: result.providerStatus,
      p_failure_code: null,
      p_failure_reason: null,
    });
    return json(applied);
  } catch (err) {
    // Ambiguous/ unexpected provider errors (including a genuine network
    // timeout) must NEVER be treated as "definitely failed" — that would
    // risk a retry sending money twice if the provider actually processed
    // it. Only a provider error explicitly marked `definitive` releases the
    // reserved reward balance; everything else stays PROCESSING pending
    // reconciliation (see /api/payouts/reconcile.js).
    const isDefinitive = err?.definitive === true;
    try {
      const applied = await callRpc(env, 'apply_payout_result', {
        p_payout_id: payout.payoutId,
        p_status: isDefinitive ? 'FAILED' : 'PROCESSING',
        p_provider_payout_id: null,
        p_provider_status: isDefinitive ? null : 'ambiguous_provider_response',
        p_failure_code: isDefinitive ? (err.failureCode ?? 'provider_error') : null,
        p_failure_reason: isDefinitive ? err.message : null,
      });
      console.error('payouts.request: provider submission error', err?.message);
      return json(applied);
    } catch (innerErr) {
      console.error('payouts.request: failed to record provider outcome', innerErr?.message);
      // The payout row exists and is still REQUESTED/PROCESSING — safe to
      // surface as "processing", never as a fabricated success or a
      // silently-lost request. Reconciliation can pick it up later.
      return json({ payoutId: payout.payoutId, status: 'PROCESSING' });
    }
  }
}
