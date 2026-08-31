// POST /api/rewards/reveal — reveals the authenticated user's own eligible
// reward. Ownership, current status, and the actual amount are all decided
// by the reveal_reward() RPC (SECURITY DEFINER, EXECUTE revoked from
// anon/authenticated) — this function only derives `uid` from the verified
// session and forwards the reward id; it never accepts or trusts a
// client-supplied amount or status.
//
// Body: { "rewardId": "<uuid>" }
import {
  authenticateRequest,
  callRpc,
  isRateLimited,
  isValidUuid,
  json,
  readJson,
  requiredEnv,
} from './_shared.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'reward-reveal', 20)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'Rewards are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) {
    return json({ error: 'You must be signed in.' }, 401);
  }

  const body = await readJson(context.request);
  const rewardId = typeof body?.rewardId === 'string' ? body.rewardId.trim() : '';
  if (!isValidUuid(rewardId)) {
    return json({ error: 'Invalid reward id.', code: 'invalid_reward' }, 400);
  }

  try {
    const result = await callRpc(env, 'reveal_reward', { p_user_id: uid, p_reward_id: rewardId });
    return json(result);
  } catch (err) {
    if (err.pgMessage === 'reward_not_found') {
      return json({ error: 'Reward not found.', code: 'not_found' }, 404);
    }
    console.error('rewards.reveal: failed to reveal reward', err?.message);
    return json({ error: 'Could not reveal this reward. Please try again.' }, 502);
  }
}
