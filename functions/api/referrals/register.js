// POST /api/referrals/register — attributes the authenticated (newly
// registered) user to a referrer, then immediately runs qualification.
// Everything privileged — code lookup, self-referral rejection, "already
// attributed" idempotency, qualification, and reward creation — happens
// inside the register_referral()/evaluate_referral() RPCs (SECURITY
// DEFINER, EXECUTE revoked from anon/authenticated) so a manipulated client
// request can never change who gets credited or how much a reward is worth.
//
// Body: { "referralCode": "ABC123" } — the current user (the one being
// referred) is derived from the verified session, never from the request.
import {
  authenticateRequest,
  callRpc,
  isRateLimited,
  isValidReferralCodeFormat,
  json,
  readJson,
  requiredEnv,
} from './_shared.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'referral-register', 10)) {
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

  const body = await readJson(context.request);
  const referralCode = typeof body?.referralCode === 'string' ? body.referralCode.trim() : '';
  if (!isValidReferralCodeFormat(referralCode)) {
    return json({ error: 'Invalid referral code.', code: 'invalid_referral_code' }, 400);
  }

  try {
    const result = await callRpc(env, 'register_referral', {
      p_referred_user_id: uid,
      p_code: referralCode.toUpperCase(),
    });
    return json(result);
  } catch (err) {
    if (err.pgMessage === 'invalid_referral_code') {
      return json({ error: 'That referral code is invalid.', code: 'invalid_referral_code' }, 400);
    }
    if (err.pgMessage === 'self_referral') {
      return json({ error: 'You cannot refer yourself.', code: 'self_referral' }, 400);
    }
    console.error('referrals.register: failed to register referral', err?.message);
    return json({ error: 'Could not register this referral. Please try again.' }, 502);
  }
}
