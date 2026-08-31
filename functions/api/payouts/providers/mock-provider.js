// A safe, no-real-money simulation of a payout provider — implements the
// PayoutProvider interface (see ./index.js) so the whole request/webhook/
// reconcile pipeline can be built and tested without any real provider
// account. Never activates in production unless explicitly overridden (see
// getPayoutProvider() in ./index.js).
//
// Test hooks (amount is in paise): the ones digit of the amount controls
// simulated behavior on createPayout(), so failure/timeout/reconciliation
// paths can be exercised through the real request-payout endpoint without a
// special test-only code branch:
//   ...×13  -> a definitive provider failure (maps to payout FAILED)
//   ...×07  -> a simulated timeout/ambiguous response (payout stays PROCESSING)
//   anything else -> normal PROCESSING, resolves to PAID on getPayoutStatus()

function maskUpi(rawIdentifier) {
  const [local, domain] = String(rawIdentifier).split('@');
  if (!domain) return 'unknown';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const MockPayoutProvider = {
  async createOrGetBeneficiary(env, { userId }) {
    return { contactId: `mock_contact_${userId.slice(0, 12)}` };
  },

  async createOrGetDestination(env, { contactId, type, rawIdentifier }) {
    if (type !== 'upi') {
      throw new Error('The mock provider only supports UPI destinations.');
    }
    if (!/^[\w.+-]{2,}@[a-zA-Z]{2,}$/.test(rawIdentifier)) {
      const error = new Error("That doesn't look like a valid UPI ID.");
      error.code = 'invalid_destination';
      throw error;
    }
    return {
      fundAccountId: `fa_mock_${contactId}`,
      maskedIdentifier: maskUpi(rawIdentifier),
    };
  },

  async createPayout(env, { fundAccountId, amount, idempotencyKey }) {
    const providerPayoutId = `pout_mock_${idempotencyKey.slice(0, 16)}`;
    const cents = amount % 100;
    if (cents === 13) {
      const error = new Error('Simulated definitive provider failure.');
      error.definitive = true;
      error.failureCode = 'mock_simulated_failure';
      throw error;
    }
    if (cents === 7) {
      const error = new Error('Simulated provider timeout — outcome unknown.');
      error.ambiguous = true;
      throw error;
    }
    void fundAccountId;
    return { providerPayoutId, status: 'PROCESSING', providerStatus: 'queued' };
  },

  async getPayoutStatus(env, { providerPayoutId }) {
    void providerPayoutId;
    // The simulation always resolves to PAID — a real provider would be
    // queried live here for the actual current status.
    return { status: 'PAID', providerStatus: 'processed' };
  },

  async verifyWebhook(request, rawBody, env) {
    // Fail closed: an unconfigured secret must never make every signature
    // "valid" (which is what comparing against an empty-string HMAC would
    // effectively do).
    if (!env.PAYOUT_WEBHOOK_SECRET) return false;
    const signature = request.headers.get('X-Mock-Signature') ?? '';
    if (!signature) return false;
    const expected = await hmacHex(env.PAYOUT_WEBHOOK_SECRET, rawBody);
    return timingSafeEqual(signature, expected);
  },
};
