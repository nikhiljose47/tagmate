// Shared helpers for the referral/reward Pages Functions
// (functions/api/referrals/**). Reuses the existing auth/_shared.js and
// integrations/_shared.js primitives rather than duplicating them.
import { serviceRoleHeaders } from '../integrations/_shared.js';

export {
  json,
  readJson,
  requiredEnv,
  isRateLimited,
  authenticateRequest,
  serviceRoleRest,
} from '../integrations/_shared.js';

// 4-12 uppercase letters/digits, excluding visually ambiguous characters —
// matches the alphabet generate_referral_code() actually produces, but kept
// slightly wider so legacy/manually-issued codes still validate.
const REFERRAL_CODE_PATTERN = /^[A-Z2-9]{4,12}$/;

export function isValidReferralCodeFormat(value) {
  return typeof value === 'string' && REFERRAL_CODE_PATTERN.test(value.trim().toUpperCase());
}

/**
 * Calls a Postgres function exposed via PostgREST RPC, using the
 * service-role key. Every referral/reward RPC is SECURITY DEFINER with
 * EXECUTE revoked from `anon`/`authenticated` (see
 * supabase/migrations/20260905000000_referral_reward_engine.sql) — this is
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
    const message = payload?.message || 'Referral service is temporarily unavailable.';
    const error = new Error(message);
    error.status = response.status;
    error.pgMessage = payload?.message;
    throw error;
  }
  return payload;
}
