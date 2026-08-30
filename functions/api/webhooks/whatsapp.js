// GET/POST /api/webhooks/whatsapp — Meta's WhatsApp Cloud API webhook.
// GET handles Meta's one-time subscription verification handshake.
// POST receives message/status events. No Authorization header is ever sent
// by Meta here — authenticity comes entirely from the `hub.verify_token`
// (GET) and the `X-Hub-Signature-256` HMAC (POST), never from a bearer token.
import { requiredEnv, serviceRoleRest } from '../integrations/_shared.js';
import { isForwardStatusTransition } from '../whatsapp/_shared.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = context.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('whatsapp.webhook.verify.misconfigured');
    return new Response('Webhook not configured.', { status: 503 });
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('whatsapp.webhook.verify.succeeded');
    return new Response(challenge, { status: 200 });
  }
  console.warn('whatsapp.webhook.verify.rejected');
  return new Response('Forbidden', { status: 403 });
}

export async function onRequestPost(context) {
  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return new Response('Webhook not configured.', { status: 503 });
  }
  if (!env.META_APP_SECRET) {
    return new Response('Webhook not configured.', { status: 503 });
  }

  // Read the RAW body for signature verification BEFORE any JSON parsing —
  // re-serializing would not reproduce Meta's exact bytes and would break
  // the HMAC comparison.
  const rawBody = await context.request.text();
  const signatureHeader = context.request.headers.get('X-Hub-Signature-256') ?? '';
  const validSignature = await verifySignature(rawBody, signatureHeader, env.META_APP_SECRET);
  if (!validSignature) {
    console.warn('whatsapp.webhook.signature_invalid');
    return new Response('Invalid signature', { status: 403 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (payload.object !== 'whatsapp_business_account') {
    // Not ours to handle — acknowledge so Meta doesn't retry indefinitely.
    return new Response('OK', { status: 200 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      try {
        await processMessagesChange(env, change.value ?? {});
      } catch (err) {
        // One malformed change must not fail the whole webhook delivery (or
        // Meta will retry the entire payload, re-processing already-handled
        // changes) — log and continue.
        console.error('whatsapp.webhook.change_failed', { message: err.message });
      }
    }
  }

  return new Response('OK', { status: 200 });
}

async function verifySignature(rawBody, signatureHeader, appSecret) {
  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = [...new Uint8Array(signatureBytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(computed, provided);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function findIntegrationByPhoneNumberId(env, phoneNumberId) {
  const response = await serviceRoleRest(
    env,
    `business_integrations?provider=eq.whatsapp&metadata->>phoneNumberId=eq.${encodeURIComponent(phoneNumberId)}&select=id,user_id,metadata`,
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return rows[0] ?? null;
}

async function upsertConversation(
  env,
  businessId,
  integrationId,
  customerWaId,
  customerName,
  timestampIso,
) {
  const response = await serviceRoleRest(
    env,
    'whatsapp_conversations?on_conflict=business_id,integration_id,customer_wa_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        business_id: businessId,
        integration_id: integrationId,
        customer_wa_id: customerWaId,
        customer_phone: customerWaId,
        customer_name: customerName ?? null,
        last_message_at: timestampIso,
        last_customer_message_at: timestampIso,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return rows[0] ?? null;
}

const INBOUND_TYPE_MAP = {
  text: 'text',
  image: 'image',
  video: 'video',
  document: 'document',
  audio: 'audio',
};

async function processMessagesChange(env, value) {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  const integration = await findIntegrationByPhoneNumberId(env, phoneNumberId);
  if (!integration) {
    // Never attach to a default/guessed business — log the orphaned asset
    // and stop. This is expected for numbers not (or no longer) connected
    // through us.
    console.warn('whatsapp.webhook.unknown_phone_number_id', { phoneNumberId });
    return;
  }
  const businessId = integration.user_id;

  for (const message of value.messages ?? []) {
    const timestampIso = message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const contact = (value.contacts ?? []).find((c) => c.wa_id === message.from);

    const conversation = await upsertConversation(
      env,
      businessId,
      integration.id,
      message.from,
      contact?.profile?.name,
      timestampIso,
    );
    if (!conversation) continue;

    const type = INBOUND_TYPE_MAP[message.type] ?? 'unknown';
    await serviceRoleRest(env, 'whatsapp_messages?on_conflict=provider_message_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        business_id: businessId,
        conversation_id: conversation.id,
        integration_id: integration.id,
        provider_message_id: message.id,
        direction: 'inbound',
        type,
        text_body: message.type === 'text' ? (message.text?.body ?? null) : null,
        provider_media_id: message[message.type]?.id ?? null,
        status: 'received',
        provider_timestamp: timestampIso,
      }),
    });
    console.log('whatsapp.message.received', {
      businessId,
      integrationId: integration.id,
      providerMessageId: message.id,
      type,
    });
  }

  for (const status of value.statuses ?? []) {
    await applyStatusUpdate(env, businessId, status);
  }
}

const STATUS_MAP = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };

async function applyStatusUpdate(env, businessId, status) {
  const nextStatus = STATUS_MAP[status.status];
  if (!nextStatus) return;

  const response = await serviceRoleRest(
    env,
    `whatsapp_messages?provider_message_id=eq.${encodeURIComponent(status.id)}&select=id,status`,
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  const existing = rows[0];
  if (!existing) {
    console.warn('whatsapp.webhook.status_for_unknown_message', {
      businessId,
      providerMessageId: status.id,
    });
    return;
  }

  if (!isForwardStatusTransition(existing.status, nextStatus)) {
    // Duplicate or out-of-order delivery — idempotent no-op.
    return;
  }

  const patch = { status: nextStatus, updated_at: new Date().toISOString() };
  if (nextStatus === 'failed') {
    const error = status.errors?.[0];
    patch.error_code = error?.code ? String(error.code) : null;
    patch.error_message = error?.title ?? 'WhatsApp could not deliver this message.';
  }

  await serviceRoleRest(env, `whatsapp_messages?id=eq.${encodeURIComponent(existing.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  console.log('whatsapp.message.status_updated', {
    businessId,
    providerMessageId: status.id,
    status: nextStatus,
  });
}
