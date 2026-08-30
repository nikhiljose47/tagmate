import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './complete.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  META_APP_ID: 'meta-app-id',
  META_APP_SECRET: 'meta-app-secret',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

function postRequest(body, headers = {}) {
  return new Request('https://example.com/api/integrations/whatsapp/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function mockGraphSuccess({ subscribeOk = true } = {}) {
  return async (url, init) => {
    const href = url.toString();
    if (href.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
    }
    if (href.includes('/rest/v1/oauth_states')) {
      const rows = init?.method === 'PATCH' ? [{ user_id: 'business-101' }] : [];
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (href.includes('graph.facebook.com') && href.includes('oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'business-token' }), { status: 200 });
    }
    if (href.includes('debug_token')) {
      return new Response(
        JSON.stringify({
          data: {
            granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['WABA_1'] }],
          },
        }),
        { status: 200 },
      );
    }
    if (href.includes('/phone_numbers')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'PHONE_1',
              display_phone_number: '+91 98765 43210',
              verified_name: "Joe's Pizza",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (href.includes('subscribed_apps') && init?.method === 'POST') {
      return subscribeOk
        ? new Response('{}', { status: 200 })
        : new Response(JSON.stringify({ error: { message: 'nope' } }), { status: 400 });
    }
    if (href.includes('/rest/v1/business_integrations')) {
      return new Response('[{}]', { status: 201 });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };
}

describe('POST /api/integrations/whatsapp/complete', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestPost({
      request: postRequest({ sessionId: 'x', code: 'y' }),
      env,
    });
    assert.equal(response.status, 401);
  });

  test('rejects an invalid/expired session', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('oauth_states')) return new Response('[]', { status: 200 });
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost({
      request: postRequest(
        { sessionId: 'bad-session', code: 'abc' },
        { Authorization: 'Bearer t' },
      ),
      env,
    });
    assert.equal(response.status, 400);
  });

  test('Business A cannot complete a session minted for Business B (claim filters by uid too)', async () => {
    let claimUrl = null;
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-A' }), { status: 200 });
      }
      if (href.includes('oauth_states')) {
        claimUrl = href;
        // Simulate PostgREST correctly finding 0 rows because the session's
        // user_id filter (business-B) doesn't match the caller (business-A).
        return new Response('[]', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost({
      request: postRequest(
        { sessionId: 'session-for-business-B', code: 'abc' },
        { Authorization: 'Bearer business-A-token' },
      ),
      env,
    });
    assert.equal(response.status, 400);
    assert.ok(claimUrl.includes('user_id=eq.business-A'));
  });

  test('a successful signup stores CONNECTED with WABA/phone metadata and an encrypted token', async () => {
    let storedBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/rest/v1/business_integrations')) {
        storedBody = JSON.parse(init.body);
      }
      return mockGraphSuccess({ subscribeOk: true })(url, init);
    };
    const response = await onRequestPost({
      request: postRequest({ sessionId: 's1', code: 'abc' }, { Authorization: 'Bearer t' }),
      env,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.connected, true);
    assert.equal(body.status, 'connected');
    assert.equal(storedBody.status, 'connected');
    assert.equal(storedBody.metadata.wabaId, 'WABA_1');
    assert.equal(storedBody.metadata.phoneNumberId, 'PHONE_1');
    assert.equal(storedBody.metadata.displayPhoneNumber, '+91 98765 43210');
    assert.notEqual(storedBody.access_token_encrypted, 'business-token');
  });

  test('a subscribe failure stores an incomplete-setup state, not full success', async () => {
    let storedBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/rest/v1/business_integrations')) {
        storedBody = JSON.parse(init.body);
      }
      return mockGraphSuccess({ subscribeOk: false })(url, init);
    };
    const response = await onRequestPost({
      request: postRequest({ sessionId: 's1', code: 'abc' }, { Authorization: 'Bearer t' }),
      env,
    });
    const body = await response.json();
    assert.equal(body.connected, false);
    assert.equal(body.status, 'error');
    assert.equal(storedBody.status, 'error');
    assert.equal(storedBody.metadata.setupIncomplete, true);
  });
});
