// POST /api/integrations/whatsapp/disconnect
import {
  authenticateRequest,
  decryptSecretSafely,
  isRateLimited,
  json,
  requiredEnv,
  serviceRoleRest,
} from '../_shared.js';
import { unsubscribeWaba } from './_provider.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'whatsapp-disconnect', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp connections are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const existingResponse = await serviceRoleRest(
    env,
    `business_integrations?user_id=eq.${encodeURIComponent(uid)}&provider=eq.whatsapp&select=id,metadata,access_token_encrypted`,
  );
  const existingRows = existingResponse.ok ? await existingResponse.json().catch(() => []) : [];
  const integration = existingRows[0];

  if (integration?.access_token_encrypted && integration.metadata?.wabaId) {
    try {
      const accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
      const unsubscribed = await unsubscribeWaba(env, integration.metadata.wabaId, accessToken);
      if (!unsubscribed) {
        console.warn('whatsapp.disconnect.remote_unsubscribe_failed', { businessId: uid });
      }
    } catch (err) {
      console.warn('whatsapp.disconnect.remote_unsubscribe_error', {
        businessId: uid,
        message: err.message,
      });
    }
  }

  // WABA/phone identifiers are kept in metadata (non-sensitive audit trail,
  // and needed so any late-arriving webhook for this number can still be
  // attributed correctly) — only the credential columns are cleared.
  const updateResponse = await serviceRoleRest(
    env,
    `business_integrations?user_id=eq.${encodeURIComponent(uid)}&provider=eq.whatsapp`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'disconnected',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!updateResponse.ok) {
    console.error('whatsapp.disconnect.update_failed', { businessId: uid });
    return json({ error: 'Could not disconnect WhatsApp. Please try again.' }, 502);
  }

  console.log('whatsapp.disconnected', { businessId: uid });
  return json({ provider: 'whatsapp', connected: false, status: 'disconnected' });
}
