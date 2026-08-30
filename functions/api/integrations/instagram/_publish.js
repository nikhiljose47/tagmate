// Shared Instagram publish workflow used by both the initial publish request
// (functions/api/posts/publish.js) and the retry endpoint
// (functions/api/integrations/instagram/retry.js) — kept in one place so
// retry can't silently drift from the original publish behavior.
import {
  buildInstagramCaption,
  decryptSecretSafely,
  encryptSecretSafely,
  isPubliclyFetchableUrl,
  isVideoUrl,
  serviceRoleRest,
} from '../_shared.js';
import { publishPost, ProviderError, refreshAccessToken } from './_provider.js';

const REFRESH_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // refresh if <3 days from expiry

async function loadIntegration(env, businessId) {
  const response = await serviceRoleRest(
    env,
    `business_integrations?user_id=eq.${encodeURIComponent(businessId)}&provider=eq.instagram&select=*`,
  );
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return rows[0] ?? null;
}

async function markPublication(env, publicationId, patch) {
  await serviceRoleRest(env, `post_publications?id=eq.${encodeURIComponent(publicationId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

async function markIntegrationExpired(env, integrationId) {
  await serviceRoleRest(env, `business_integrations?id=eq.${encodeURIComponent(integrationId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() }),
  });
}

/**
 * Runs the full container → poll → publish workflow for one post and updates
 * the given PostPublication row throughout (PUBLISHING → PUBLISHED/FAILED).
 * Never throws — all failure paths are captured onto the publication row so
 * callers (an immediate request, or a `waitUntil` background continuation)
 * don't need their own try/catch.
 */
export async function runInstagramPublication(env, { businessId, post, publicationId }) {
  await markPublication(env, publicationId, { status: 'publishing' });

  const integration = await loadIntegration(env, businessId);
  if (!integration || integration.status !== 'connected' || !integration.access_token_encrypted) {
    console.log('instagram.publish.not_connected', { businessId, publicationId });
    return markPublication(env, publicationId, {
      status: 'failed',
      error_code: 'INTEGRATION_NOT_CONNECTED',
      error_message: 'Instagram connection is no longer valid. Reconnect Instagram and try again.',
    });
  }

  const mediaUrl = Array.isArray(post.images) ? post.images[0] : null;
  if (!mediaUrl) {
    console.log('instagram.publish.no_media', { businessId, publicationId, postId: post.id });
    return markPublication(env, publicationId, {
      status: 'failed',
      error_code: 'NO_MEDIA',
      error_message:
        'Instagram requires an image or video. Add media to publish this post to Instagram.',
    });
  }
  if (!isPubliclyFetchableUrl(mediaUrl)) {
    console.log('instagram.publish.media_not_public', { businessId, publicationId });
    return markPublication(env, publicationId, {
      status: 'failed',
      error_code: 'MEDIA_NOT_PUBLIC',
      error_message: 'Instagram could not access this media file.',
    });
  }

  let accessToken;
  try {
    accessToken = await decryptSecretSafely(env, integration.access_token_encrypted);
  } catch (err) {
    console.error('instagram.publish.decrypt_failed', {
      businessId,
      publicationId,
      message: err.message,
    });
    return markPublication(env, publicationId, {
      status: 'failed',
      error_code: 'DECRYPT_FAILED',
      error_message: 'Instagram publishing is temporarily unavailable. Try again.',
    });
  }

  // Refresh the token before it expires rather than waiting for it to fail.
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  if (expiresAt - Date.now() < REFRESH_THRESHOLD_MS) {
    try {
      const refreshed = await refreshAccessToken(env, accessToken);
      accessToken = refreshed.accessToken;
      await serviceRoleRest(
        env,
        `business_integrations?id=eq.${encodeURIComponent(integration.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            access_token_encrypted: await encryptSecretSafely(env, refreshed.accessToken),
            token_expires_at: new Date(
              Date.now() + refreshed.expiresInSeconds * 1000,
            ).toISOString(),
            updated_at: new Date().toISOString(),
          }),
        },
      );
      console.log('instagram.token.refresh_succeeded', {
        businessId,
        integrationId: integration.id,
      });
    } catch (err) {
      console.warn('instagram.token.refresh_failed', { businessId, integrationId: integration.id });
      // Only a hard failure (token already expired/revoked) — if it's just
      // "close to expiry", the current token may still work for this call.
      if (expiresAt <= Date.now()) {
        await markIntegrationExpired(env, integration.id);
        return markPublication(env, publicationId, {
          status: 'failed',
          error_code: 'INTEGRATION_EXPIRED',
          error_message:
            'Instagram connection is no longer valid. Reconnect Instagram and try again.',
        });
      }
    }
  }

  try {
    console.log('instagram.publish.container_started', { businessId, publicationId });
    const providerPostId = await publishPost(env, integration.provider_account_id, accessToken, {
      mediaUrl,
      isVideo: isVideoUrl(mediaUrl),
      caption: buildInstagramCaption(post),
    });
    console.log('instagram.publish.succeeded', { businessId, publicationId, providerPostId });
    return markPublication(env, publicationId, {
      status: 'published',
      provider_post_id: providerPostId,
      published_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    });
  } catch (err) {
    const isAuthError = err instanceof ProviderError && /^GRAPH_(190|10|200)/.test(err.code ?? '');
    if (isAuthError) await markIntegrationExpired(env, integration.id);
    const code = err instanceof ProviderError ? err.code : 'UNKNOWN';
    const message =
      err instanceof ProviderError
        ? err.userMessage
        : 'Instagram publishing is temporarily unavailable. Try again.';
    console.error('instagram.publish.failed', {
      businessId,
      publicationId,
      code,
      detail: err instanceof ProviderError ? err.providerDetail : undefined,
    });
    return markPublication(env, publicationId, {
      status: 'failed',
      error_code: code,
      error_message: message,
    });
  }
}
