// GET /api/referrals/code — returns the authenticated user's referral code,
// creating one the first time it's requested. Code generation, uniqueness,
// and ownership are all decided by the create_or_get_referral_code() RPC
// (see supabase/migrations/20260905000000_referral_reward_engine.sql) — this
// function only derives `uid` from the verified session and never accepts a
// user id from the client.
import { authenticateRequest, callRpc, isRateLimited, json, requiredEnv } from './_shared.js';

export async function onRequestGet(context) {
  if (isRateLimited(context.request, 'referral-code', 30)) {
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
    const row = await callRpc(env, 'create_or_get_referral_code', { p_user_id: uid });
    if (!row) throw new Error('No referral code returned.');
    return json({
      id: row.id,
      userId: row.user_id,
      code: row.code,
      active: row.active,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('referrals.code: failed to create/get referral code', err?.message);
    return json({ error: 'Could not get your referral code. Please try again.' }, 502);
  }
}
