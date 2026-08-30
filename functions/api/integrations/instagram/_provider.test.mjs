import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  getCurrentAccount,
  ProviderError,
} from './_provider.js';

const env = {
  INSTAGRAM_APP_ID: 'app-id-123',
  INSTAGRAM_APP_SECRET: 'app-secret-abc',
  INSTAGRAM_REDIRECT_URI: 'https://example.com/api/integrations/instagram/callback',
  META_GRAPH_API_VERSION: 'v21.0',
};

describe('buildAuthorizationUrl', () => {
  test('requests exactly the two Step-2 scopes, current permission names', () => {
    const url = new URL(buildAuthorizationUrl(env, 'nonce-1'));
    assert.equal(url.origin, 'https://www.instagram.com');
    assert.equal(url.searchParams.get('client_id'), 'app-id-123');
    assert.equal(url.searchParams.get('redirect_uri'), env.INSTAGRAM_REDIRECT_URI);
    assert.equal(url.searchParams.get('state'), 'nonce-1');
    assert.equal(
      url.searchParams.get('scope'),
      'instagram_business_basic,instagram_business_content_publish',
    );
  });
});

describe('exchangeAuthorizationCode / getCurrentAccount (mocked Meta API)', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('exchangeAuthorizationCode returns the short-lived token on success', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ access_token: 'short-lived-token', user_id: 999 }), {
        status: 200,
      });
    const result = await exchangeAuthorizationCode(env, 'auth-code');
    assert.equal(result.accessToken, 'short-lived-token');
    assert.equal(result.igUserId, '999');
  });

  test('exchangeAuthorizationCode throws a ProviderError on Meta failure', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error_message: 'invalid code' }), { status: 400 });
    await assert.rejects(() => exchangeAuthorizationCode(env, 'bad-code'), ProviderError);
  });

  test('getCurrentAccount surfaces id/username/account_type', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          id: '17841400000000000',
          username: 'joespizza',
          account_type: 'BUSINESS',
        }),
        { status: 200 },
      );
    const account = await getCurrentAccount(env, 'token');
    assert.deepEqual(account, {
      id: '17841400000000000',
      username: 'joespizza',
      accountType: 'BUSINESS',
    });
  });
});
