// POST /api/whatsapp/messages/:id/retry — resend a FAILED outbound message.
import {
  authenticateRequest,
  decryptSecretSafely,
  isRateLimited,
  isWithinServiceWindow,
  json,
  requiredEnv,
  serviceRoleRest,
} from '../../_shared.js';
import { sendTextMessage, ProviderError } from '../../../integrations/whatsapp/_provider.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'whatsapp-retry', 20)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp is temporarily unavailable.' }, 503);
  }
  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const messageId = context.params.id;
  const messageResponse = await serviceRoleRest(
    env,
    `whatsapp_messages?id=eq.${encodeURIComponent(messageId)}&select=*,conversation:whatsapp_conversations(*)`,
  );
  const rows = messageResponse.ok ? await messageResponse.json().catch(() => []) : [];
  const message = rows[0];
  if (!message) {
    return json({ error: 'Message not found.' }, 404);
  }
  // Matches functions/api/integrations/instagram/retry.js's convention.
  if (message.business_id !== uid) {
    return json({ error: 'You do not own this message.' }, 403);
  }
  if (message.direction !== 'outbound') {
    return json({ error: 'Only outbound messages can be retried.' }, 400);
  }
  // Idempotency — never re-send something already sent/delivered/read, and
  // never double-fire an already-in-flight retry.
  if (message.status !== 'failed') {
    return json({ status: message.status, message: 'This message does not need a retry.' });
  }

  const conversation = message.conversation;
  if (!isWithinServiceWindow(conversation?.last_customer_message_at)) {
    return json(
      {
        error:
          'It has been more than 24 hours since this customer messaged. Send an approved message template instead.',
        code: 'OUTSIDE_SERVICE_WINDOW',
      },
      422,
    );
  }

  const integrationResponse = await serviceRoleRest(
    env,
    `business_integrations?id=eq.${encodeURIComponent(message.integration_id)}&select=*`,
  );
  const integrationRows = integrationResponse.ok
    ? await integrationResponse.json().catch(() => [])
    : [];
  const integration = integrationRows[0];
  if (!integration || integration.status !== 'connected' || !integration.access_token_encrypted) {
    return json(
      { error: 'WhatsApp connection needs attention. Reconnect WhatsApp and try again.' },
      409,
    );
  }

  await serviceRoleRest(env, `whatsapp_messages?id=eq.${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'queued', error_code: null, error_message: null }),
  });

  try {
    const accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
    const providerMessageId = await sendTextMessage(
      env,
      integration.metadata.phoneNumberId,
      accessToken,
      conversation.customer_wa_id,
      message.text_body,
    );
    await serviceRoleRest(env, `whatsapp_messages?id=eq.${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'sent',
        provider_message_id: providerMessageId,
        updated_at: new Date().toISOString(),
      }),
    });
    console.log('whatsapp.message.retry_succeeded', { businessId: uid, messageId });
    return json({ status: 'sent' });
  } catch (err) {
    const errorCode = err instanceof ProviderError ? err.code : 'UNKNOWN';
    const errorMessage =
      err instanceof ProviderError
        ? err.userMessage
        : 'WhatsApp is temporarily unavailable. Try again.';
    await serviceRoleRest(env, `whatsapp_messages?id=eq.${encodeURIComponent(messageId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error_code: errorCode,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      }),
    });
    console.error('whatsapp.message.retry_failed', { businessId: uid, messageId, errorCode });
    return json({ status: 'failed', error: errorMessage });
  }
}
