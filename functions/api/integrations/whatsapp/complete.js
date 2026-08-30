// POST /api/integrations/whatsapp/complete
// Body: { sessionId, code }
//
// Unlike Instagram's redirect-based OAuth, Embedded Signup is a JS SDK popup
// — Meta hands the authorization `code` straight back to the browser, which
// calls this endpoint directly (with its own Authorization bearer header).
// Ownership is still double-checked, not just trusted from the header: the
// `sessionId` must be an unused, unexpired, whatsapp-provider session that
// was ALSO minted for this exact uid — closing the same account-swap/CSRF
// gap Instagram's state row closes, even though the transport differs.
import {
  authenticateRequest,
  encryptSecretSafely,
  isRateLimited,
  json,
  readJson,
  requiredEnv,
  serviceRoleRest,
} from '../_shared.js';
import {
  exchangeSignupCode,
  getSharedWabaId,
  getPhoneNumbers,
  subscribeWaba,
  ProviderError,
} from './_provider.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'whatsapp-complete', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredEnv(context.env);
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      throw new Error('Missing Meta app environment variables.');
    }
  } catch {
    return json({ error: 'WhatsApp connections are temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const body = await readJson(context.request);
  const sessionId = body?.sessionId;
  const code = body?.code;
  if (!sessionId || !code) {
    return json({ error: 'Missing sessionId or code.' }, 400);
  }

  // Atomically claim the session — only succeeds once, only before it
  // expires, and (critically) only if it was minted for THIS uid. A session
  // minted for another business will not match here even with a valid code.
  const claimResponse = await serviceRoleRest(
    env,
    `oauth_states?nonce=eq.${encodeURIComponent(sessionId)}&used_at=is.null&expires_at=gt.${encodeURIComponent(
      new Date().toISOString(),
    )}&provider=eq.whatsapp&user_id=eq.${encodeURIComponent(uid)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
  const claimedRows = claimResponse.ok ? await claimResponse.json().catch(() => []) : [];
  if (!claimedRows[0]) {
    console.warn('whatsapp.oauth.complete.invalid_session', { businessId: uid });
    return json({ error: 'This WhatsApp sign-in session is invalid or has expired.' }, 400);
  }

  try {
    const accessToken = await exchangeSignupCode(env, code);
    const wabaId = await getSharedWabaId(env, accessToken);
    const phoneNumbers = await getPhoneNumbers(env, wabaId, accessToken);
    const phone = phoneNumbers[0];
    if (!phone) {
      console.warn('whatsapp.oauth.complete.no_phone_number', { businessId: uid, wabaId });
      return json({ error: 'No WhatsApp phone number was found for this account.' }, 400);
    }

    // Subscribing our app to the WABA's webhooks is what actually activates
    // messaging for us — a WABA connected without a successful subscription
    // is not fully operational, so it must not be reported as CONNECTED.
    let setupIncomplete = false;
    try {
      await subscribeWaba(env, wabaId, accessToken);
    } catch (err) {
      setupIncomplete = true;
      console.error('whatsapp.oauth.complete.subscribe_failed', {
        businessId: uid,
        wabaId,
        message: err.message,
      });
    }

    const accessTokenEncrypted = await encryptSecretSafely(env, accessToken);
    const metadata = {
      wabaId,
      phoneNumberId: phone.id,
      displayPhoneNumber: phone.displayPhoneNumber,
      verifiedName: phone.verifiedName,
      ...(setupIncomplete ? { setupIncomplete: true } : {}),
    };

    const upsertResponse = await serviceRoleRest(
      env,
      'business_integrations?on_conflict=user_id,provider',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          user_id: uid,
          provider: 'whatsapp',
          // A subscribe failure leaves the connection genuinely half-set-up
          // — surfaced as 'error' (Step 1's status enum has no dedicated
          // "connected but incomplete" state) with `setupIncomplete` in
          // metadata so the UI can show the specific "needs attention" copy.
          status: setupIncomplete ? 'error' : 'connected',
          provider_account_id: wabaId,
          provider_account_name: phone.verifiedName ?? null,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: null, // WhatsApp system-user tokens don't rotate the same way — see docs
          token_expires_at: null, // long-lived system-user tokens; no fixed expiry to track today
          metadata,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!upsertResponse.ok) {
      console.error('whatsapp.oauth.complete.store_failed', { businessId: uid });
      return json({ error: 'Could not save your WhatsApp connection. Please try again.' }, 502);
    }

    console.log('whatsapp.connected', {
      businessId: uid,
      wabaId,
      phoneNumberId: phone.id,
      setupIncomplete,
    });
    return json({
      provider: 'whatsapp',
      connected: !setupIncomplete,
      status: setupIncomplete ? 'error' : 'connected',
      accountName: phone.verifiedName ?? null,
      metadata,
    });
  } catch (err) {
    const code = err instanceof ProviderError ? err.code : 'UNKNOWN';
    console.error('whatsapp.oauth.complete.failed', {
      businessId: uid,
      code,
      message: err.message,
    });
    const message =
      err instanceof ProviderError
        ? err.userMessage
        : 'Could not connect WhatsApp. Please try again.';
    return json({ error: message }, 502);
  }
}
