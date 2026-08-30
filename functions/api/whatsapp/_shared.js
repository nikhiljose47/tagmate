// Shared helpers for the WhatsApp inbox/messaging Pages Functions
// (functions/api/whatsapp/**). Reuses the OAuth/auth primitives from
// functions/api/integrations/_shared.js rather than duplicating them.
export {
  authenticateRequest,
  decryptSecretSafely,
  isRateLimited,
  json,
  readJson,
  requiredEnv,
  serviceRoleRest,
} from '../integrations/_shared.js';

/** Meta's customer service window: a business may send free-form replies for
 *  24 hours after the customer's last message; outside that window, an
 *  approved template is required. Re-verify this duration against Meta's
 *  current documented policy before relying on it. */
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinServiceWindow(lastCustomerMessageAt) {
  if (!lastCustomerMessageAt) return false;
  return Date.now() - new Date(lastCustomerMessageAt).getTime() < SERVICE_WINDOW_MS;
}

/** Ordering used so an out-of-order/duplicate delivery-status webhook can
 *  never move a message backwards (e.g. a stale "delivered" arriving after
 *  "read" must not downgrade it). `failed` is handled separately since it
 *  isn't a forward step from the others. */
const STATUS_RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };

export function isForwardStatusTransition(currentStatus, nextStatus) {
  if (nextStatus === 'failed') return currentStatus !== 'read' && currentStatus !== 'delivered';
  const currentRank = STATUS_RANK[currentStatus] ?? -1;
  const nextRank = STATUS_RANK[nextStatus] ?? -1;
  return nextRank > currentRank;
}
