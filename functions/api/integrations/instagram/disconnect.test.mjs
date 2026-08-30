import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './disconnect.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  INSTAGRAM_APP_ID: 'app-id',
  INSTAGRAM_APP_SECRET: 'app-secret',
  INSTAGRAM_REDIRECT_URI: 'https://example.com/callback',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

function requestWith(headers = {}) {
  return new Request('https://example.com/api/integrations/instagram/disconnect', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/integrations/instagram/disconnect', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestPost({ request: requestWith(), env });
    assert.equal(response.status, 401);
  });

  test('scopes both the lookup and the update to the authenticated business only', async () => {
    const calledUrls = [];
    let updateBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      calledUrls.push(href);
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/business_integrations') && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify([
            { id: 'int-1', provider_account_id: 'ig-1', access_token_encrypted: null },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('/rest/v1/business_integrations') && init?.method === 'PATCH') {
        updateBody = JSON.parse(init.body);
        return new Response('[{}]', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    const response = await onRequestPost({
      request: requestWith({ Authorization: 'Bearer good-token' }),
      env,
    });

    assert.equal(response.status, 200);
    // Both requests must be filtered by user_id=eq.business-101 — never a
    // businessId supplied by the client.
    const scopedUrls = calledUrls.filter((u) => u.includes('business_integrations'));
    assert.ok(scopedUrls.every((u) => u.includes('user_id=eq.business-101')));
    assert.equal(updateBody.status, 'disconnected');
    assert.equal(updateBody.access_token_encrypted, null);
  });
});
