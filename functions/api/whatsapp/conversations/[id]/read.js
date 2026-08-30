// POST /api/whatsapp/conversations/:id/read
// Marks the conversation's latest inbound message read via the Cloud API.
import {
  authenticateRequest,
  decryptSecretSafely,
  json,
  requiredEnv,
  serviceRoleRest,
} from '../../_shared.js';
import { markMessageRead } from '../../../integrations/whatsapp/_provider.js';

export async function onRequestPost(context) {
  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp is temporarily unavailable.' }, 503);
  }
  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const conversationId = context.params.id;
  const convResponse = await serviceRoleRest(
    env,
    `whatsapp_conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`,
  );
  const convRows = convResponse.ok ? await convResponse.json().catch(() => []) : [];
  const conversation = convRows[0];
  if (!conversation || conversation.business_id !== uid) {
    return json({ error: 'Conversation not found.' }, 404);
  }

  const latestResponse = await serviceRoleRest(
    env,
    `whatsapp_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&direction=eq.inbound&order=created_at.desc&limit=1&select=provider_message_id`,
  );
  const latestRows = latestResponse.ok ? await latestResponse.json().catch(() => []) : [];
  const latestMessageId = latestRows[0]?.provider_message_id;
  if (!latestMessageId) return json({ ok: true }); // nothing to mark read

  const integrationResponse = await serviceRoleRest(
    env,
    `business_integrations?id=eq.${encodeURIComponent(conversation.integration_id)}&select=*`,
  );
  const integrationRows = integrationResponse.ok
    ? await integrationResponse.json().catch(() => [])
    : [];
  const integration = integrationRows[0];
  if (!integration?.access_token_encrypted) return json({ ok: true });

  try {
    const accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
    await markMessageRead(env, integration.metadata.phoneNumberId, accessToken, latestMessageId);
  } catch (err) {
    // Best-effort — not marking read on Meta's side is not user-facing broken.
    console.warn('whatsapp.mark_read_failed', {
      businessId: uid,
      conversationId,
      message: err.message,
    });
  }
  return json({ ok: true });
}
