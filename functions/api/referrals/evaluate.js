// POST /api/referrals/evaluate — re-runs qualification for the
// authenticated user's own inbound referral (i.e. where they are the
// referred user). Useful once a qualifying condition that wasn't true at
// registration time becomes true later — e.g. a future qualifying event
// like "email verified" or "first transaction completed" (see the migration
// header on 20260905000000_referral_reward_engine.sql for how to swap it).
// Safe to call repeatedly: evaluate_referral() is fully idempotent.
import {
  authenticateRequest,
  callRpc,
  isRateLimited,
  json,
  requiredEnv,
  serviceRoleRest,
} from './_shared.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'referral-evaluate', 20)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'Referrals are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) {
    return json({ error: 'You must be signed in.' }, 401);
  }

  try {
    const lookup = await serviceRoleRest(
      env,
      `referrals?referred_user_id=eq.${encodeURIComponent(uid)}&select=id&limit=1`,
    );
    if (!lookup.ok) throw new Error('Could not look up referral.');
    const rows = await lookup.json();
    const referral = Array.isArray(rows) ? rows[0] : null;
    if (!referral) {
      return json({ error: 'No referral found for this account.', code: 'not_found' }, 404);
    }

    const result = await callRpc(env, 'evaluate_referral', { p_referral_id: referral.id });
    return json(result);
  } catch (err) {
    console.error('referrals.evaluate: failed to evaluate referral', err?.message);
    return json({ error: 'Could not evaluate this referral. Please try again.' }, 502);
  }
}
