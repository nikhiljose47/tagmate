// GET  /api/whatsapp/conversations/:id/messages?limit=&before=
// POST /api/whatsapp/conversations/:id/messages
//   body: { text }                              — free-form reply (24h window only)
//   body: { template: { name, language } }       — approved template (works any time)
import {
  authenticateRequest,
  decryptSecretSafely,
  isRateLimited,
  isWithinServiceWindow,
  json,
  readJson,
  requiredEnv,
  serviceRoleRest,
} from '../../_shared.js';
import {
  sendTextMessage,
  sendTemplateMessage,
  ProviderError,
} from '../../../integrations/whatsapp/_provider.js';

const MAX_PAGE_SIZE = 100;

async function loadConversation(env, uid, conversationId) {
  const response = await serviceRoleRest(
    env,
    `whatsapp_conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`,
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  const conversation = rows[0];
  if (!conversation || conversation.business_id !== uid) return null;
  return conversation;
}

export async function onRequestGet(context) {
  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp is temporarily unavailable.' }, 503);
  }
  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const conversationId = context.params.id;
  const conversation = await loadConversation(env, uid, conversationId);
  if (!conversation) return json({ error: 'Conversation not found.' }, 404);

  const url = new URL(context.request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, MAX_PAGE_SIZE);
  const before = url.searchParams.get('before');

  let path = `whatsapp_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.desc&limit=${limit}`;
  if (before) path += `&created_at=lt.${encodeURIComponent(before)}`;

  const response = await serviceRoleRest(env, path);
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return json(rows);
}

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'whatsapp-send', 30)) {
    return json({ error: 'Too many messages sent. Please slow down.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp is temporarily unavailable.' }, 503);
  }
  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const conversationId = context.params.id;
  const conversation = await loadConversation(env, uid, conversationId);
  if (!conversation) return json({ error: 'Conversation not found.' }, 404);

  const body = await readJson(context.request);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const rawParameters = Array.isArray(body?.template?.parameters) ? body.template.parameters : [];
  const template =
    body?.template?.name && body?.template?.language
      ? {
          name: String(body.template.name),
          language: String(body.template.language),
          parameters: rawParameters.map((p) => String(p ?? '').trim()),
        }
      : null;
  if (!text && !template) {
    return json({ error: 'Message text or an approved template is required.' }, 400);
  }
  // A template that declares N variables must get exactly N non-empty values
  // — WhatsApp rejects a mismatched/blank parameter count outright, so catch
  // it here with a clear message rather than an opaque provider error.
  if (template?.parameters.length && template.parameters.some((p) => !p)) {
    return json({ error: 'Fill in every template variable before sending.' }, 400);
  }

  const integrationResponse = await serviceRoleRest(
    env,
    `business_integrations?id=eq.${encodeURIComponent(conversation.integration_id)}&select=*`,
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

  // Meta's 24-hour customer service window — outside it, free-form text
  // requires an approved template instead (see /api/whatsapp/templates).
  // Templates are explicitly exempt: that's their whole purpose.
  if (!template && !isWithinServiceWindow(conversation.last_customer_message_at)) {
    return json(
      {
        error:
          'It has been more than 24 hours since this customer messaged. Send an approved message template instead.',
        code: 'OUTSIDE_SERVICE_WINDOW',
      },
      422,
    );
  }

  const createResponse = await serviceRoleRest(env, 'whatsapp_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      business_id: uid,
      conversation_id: conversationId,
      integration_id: integration.id,
      direction: 'outbound',
      type: template ? 'template' : 'text',
      text_body: template ? `[Template: ${template.name}]` : text,
      status: 'queued',
    }),
  });
  const createdRows = createResponse.ok ? await createResponse.json().catch(() => []) : [];
  const outboundMessage = createdRows[0];
  if (!outboundMessage) {
    return json({ error: 'Could not create this message.' }, 502);
  }

  try {
    const accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
    const providerMessageId = template
      ? await sendTemplateMessage(
          env,
          integration.metadata.phoneNumberId,
          accessToken,
          conversation.customer_wa_id,
          template,
        )
      : await sendTextMessage(
          env,
          integration.metadata.phoneNumberId,
          accessToken,
          conversation.customer_wa_id,
          text,
        );
    const updated = await serviceRoleRest(
      env,
      `whatsapp_messages?id=eq.${encodeURIComponent(outboundMessage.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'sent',
          provider_message_id: providerMessageId,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const updatedRows = updated.ok ? await updated.json().catch(() => []) : [];
    console.log('whatsapp.message.sent', { businessId: uid, conversationId, providerMessageId });
    return json(updatedRows[0] ?? { ...outboundMessage, status: 'sent' });
  } catch (err) {
    const errorCode = err instanceof ProviderError ? err.code : 'UNKNOWN';
    const errorMessage =
      err instanceof ProviderError
        ? err.userMessage
        : 'WhatsApp is temporarily unavailable. Try again.';
    console.error('whatsapp.message.send_failed', { businessId: uid, conversationId, errorCode });
    await serviceRoleRest(
      env,
      `whatsapp_messages?id=eq.${encodeURIComponent(outboundMessage.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_code: errorCode,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    return json({
      ...outboundMessage,
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
    });
  }
}
