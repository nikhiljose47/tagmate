import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './messages.js';
import { encryptSecret } from '../../../business/_crypto.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

const FAKE_ENCRYPTED_TOKEN = await encryptSecret(env, 'fake-system-user-token');

function postRequest(body, headers = {}) {
  return new Request('https://example.com/api/whatsapp/conversations/conv-1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function fakeContext(request, body) {
  return { request, env, params: { id: 'conv-1' }, waitUntil: () => {} };
}

const CONNECTED_INTEGRATION = {
  id: 'int-1',
  status: 'connected',
  access_token_encrypted: FAKE_ENCRYPTED_TOKEN,
  metadata: { phoneNumberId: 'PHONE_1' },
};

describe('POST /api/whatsapp/conversations/:id/messages', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestPost(fakeContext(postRequest({ text: 'hi' })));
    assert.equal(response.status, 401);
  });

  test('rejects sending into a conversation owned by another business', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(JSON.stringify([{ id: 'conv-1', business_id: 'business-999' }]), {
          status: 200,
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(postRequest({ text: 'hi' }, { Authorization: 'Bearer t' })),
    );
    assert.equal(response.status, 404);
  });

  test('rejects sending when WhatsApp is not connected', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(
          JSON.stringify([{ id: 'conv-1', business_id: 'business-101', integration_id: 'int-1' }]),
          { status: 200 },
        );
      }
      if (href.includes('business_integrations')) {
        return new Response(JSON.stringify([{ status: 'disconnected' }]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(postRequest({ text: 'hi' }, { Authorization: 'Bearer t' })),
    );
    assert.equal(response.status, 409);
  });

  test('rejects a free-form reply outside the 24-hour service window', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(
          JSON.stringify([
            {
              id: 'conv-1',
              business_id: 'business-101',
              integration_id: 'int-1',
              last_customer_message_at: new Date(
                Date.now() - 3 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('business_integrations')) {
        return new Response(JSON.stringify([CONNECTED_INTEGRATION]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(postRequest({ text: 'Buy now!' }, { Authorization: 'Bearer t' })),
    );
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.code, 'OUTSIDE_SERVICE_WINDOW');
  });

  test('a template message bypasses the 24-hour window check', async () => {
    let sendCalled = false;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(
          JSON.stringify([
            {
              id: 'conv-1',
              business_id: 'business-101',
              integration_id: 'int-1',
              customer_wa_id: '919876543210',
              last_customer_message_at: new Date(
                Date.now() - 5 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('business_integrations')) {
        return new Response(JSON.stringify([CONNECTED_INTEGRATION]), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'POST') {
        return new Response(JSON.stringify([{ id: 'msg-1' }]), { status: 201 });
      }
      if (href.includes('graph.facebook.com')) {
        sendCalled = true;
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.tpl' }] }), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ id: 'msg-1', status: 'sent' }]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(
        postRequest(
          { template: { name: 'order_ready', language: 'en_US' } },
          { Authorization: 'Bearer t' },
        ),
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(sendCalled, true);
  });

  test('a template with filled parameters is passed through to the provider', async () => {
    let sentBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(
          JSON.stringify([
            {
              id: 'conv-1',
              business_id: 'business-101',
              integration_id: 'int-1',
              customer_wa_id: '919876543210',
              last_customer_message_at: new Date(
                Date.now() - 5 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('business_integrations')) {
        return new Response(JSON.stringify([CONNECTED_INTEGRATION]), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'POST') {
        return new Response(JSON.stringify([{ id: 'msg-1' }]), { status: 201 });
      }
      if (href.includes('graph.facebook.com')) {
        sentBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.tpl' }] }), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ id: 'msg-1', status: 'sent' }]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(
        postRequest(
          {
            template: { name: 'order_ready', language: 'en_US', parameters: ['Rahul', '#829'] },
          },
          { Authorization: 'Bearer t' },
        ),
      ),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(sentBody.template.components, [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Rahul' },
          { type: 'text', text: '#829' },
        ],
      },
    ]);
  });

  test('rejects a template with a blank/missing required parameter', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(
          JSON.stringify([{ id: 'conv-1', business_id: 'business-101', integration_id: 'int-1' }]),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(
        postRequest(
          { template: { name: 'order_ready', language: 'en_US', parameters: ['Rahul', ''] } },
          { Authorization: 'Bearer t' },
        ),
      ),
    );
    assert.equal(response.status, 400);
  });

  test('a provider send failure marks only that message FAILED (does not throw)', async () => {
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(
          JSON.stringify([
            {
              id: 'conv-1',
              business_id: 'business-101',
              integration_id: 'int-1',
              customer_wa_id: '919876543210',
              last_customer_message_at: new Date().toISOString(),
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('business_integrations')) {
        return new Response(JSON.stringify([CONNECTED_INTEGRATION]), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'POST') {
        return new Response(JSON.stringify([{ id: 'msg-1' }]), { status: 201 });
      }
      if (href.includes('graph.facebook.com')) {
        return new Response(JSON.stringify({ error: { message: 'down', code: 1 } }), {
          status: 500,
        });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'PATCH') {
        return new Response('[{}]', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(postRequest({ text: 'hi' }, { Authorization: 'Bearer t' })),
    );
    const body = await response.json();
    assert.equal(body.status, 'failed');
  });
});
