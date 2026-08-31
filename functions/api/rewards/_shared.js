// Shared helpers for the reward Pages Functions (functions/api/rewards/**).
// Reuses the existing auth/_shared.js and integrations/_shared.js primitives
// rather than duplicating them.
import { serviceRoleHeaders } from '../integrations/_shared.js';

export {
  json,
  readJson,
  requiredEnv,
  isRateLimited,
  authenticateRequest,
  serviceRoleRest,
} from '../integrations/_shared.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Calls a Postgres function exposed via PostgREST RPC, using the
 * service-role key. Every reward RPC is SECURITY DEFINER with EXECUTE
 * revoked from `anon`/`authenticated` (see
 * supabase/migrations/20260906000000_referral_reward_reveal.sql) — this is
 * the only path that can ever invoke them.
 */
export async function callRpc(env, fnName, args) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      ...serviceRoleHeaders(env),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(args),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || 'Reward service is temporarily unavailable.';
    const error = new Error(message);
    error.status = response.status;
    error.pgMessage = payload?.message;
    throw error;
  }
  return payload;
}
