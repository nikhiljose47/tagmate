import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './templates.js';
import { encryptSecret } from '../business/_crypto.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};
const FAKE_TOKEN = await encryptSecret(env, 'fake-token');

function requestWith(headers = {}) {
  return new Request('https://example.com/api/whatsapp/templates', { headers });
}

describe('GET /api/whatsapp/templates', () => {
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

  test('rejects when WhatsApp is not connected', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('business_integrations')) {
        return new Response(JSON.stringify([{ status: 'disconnected' }]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestGet({
      request: requestWith({ Authorization: 'Bearer t' }),
      env,
    });
    assert.equal(response.status, 409);
  });

  test("returns only APPROVED templates for the caller's own WABA", async () => {
    let requestedUrl = null;
    globalThis.fetch = async (url) => {
      const href = url.toString();
      requestedUrl = href;
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('business_integrations')) {
        return new Response(
          JSON.stringify([
            {
              id: 'int-1',
              status: 'connected',
              access_token_encrypted: FAKE_TOKEN,
              metadata: { wabaId: 'WABA_1' },
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('message_templates')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: 'order_ready',
                language: 'en_US',
                category: 'UTILITY',
                status: 'APPROVED',
                components: [
                  {
                    type: 'BODY',
                    text: 'Hi {{1}}, your order {{2}} is ready.',
                    example: { body_text: [['Rahul', '#829']] },
                  },
                ],
              },
              { name: 'pending_one', language: 'en_US', category: 'UTILITY', status: 'PENDING' },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestGet({
      request: requestWith({ Authorization: 'Bearer t' }),
      env,
    });
    const body = await response.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].name, 'order_ready');
    assert.ok(requestedUrl.includes('WABA_1'));
    assert.equal(body[0].variableCount, 2);
    assert.deepEqual(body[0].exampleValues, ['Rahul', '#829']);
    assert.equal(body[0].bodyText, 'Hi {{1}}, your order {{2}} is ready.');
  });
});
