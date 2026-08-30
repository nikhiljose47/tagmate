// POST /api/integrations/instagram/disconnect
// Clears the business's own Instagram connection. Never trusts a
// businessId/integrationId from the request body — the row is looked up by
// the authenticated uid only.
import {
  authenticateRequest,
  decryptSecretSafely,
  isRateLimited,
  json,
  requiredInstagramEnv,
  serviceRoleRest,
} from '../_shared.js';
import { disconnect as revokeOnMeta } from './_provider.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'instagram-disconnect', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredInstagramEnv(context.env);
  } catch {
    return json({ error: 'Instagram connections are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) {
    return json({ error: 'You must be signed in.' }, 401);
  }

  const existingResponse = await serviceRoleRest(
    env,
    `business_integrations?user_id=eq.${encodeURIComponent(uid)}&provider=eq.instagram&select=id,provider_account_id,access_token_encrypted`,
  );
  const existingRows = existingResponse.ok ? await existingResponse.json().catch(() => []) : [];
  const integration = existingRows[0];

  if (integration?.access_token_encrypted) {
    try {
      const accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
      const revoked = await revokeOnMeta(env, integration.provider_account_id, accessToken);
      if (!revoked) {
        // Best-effort per spec — remote revocation isn't guaranteed to be
        // supported by this Meta product. Local removal below still proceeds.
        console.warn('instagram.disconnect.remote_revoke_failed', { businessId: uid });
      }
    } catch (err) {
      console.warn('instagram.disconnect.remote_revoke_error', {
        businessId: uid,
        message: err.message,
      });
    }
  }

  const updateResponse = await serviceRoleRest(
    env,
    `business_integrations?user_id=eq.${encodeURIComponent(uid)}&provider=eq.instagram`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'disconnected',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
        // provider_account_id/provider_account_name are deliberately kept —
        // non-sensitive audit trail of which account was last connected.
      }),
    },
  );
  if (!updateResponse.ok) {
    console.error('instagram.disconnect.update_failed', { businessId: uid });
    return json({ error: 'Could not disconnect Instagram. Please try again.' }, 502);
  }

  console.log('instagram.disconnected', { businessId: uid });
  return json({ provider: 'instagram', connected: false, status: 'disconnected' });
}
