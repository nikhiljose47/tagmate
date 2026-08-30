// GET /api/integrations/instagram/connect
// Called via authenticated `fetch()` (not a plain navigation, since a
// top-level browser navigation can't carry an Authorization header) — the
// frontend gets back an authorizationUrl and does `window.location.href =
// authorizationUrl` itself. See profile.ts's connectIntegration().
import {
  authenticateRequest,
  isRateLimited,
  json,
  requiredInstagramEnv,
  serviceRoleRest,
} from '../_shared.js';
import { buildAuthorizationUrl } from './_provider.js';

const STATE_TTL_MINUTES = 10;

export async function onRequestGet(context) {
  if (isRateLimited(context.request, 'instagram-connect', 10)) {
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
    return json({ error: 'You must be signed in to connect Instagram.' }, 401);
  }

  // A cryptographically strong, single-use, short-lived nonce — bound to
  // this business in the oauth_states table, never trusted from a query
  // param at callback time.
  const nonce = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString();

  const insertResponse = await serviceRoleRest(env, 'oauth_states', {
    method: 'POST',
    body: JSON.stringify({
      user_id: uid,
      provider: 'instagram',
      nonce,
      expires_at: expiresAt,
    }),
  });
  if (!insertResponse.ok) {
    console.error('instagram.connect: failed to persist oauth state', await insertResponse.text());
    return json({ error: 'Could not start Instagram sign-in. Please try again.' }, 502);
  }

  console.log('instagram.oauth.started', { businessId: uid });
  return json({ authorizationUrl: buildAuthorizationUrl(env, nonce) });
}
