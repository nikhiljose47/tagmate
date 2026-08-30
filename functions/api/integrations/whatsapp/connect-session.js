// GET /api/integrations/whatsapp/connect-session
// Mints a one-time, short-lived session bound to the authenticated business
// (reuses the `oauth_states` table from Step 2 — see the whatsapp-integration
// migration, which widened its provider check to allow 'whatsapp'). The
// frontend passes the returned sessionId straight into Meta's Embedded
// Signup JS SDK call as `extras.sessionInfoVersion`/tracking state (exact
// SDK param name — verify against Meta's current Embedded Signup docs), then
// sends it back to /complete once the popup finishes.
import {
  authenticateRequest,
  isRateLimited,
  json,
  requiredEnv,
  serviceRoleRest,
} from '../_shared.js';

const SESSION_TTL_MINUTES = 15;

export async function onRequestGet(context) {
  if (isRateLimited(context.request, 'whatsapp-connect-session', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'WhatsApp connections are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in to connect WhatsApp.' }, 401);

  const sessionId = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();

  const insertResponse = await serviceRoleRest(env, 'oauth_states', {
    method: 'POST',
    body: JSON.stringify({
      user_id: uid,
      provider: 'whatsapp',
      nonce: sessionId,
      expires_at: expiresAt,
    }),
  });
  if (!insertResponse.ok) {
    console.error('whatsapp.connect.session_failed', await insertResponse.text());
    return json({ error: 'Could not start WhatsApp sign-in. Please try again.' }, 502);
  }

  console.log('whatsapp.oauth.started', { businessId: uid });
  return json({ sessionId });
}
