import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './disconnect.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

function requestWith(headers = {}) {
  return new Request('https://example.com/api/integrations/whatsapp/disconnect', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/integrations/whatsapp/disconnect', () => {
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

  test('scopes the update to the authenticated business and clears only credential columns', async () => {
    const calledUrls = [];
    let patchBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      calledUrls.push(href);
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('business_integrations') && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify([
            { id: 'int-1', metadata: { wabaId: 'WABA_1' }, access_token_encrypted: null },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('business_integrations') && init?.method === 'PATCH') {
        patchBody = JSON.parse(init.body);
        return new Response('[{}]', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    const response = await onRequestPost({
      request: requestWith({ Authorization: 'Bearer good-token' }),
      env,
    });
    assert.equal(response.status, 200);
    const scoped = calledUrls.filter((u) => u.includes('business_integrations'));
    assert.ok(scoped.every((u) => u.includes('user_id=eq.business-101')));
    assert.equal(patchBody.status, 'disconnected');
    assert.equal(patchBody.access_token_encrypted, null);
    // wabaId/phoneNumberId metadata is NOT cleared — kept for webhook routing/audit.
    assert.equal('metadata' in patchBody, false);
  });
});
