// POST /api/webhooks/payout — the payout provider's webhook. No
// Authorization header is ever sent here (Angular can never reach this
// endpoint — it's not linked from anywhere client-facing); authenticity
// comes entirely from the provider's own signature, verified against the
// RAW request body before any JSON parsing (re-serializing would not
// reproduce the provider's exact bytes and would break the signature
// check) — same pattern as functions/api/webhooks/whatsapp.js.
//
// Duplicate deliveries are expected and handled at the database level: see
// apply_payout_webhook()'s unique (provider, provider_event_id) gate in
// supabase/migrations/20260907010000_payout_engine.sql.
import { callRpc, requiredEnv } from '../payouts/_shared.js';
import { getPayoutProvider } from '../payouts/providers/index.js';

export async function onRequestPost(context) {
  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return new Response('Webhook not configured.', { status: 503 });
  }

  let provider, providerName;
  try {
    ({ provider, name: providerName } = getPayoutProvider(env));
  } catch (err) {
    console.error('payout.webhook: no usable payout provider', err?.message);
    return new Response('Webhook not configured.', { status: 503 });
  }

  const rawBody = await context.request.text();
  const validSignature = await provider.verifyWebhook(context.request, rawBody, env);
  if (!validSignature) {
    console.warn('payout.webhook.signature_invalid');
    return new Response('Invalid signature', { status: 403 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  // The mock provider's payload already speaks our internal vocabulary
  // (PROCESSING/PAID/FAILED/REVERSED). A real provider adapter would
  // translate its own event/status vocabulary into these same values here,
  // before calling apply_payout_webhook — the RPC itself stays provider-agnostic.
  const eventId = typeof payload?.eventId === 'string' ? payload.eventId : '';
  const eventType = typeof payload?.eventType === 'string' ? payload.eventType : 'unknown';
  const providerPayoutId = typeof payload?.payoutId === 'string' ? payload.payoutId : '';
  const status = typeof payload?.status === 'string' ? payload.status : '';

  if (!eventId || !providerPayoutId || !status) {
    console.warn('payout.webhook.malformed_payload');
    return new Response('Malformed payload', { status: 400 });
  }

  try {
    const result = await callRpc(env, 'apply_payout_webhook', {
      p_provider: providerName,
      p_provider_event_id: eventId,
      p_event_type: eventType,
      p_provider_payout_id: providerPayoutId,
      p_status: status,
      p_provider_status: payload?.providerStatus ?? null,
      p_failure_code: payload?.failureCode ?? null,
      p_failure_reason: payload?.failureReason ?? null,
    });
    console.log('payout.webhook.processed', { eventId, providerPayoutId, status: result?.status });
    return new Response('OK', { status: 200 });
  } catch (err) {
    // A non-2xx response tells the provider to retry — correct here, since
    // a transient DB error means the event was NOT durably applied yet.
    // apply_payout_webhook()'s own idempotency gate makes that retry safe:
    // it only ever applies a given (provider, eventId) once it actually
    // succeeds.
    console.error('payout.webhook: failed to apply webhook', err?.message);
    return new Response('Temporary failure', { status: 500 });
  }
}
