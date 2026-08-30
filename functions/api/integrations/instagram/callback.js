// GET /api/integrations/instagram/callback
// Meta redirects the signed-in-to-Instagram browser here directly — there is
// no Authorization header available on this request. Business ownership is
// therefore derived ONLY from the `state` row created by connect.js (bound
// to a uid at creation time), never from any query parameter.
import {
  requiredInstagramEnv,
  serviceRoleRest,
  encryptSecretSafely,
  PUBLISHABLE_INSTAGRAM_ACCOUNT_TYPES,
} from '../_shared.js';
import {
  exchangeAuthorizationCode,
  exchangeForLongLivedToken,
  getCurrentAccount,
  ProviderError,
} from './_provider.js';

const PROFILE_REDIRECT = '/profile';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // `Response.redirect` requires an absolute URL — resolve against this
  // request's own origin rather than hardcoding a domain.
  const redirect = (query) =>
    Response.redirect(new URL(`${PROFILE_REDIRECT}?${query}`, url.origin).toString(), 302);

  // 1. Meta-side cancellation/error (user denied, etc.)
  if (url.searchParams.get('error')) {
    console.log('instagram.oauth.callback.denied', {
      reason: url.searchParams.get('error_reason'),
    });
    return redirect('instagram=error&reason=denied');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return redirect('instagram=error&reason=missing_params');
  }

  let env;
  try {
    env = requiredInstagramEnv(context.env);
  } catch {
    return redirect('instagram=error&reason=unavailable');
  }

  // 2. Atomically claim the state row: only succeeds once, only before it
  // expires. A 0-row PATCH response means invalid/expired/already-used —
  // all three are indistinguishable to the caller on purpose.
  const claimResponse = await serviceRoleRest(
    env,
    `oauth_states?nonce=eq.${encodeURIComponent(state)}&used_at=is.null&expires_at=gt.${encodeURIComponent(
      new Date().toISOString(),
    )}&provider=eq.instagram`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
  const claimedRows = claimResponse.ok ? await claimResponse.json().catch(() => []) : [];
  const claimedState = claimedRows[0];
  if (!claimedState) {
    console.warn('instagram.oauth.callback.invalid_state');
    return redirect('instagram=error&reason=invalid_state');
  }
  const businessId = claimedState.user_id;

  try {
    const shortLived = await exchangeAuthorizationCode(env, code);
    const longLived = await exchangeForLongLivedToken(env, shortLived.accessToken);
    const account = await getCurrentAccount(env, longLived.accessToken);

    if (!PUBLISHABLE_INSTAGRAM_ACCOUNT_TYPES.includes(account.accountType)) {
      console.log('instagram.oauth.callback.unsupported_account_type', {
        businessId,
        accountType: account.accountType,
      });
      return redirect('instagram=error&reason=unsupported_account_type');
    }

    const accessTokenEncrypted = await encryptSecretSafely(env, longLived.accessToken);
    const tokenExpiresAt = new Date(Date.now() + longLived.expiresInSeconds * 1000).toISOString();

    const upsertResponse = await serviceRoleRest(
      env,
      'business_integrations?on_conflict=user_id,provider',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: businessId,
          provider: 'instagram',
          status: 'connected',
          provider_account_id: account.id,
          provider_account_name: account.username,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: null, // Instagram's long-lived token refreshes itself — see _provider.js
          token_expires_at: tokenExpiresAt,
          metadata: { accountType: account.accountType },
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!upsertResponse.ok) {
      console.error('instagram.oauth.callback.store_failed', {
        businessId,
        status: upsertResponse.status,
      });
      return redirect('instagram=error&reason=store_failed');
    }

    console.log('instagram.oauth.callback.connected', {
      businessId,
      providerAccountId: account.id,
    });
    return redirect('instagram=connected');
  } catch (err) {
    const code = err instanceof ProviderError ? err.code : 'UNKNOWN';
    console.error('instagram.oauth.callback.failed', { businessId, code, message: err.message });
    return redirect('instagram=error&reason=connection_failed');
  }
}
