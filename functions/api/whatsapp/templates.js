// GET /api/whatsapp/templates — approved message templates for the
// authenticated business's own WABA only.
import {
  authenticateRequest,
  decryptSecretSafely,
  json,
  requiredEnv,
  serviceRoleRest,
} from './_shared.js';
import { getMessageTemplates, ProviderError } from '../integrations/whatsapp/_provider.js';

export async function onRequestGet(context) {
  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp is temporarily unavailable.' }, 503);
  }
  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const integrationResponse = await serviceRoleRest(
    env,
    `business_integrations?user_id=eq.${encodeURIComponent(uid)}&provider=eq.whatsapp&select=*`,
  );
  const rows = integrationResponse.ok ? await integrationResponse.json().catch(() => []) : [];
  const integration = rows[0];
  if (!integration || integration.status !== 'connected' || !integration.access_token_encrypted) {
    return json({ error: 'WhatsApp is not connected.' }, 409);
  }

  try {
    const accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
    const templates = await getMessageTemplates(env, integration.metadata.wabaId, accessToken);
    return json(templates);
  } catch (err) {
    console.error('whatsapp.templates.fetch_failed', { businessId: uid, message: err.message });
    const message =
      err instanceof ProviderError ? err.userMessage : 'Could not load message templates.';
    return json({ error: message }, 502);
  }
}
