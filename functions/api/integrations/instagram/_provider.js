// Instagram provider abstraction (Instagram API with Instagram Login / Business
// Login for Instagram — i.e. the flow that connects an Instagram Professional
// account directly, with no Facebook Page required). All raw Meta/Instagram
// endpoints are centralized in this one file; nothing else in the codebase
// should hardcode a graph.instagram.com/instagram.com URL or API version.
//
// IMPORTANT: Meta's OAuth/Graph endpoints and parameters do change between
// API versions. The endpoints below reflect the currently-documented
// Instagram API with Instagram Login flow at the time this was written —
// re-verify each URL against Meta's live developer docs
// (developers.facebook.com/docs/instagram-platform) before going to
// production, and update ONLY this file if anything has moved.

const AUTHORIZE_HOST = 'https://www.instagram.com';
const SHORT_LIVED_TOKEN_HOST = 'https://api.instagram.com';
const GRAPH_HOST = 'https://graph.instagram.com';

// instagram_business_basic + instagram_business_content_publish only — no
// messaging/comments/insights scopes, per Step 2's explicit scope.
const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];

function graphVersion(env) {
  if (!env.META_GRAPH_API_VERSION) {
    throw new Error('Missing META_GRAPH_API_VERSION environment variable.');
  }
  return env.META_GRAPH_API_VERSION;
}

export function buildAuthorizationUrl(env, state) {
  const url = new URL(`${AUTHORIZE_HOST}/oauth/authorize`);
  url.searchParams.set('client_id', env.INSTAGRAM_APP_ID);
  url.searchParams.set('redirect_uri', env.INSTAGRAM_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(','));
  url.searchParams.set('state', state);
  return url.toString();
}

/** Authorization code → short-lived (1 hour) access token. */
export async function exchangeAuthorizationCode(env, code) {
  const body = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    client_secret: env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    code,
  });
  const response = await fetch(`${SHORT_LIVED_TOKEN_HOST}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new ProviderError('AUTH_CODE_EXCHANGE_FAILED', 'Could not complete Instagram sign-in.');
  }
  return { accessToken: payload.access_token, igUserId: String(payload.user_id) };
}

/** Short-lived token → long-lived token (~60 days), per Meta's documented
 *  Instagram API with Instagram Login token-exchange flow. */
export async function exchangeForLongLivedToken(env, shortLivedToken) {
  const url = new URL(`${GRAPH_HOST}/access_token`);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', env.INSTAGRAM_APP_SECRET);
  url.searchParams.set('access_token', shortLivedToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new ProviderError('LONG_LIVED_EXCHANGE_FAILED', 'Could not finish connecting Instagram.');
  }
  return {
    accessToken: payload.access_token,
    expiresInSeconds: payload.expires_in ?? 60 * 24 * 60 * 60,
  };
}

/** Refreshes a long-lived token before it expires. Must be called with a
 *  token that is itself still valid — an already-expired token cannot be
 *  refreshed and requires a full reconnect. */
export async function refreshAccessToken(env, longLivedToken) {
  const url = new URL(`${GRAPH_HOST}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', longLivedToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new ProviderError('TOKEN_REFRESH_FAILED', 'Instagram connection is no longer valid.');
  }
  return {
    accessToken: payload.access_token,
    expiresInSeconds: payload.expires_in ?? 60 * 24 * 60 * 60,
  };
}

export async function getCurrentAccount(env, accessToken) {
  const url = new URL(`${GRAPH_HOST}/me`);
  url.searchParams.set('fields', 'id,username,account_type');
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.id) {
    throw new ProviderError('ACCOUNT_LOOKUP_FAILED', 'Could not read the Instagram account.');
  }
  return { id: String(payload.id), username: payload.username, accountType: payload.account_type };
}

async function graphPost(env, path, accessToken, params) {
  const url = new URL(`${GRAPH_HOST}/${graphVersion(env)}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(url, { method: 'POST', body });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const meta = payload?.error;
    throw new ProviderError(
      meta?.code ? `GRAPH_${meta.code}` : 'GRAPH_REQUEST_FAILED',
      'Instagram could not process this request.',
      meta,
    );
  }
  return payload;
}

/** Creates a single media container (image or video/REELS). Carousels are
 *  out of scope for Step 2 — see the publishing service for why. */
export async function createMediaContainer(
  env,
  igUserId,
  accessToken,
  { mediaUrl, isVideo, caption },
) {
  const params = isVideo
    ? { media_type: 'REELS', video_url: mediaUrl, caption }
    : { image_url: mediaUrl, caption };
  const result = await graphPost(env, `${igUserId}/media`, accessToken, params);
  return result.id;
}

/** Video containers process asynchronously — poll until FINISHED/ERROR
 *  before publishing. Image containers are typically ready immediately, but
 *  polling once is harmless. */
export async function getContainerStatus(env, containerId, accessToken) {
  const url = new URL(`${GRAPH_HOST}/${graphVersion(env)}/${containerId}`);
  url.searchParams.set('fields', 'status_code');
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ProviderError('CONTAINER_STATUS_FAILED', 'Instagram could not process this media.');
  }
  return payload.status_code; // EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED
}

export async function publishMediaContainer(env, igUserId, accessToken, creationId) {
  const result = await graphPost(env, `${igUserId}/media_publish`, accessToken, {
    creation_id: creationId,
  });
  return String(result.id);
}

/** Full container → poll → publish workflow for one image or one video.
 *  Returns the published Instagram media ID. */
export async function publishPost(env, igUserId, accessToken, { mediaUrl, isVideo, caption }) {
  const containerId = await createMediaContainer(env, igUserId, accessToken, {
    mediaUrl,
    isVideo,
    caption,
  });

  if (isVideo) {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await getContainerStatus(env, containerId, accessToken);
      if (status === 'FINISHED') break;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new ProviderError(
          'CONTAINER_PROCESSING_FAILED',
          'Instagram could not process this video.',
        );
      }
      if (attempt === maxAttempts - 1) {
        throw new ProviderError(
          'CONTAINER_PROCESSING_TIMEOUT',
          'Instagram is taking too long to process this video.',
        );
      }
      await sleep(3000);
    }
  }

  return publishMediaContainer(env, igUserId, accessToken, containerId);
}

/** Best-effort revocation. The Instagram API with Instagram Login product
 *  does not (at the time of writing) document a first-class app-initiated
 *  revoke endpoint the way Facebook Login's `/permissions` DELETE does —
 *  this mirrors that pattern since some Meta surfaces honor it for Instagram
 *  Graph tokens too, but callers MUST treat failure here as expected/normal,
 *  not an error: local credential removal is what actually matters. */
export async function disconnect(env, igUserId, accessToken) {
  try {
    const url = new URL(`${GRAPH_HOST}/${graphVersion(env)}/${igUserId}/permissions`);
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url, { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}

export class ProviderError extends Error {
  constructor(code, userMessage, providerDetail) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    // Never includes the access token — only Meta's own (sanitized) error
    // object, safe to log server-side for debugging.
    this.providerDetail = providerDetail;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
