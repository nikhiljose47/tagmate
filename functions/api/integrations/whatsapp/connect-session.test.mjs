import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './connect-session.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

function requestWith(headers = {}) {
  return new Request('https://example.com/api/integrations/whatsapp/connect-session', { headers });
}

describe('GET /api/integrations/whatsapp/connect-session', () => {
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

  test('creates a whatsapp-provider session bound to the authenticated business', async () => {
    let insertedBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/oauth_states')) {
        insertedBody = JSON.parse(init.body);
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
    assert.equal(insertedBody.user_id, 'business-101');
    assert.equal(insertedBody.provider, 'whatsapp');
    assert.equal(insertedBody.nonce, body.sessionId);
    assert.ok(new Date(insertedBody.expires_at).getTime() > Date.now());
  });
});
