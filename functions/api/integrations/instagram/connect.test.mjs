import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './connect.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  INSTAGRAM_APP_ID: 'app-id',
  INSTAGRAM_APP_SECRET: 'app-secret',
  INSTAGRAM_REDIRECT_URI: 'https://example.com/api/integrations/instagram/callback',
  META_GRAPH_API_VERSION: 'v21.0',
};

function requestWith(headers = {}) {
  return new Request('https://example.com/api/integrations/instagram/connect', { headers });
}

describe('GET /api/integrations/instagram/connect', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestGet({ request: requestWith(), env });
    assert.equal(response.status, 401);
  });

  test('rejects an invalid/expired Supabase session token', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    const response = await onRequestGet({
      request: requestWith({ Authorization: 'Bearer bad-token' }),
      env,
    });
    assert.equal(response.status, 401);
  });

  test('creates a state row bound to the authenticated business and returns a valid authorization URL', async () => {
    const insertedBodies = [];
    globalThis.fetch = async (url, init) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/oauth_states')) {
        insertedBodies.push(JSON.parse(init.body));
        return new Response('[{}]', { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    const response = await onRequestGet({
      request: requestWith({ Authorization: 'Bearer good-token' }),
      env,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    const url = new URL(body.authorizationUrl);
    assert.equal(url.searchParams.get('state'), insertedBodies[0].nonce);

    // Bound to the authenticated business — never anything from the request itself.
    assert.equal(insertedBodies[0].user_id, 'business-101');
    assert.equal(insertedBodies[0].provider, 'instagram');
    assert.ok(new Date(insertedBodies[0].expires_at).getTime() > Date.now());
  });
});
