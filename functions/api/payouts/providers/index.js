// Server-side provider abstraction so payout logic never depends on one
// provider's specific API shape. A real implementation (e.g. RazorpayX,
// Cashfree Payouts) must provide the same five operations as
// MockPayoutProvider — createOrGetBeneficiary, createOrGetDestination,
// createPayout, getPayoutStatus, verifyWebhook — and register itself below.
// Nothing else under functions/api/payouts/ or in the database needs to
// change to add one.
//
// @typedef {Object} PayoutProvider
// @property {(env, params: {userId: string}) => Promise<{contactId: string}>} createOrGetBeneficiary
// @property {(env, params: {contactId: string, type: string, rawIdentifier: string}) => Promise<{fundAccountId: string, maskedIdentifier: string}>} createOrGetDestination
// @property {(env, params: {fundAccountId: string, amount: number, idempotencyKey: string}) => Promise<{providerPayoutId: string, status: string, providerStatus: string}>} createPayout
// @property {(env, params: {providerPayoutId: string}) => Promise<{status: string, providerStatus: string, failureCode?: string, failureReason?: string}>} getPayoutStatus
// @property {(request: Request, rawBody: string, env: object) => Promise<boolean>} verifyWebhook
import { MockPayoutProvider } from './mock-provider.js';

const PROVIDERS = {
  mock: MockPayoutProvider,
};

/**
 * Resolves the active payout provider from server-only environment
 * variables. `PAYOUT_ENVIRONMENT` (development/staging/production) is
 * separate from — and just as important as — the database's
 * `payout_enabled` kill switch: this is what stops the mock provider from
 * ever silently running in a real deployment, even if `PAYOUT_PROVIDER`
 * were accidentally left as `mock` in production config.
 */
export function getPayoutProvider(env) {
  const name = env.PAYOUT_PROVIDER || 'mock';
  const isProduction = env.PAYOUT_ENVIRONMENT === 'production';

  if (name === 'mock' && isProduction && env.PAYOUT_ALLOW_MOCK_IN_PRODUCTION !== 'true') {
    throw new Error(
      'Refusing to use the mock payout provider in a production environment. ' +
        'Configure a real PAYOUT_PROVIDER before enabling payouts in production.',
    );
  }

  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown payout provider: ${name}`);
  return { name, provider };
}
