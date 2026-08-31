// POST /api/payouts/destinations — adds (or replaces) the authenticated
// user's payout destination. The raw identifier (e.g. a UPI VPA) is
// exchanged with the payout provider here and then discarded — only the
// provider's own references and a display-safe masked string are ever
// persisted (see add_payout_destination() in
// supabase/migrations/20260907010000_payout_engine.sql). `verified` is
// always false until a real provider's verification result says otherwise —
// never inferred from client-side format validation.
//
// Body: { "type": "upi", "identifier": "name@bank" }
import {
  authenticateRequest,
  callRpc,
  isRateLimited,
  json,
  readJson,
  requiredEnv,
} from './_shared.js';
import { getPayoutProvider } from './providers/index.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'payout-destination', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'Payouts are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) {
    return json({ error: 'You must be signed in.' }, 401);
  }

  const body = await readJson(context.request);
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  if (type !== 'upi') {
    return json({ error: 'Only UPI destinations are supported right now.', code: 'unsupported_type' }, 400);
  }
  if (!identifier) {
    return json({ error: 'Enter a UPI ID.', code: 'invalid_destination' }, 400);
  }

  try {
    const { name: providerName, provider } = getPayoutProvider(env);
    const beneficiary = await provider.createOrGetBeneficiary(env, { userId: uid });
    const destination = await provider.createOrGetDestination(env, {
      contactId: beneficiary.contactId,
      type,
      rawIdentifier: identifier,
    });

    const row = await callRpc(env, 'add_payout_destination', {
      p_user_id: uid,
      p_type: type,
      p_masked_identifier: destination.maskedIdentifier,
      p_provider_contact_id: beneficiary.contactId,
      p_provider_reference: destination.fundAccountId,
    });

    void providerName;
    return json({
      id: row.id,
      type: row.type,
      maskedIdentifier: row.masked_identifier,
      verified: row.verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    if (err?.code === 'invalid_destination') {
      return json({ error: err.message, code: 'invalid_destination' }, 400);
    }
    console.error('payouts.destinations: failed to add destination', err?.message);
    return json({ error: 'Could not save this payout destination. Please try again.' }, 502);
  }
}
