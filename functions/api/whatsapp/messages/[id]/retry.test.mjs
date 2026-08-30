import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './retry.js';
import { encryptSecret } from '../../../business/_crypto.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  META_GRAPH_API_VERSION: 'v21.0',
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

const FAKE_TOKEN = await encryptSecret(env, 'fake-token');

function requestWith(headers = {}) {
  return new Request('https://example.com/api/whatsapp/messages/msg-1/retry', {
    method: 'POST',
    headers,
  });
}

function fakeContext(request) {
  return { request, env, params: { id: 'msg-1' }, waitUntil: () => {} };
}

function messageRow(overrides = {}) {
  return {
    id: 'msg-1',
    business_id: 'business-101',
    conversation_id: 'conv-1',
    integration_id: 'int-1',
    direction: 'outbound',
    status: 'failed',
    text_body: 'hi',
    conversation: {
      id: 'conv-1',
      customer_wa_id: '919876543210',
      last_customer_message_at: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('POST /api/whatsapp/messages/:id/retry', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestPost(fakeContext(requestWith()));
    assert.equal(response.status, 401);
  });

  test('rejects retrying a message owned by another business', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_messages')) {
        return new Response(JSON.stringify([messageRow({ business_id: 'business-999' })]), {
          status: 200,
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(fakeContext(requestWith({ Authorization: 'Bearer t' })));
    // Matches Instagram's retry.js convention.
    assert.equal(response.status, 403);
  });

  test('is idempotent — does not resend an already-sent message', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_messages')) {
        return new Response(JSON.stringify([messageRow({ status: 'sent' })]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(fakeContext(requestWith({ Authorization: 'Bearer t' })));
    const body = await response.json();
    assert.equal(body.status, 'sent');
  });

  test('successfully resends a failed message within the service window', async () => {
    let sendCalled = false;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && (!init || init.method === undefined)) {
        return new Response(JSON.stringify([messageRow()]), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'PATCH') {
        return new Response('[{}]', { status: 200 });
      }
      if (href.includes('business_integrations')) {
        return new Response(
          JSON.stringify([
            {
              id: 'int-1',
              status: 'connected',
              access_token_encrypted: FAKE_TOKEN,
              metadata: { phoneNumberId: 'PHONE_1' },
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('graph.facebook.com')) {
        sendCalled = true;
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.retry' }] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(fakeContext(requestWith({ Authorization: 'Bearer t' })));
    const body = await response.json();
    assert.equal(body.status, 'sent');
    assert.equal(sendCalled, true);
  });
});
