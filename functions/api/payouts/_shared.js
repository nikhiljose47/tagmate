// Shared helpers for the payout Pages Functions (functions/api/payouts/**
// and functions/api/webhooks/payout.js). Reuses the existing auth/_shared.js
// and integrations/_shared.js primitives rather than duplicating them.
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
 * service-role key. Every payout RPC is SECURITY DEFINER with EXECUTE
 * revoked from `anon`/`authenticated` (see
 * supabase/migrations/20260907010000_payout_engine.sql) — this is the only
 * path that can ever invoke them.
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
    const message = payload?.message || 'Payout service is temporarily unavailable.';
    const error = new Error(message);
    error.status = response.status;
    error.pgMessage = payload?.message;
    throw error;
  }
  return payload;
}

/**
 * Deterministic, server-generated idempotency key — never supplied by the
 * client. Bucketing by a short time window means a double-click, page
 * refresh, or network retry of the *same* logical withdrawal collapses onto
 * the same key (request_payout() then just returns the existing payout),
 * while a genuinely new request after the window (or once new rewards have
 * become available) still gets its own key. The deeper double-spend
 * protection is `request_payout()` only ever locking currently-REVEALED
 * rewards — this key just stops that one click from creating two rows.
 */
export async function buildPayoutIdempotencyKey(userId, destinationId) {
  const bucket = Math.floor(Date.now() / 120_000); // 2-minute window
  const input = `${userId}:${destinationId}:${bucket}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
