import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './callback.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  INSTAGRAM_APP_ID: 'app-id',
  INSTAGRAM_APP_SECRET: 'app-secret',
  INSTAGRAM_REDIRECT_URI: 'https://example.com/api/integrations/instagram/callback',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

function callbackRequest(query) {
  return new Request(`https://example.com/api/integrations/instagram/callback?${query}`);
}

function locationOf(response) {
  return new URL(response.headers.get('Location'), 'https://example.com');
}

describe('GET /api/integrations/instagram/callback', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('handles Meta-side denial without touching the network', async () => {
    globalThis.fetch = async () => {
      throw new Error('should not be called');
    };
    const response = await onRequestGet({
      request: callbackRequest('error=access_denied&error_reason=user_denied'),
      env,
    });
    assert.equal(response.status, 302);
    assert.equal(locationOf(response).searchParams.get('instagram'), 'error');
  });

  test('rejects a callback missing code/state', async () => {
    const response = await onRequestGet({ request: callbackRequest(''), env });
    assert.equal(locationOf(response).searchParams.get('reason'), 'missing_params');
  });

  test('rejects an invalid/expired/already-used state (0 rows claimed)', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/rest/v1/oauth_states')) return new Response('[]', { status: 200 });
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestGet({
      request: callbackRequest('code=abc&state=bad-nonce'),
      env,
    });
    assert.equal(locationOf(response).searchParams.get('reason'), 'invalid_state');
  });

  test('rejects a non-Business/Creator Instagram account', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/rest/v1/oauth_states')) {
        return new Response(JSON.stringify([{ user_id: 'business-101' }]), { status: 200 });
      }
      if (href.includes('api.instagram.com/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'short', user_id: 1 }), { status: 200 });
      }
      if (href.includes('graph.instagram.com/access_token')) {
        return new Response(JSON.stringify({ access_token: 'long', expires_in: 5_184_000 }), {
          status: 200,
        });
      }
      if (href.includes('graph.instagram.com/me')) {
        return new Response(
          JSON.stringify({ id: '1', username: 'someone', account_type: 'PERSONAL' }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestGet({
      request: callbackRequest('code=abc&state=good-nonce'),
      env,
    });
    assert.equal(locationOf(response).searchParams.get('reason'), 'unsupported_account_type');
  });

  test('a successful callback stores a CONNECTED, encrypted integration and never logs/redirects with the token', async () => {
    let storedBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/rest/v1/oauth_states')) {
        return new Response(JSON.stringify([{ user_id: 'business-101' }]), { status: 200 });
      }
      if (href.includes('api.instagram.com/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'SHORT_SECRET', user_id: 1 }), {
          status: 200,
        });
      }
      if (href.includes('graph.instagram.com/access_token')) {
        return new Response(
          JSON.stringify({ access_token: 'LONG_LIVED_SECRET_TOKEN', expires_in: 5_184_000 }),
          { status: 200 },
        );
      }
      if (href.includes('graph.instagram.com/me')) {
        return new Response(
          JSON.stringify({
            id: '17841400000000000',
            username: 'joespizza',
            account_type: 'BUSINESS',
          }),
          { status: 200 },
        );
      }
      if (href.includes('/rest/v1/business_integrations')) {
        storedBody = JSON.parse(init.body);
        return new Response('[{}]', { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    const response = await onRequestGet({
      request: callbackRequest('code=abc&state=good-nonce'),
      env,
    });

    assert.equal(locationOf(response).searchParams.get('instagram'), 'connected');
    assert.ok(storedBody, 'expected an upsert into business_integrations');
    assert.equal(storedBody.user_id, 'business-101');
    assert.equal(storedBody.status, 'connected');
    assert.equal(storedBody.provider_account_id, '17841400000000000');
    assert.equal(storedBody.provider_account_name, 'joespizza');
    // Token must be encrypted at rest — never the plaintext long-lived token.
    assert.notEqual(storedBody.access_token_encrypted, 'LONG_LIVED_SECRET_TOKEN');
    assert.equal(storedBody.access_token_encrypted.includes('LONG_LIVED_SECRET_TOKEN'), false);
    // Nothing in the redirect Location leaks the token either.
    assert.equal(response.headers.get('Location').includes('LONG_LIVED_SECRET_TOKEN'), false);
  });
});
