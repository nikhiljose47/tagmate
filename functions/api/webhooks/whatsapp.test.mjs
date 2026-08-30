import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from './whatsapp.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  META_APP_SECRET: 'test-app-secret',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
};

async function signBody(rawBody, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

function messageChange({
  phoneNumberId = '987654',
  from = '919876543210',
  text = 'Hi',
  wamid = 'wamid.1',
}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: 'Rahul' }, wa_id: from }],
              messages: [
                {
                  from,
                  id: wamid,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function statusChange({ phoneNumberId = '987654', wamid = 'wamid.1', status = 'delivered' }) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: phoneNumberId },
              statuses: [{ id: wamid, status, timestamp: `${Math.floor(Date.now() / 1000)}` }],
            },
          },
        ],
      },
    ],
  };
}

describe('GET /api/webhooks/whatsapp (verification)', () => {
  test('accepts the correct verify token and echoes the challenge', async () => {
    const request = new Request(
      'https://example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345',
    );
    const response = await onRequestGet({ request, env });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '12345');
  });

  test('rejects an incorrect verify token', async () => {
    const request = new Request(
      'https://example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345',
    );
    const response = await onRequestGet({ request, env });
    assert.equal(response.status, 403);
  });
});

describe('POST /api/webhooks/whatsapp (events)', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('rejects a POST with an invalid signature without processing anything', async () => {
    globalThis.fetch = async () => {
      throw new Error('should never call the network for an invalid signature');
    };
    const rawBody = JSON.stringify(messageChange({}));
    const request = new Request('https://example.com/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': 'sha256=deadbeef' },
      body: rawBody,
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 403);
  });

  test('an unknown phone_number_id is logged and not attached to any business', async () => {
    let integrationLookupCalled = false;
    let anyWriteCalled = false;
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('business_integrations')) {
        integrationLookupCalled = true;
        return new Response('[]', { status: 200 });
      }
      if (href.includes('whatsapp_conversations') || href.includes('whatsapp_messages')) {
        anyWriteCalled = true;
      }
      return new Response('[]', { status: 200 });
    };
    const rawBody = JSON.stringify(messageChange({ phoneNumberId: 'unknown-number' }));
    const signature = await signBody(rawBody, env.META_APP_SECRET);
    const request = new Request('https://example.com/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': signature },
      body: rawBody,
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.equal(integrationLookupCalled, true);
    assert.equal(anyWriteCalled, false);
  });

  test('a valid inbound message creates a conversation and a message row for the right business', async () => {
    let conversationBody = null;
    let messageBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('business_integrations')) {
        return new Response(
          JSON.stringify([
            { id: 'int-1', user_id: 'business-101', metadata: { phoneNumberId: '987654' } },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('whatsapp_conversations')) {
        conversationBody = JSON.parse(init.body);
        return new Response(JSON.stringify([{ id: 'conv-1', ...conversationBody }]), {
          status: 201,
        });
      }
      if (href.includes('whatsapp_messages')) {
        messageBody = JSON.parse(init.body);
        return new Response('[{}]', { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const rawBody = JSON.stringify(messageChange({ from: '919876543210', wamid: 'wamid.abc' }));
    const signature = await signBody(rawBody, env.META_APP_SECRET);
    const request = new Request('https://example.com/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': signature },
      body: rawBody,
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.equal(conversationBody.business_id, 'business-101');
    assert.equal(conversationBody.customer_wa_id, '919876543210');
    assert.equal(messageBody.business_id, 'business-101');
    assert.equal(messageBody.provider_message_id, 'wamid.abc');
    assert.equal(messageBody.direction, 'inbound');
  });

  test('duplicate webhook delivery relies on ignore-duplicates upsert (does not need a second distinguishable write)', async () => {
    // The idempotency guarantee here comes from the DB's partial unique
    // index + `Prefer: resolution=ignore-duplicates` — this test asserts the
    // webhook handler always requests that behavior on every insert attempt,
    // so a retried delivery can never create a second row regardless of how
    // many times this handler runs.
    let insertPrefer = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('business_integrations')) {
        return new Response(
          JSON.stringify([
            { id: 'int-1', user_id: 'business-101', metadata: { phoneNumberId: '987654' } },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('whatsapp_conversations')) {
        return new Response(JSON.stringify([{ id: 'conv-1' }]), { status: 201 });
      }
      if (href.includes('whatsapp_messages')) {
        insertPrefer = init.headers?.Prefer;
        return new Response('[]', { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const rawBody = JSON.stringify(messageChange({ wamid: 'wamid.dup' }));
    const signature = await signBody(rawBody, env.META_APP_SECRET);
    const request = new Request('https://example.com/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': signature },
      body: rawBody,
    });
    await onRequestPost({ request, env });
    assert.equal(insertPrefer, 'resolution=ignore-duplicates');
  });

  test('a delivery-status update is applied when it is a forward transition', async () => {
    let statusPatchBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('business_integrations')) {
        return new Response(
          JSON.stringify([
            { id: 'int-1', user_id: 'business-101', metadata: { phoneNumberId: '987654' } },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('whatsapp_messages') && (!init || init.method === undefined)) {
        return new Response(JSON.stringify([{ id: 'msg-1', status: 'sent' }]), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'PATCH') {
        statusPatchBody = JSON.parse(init.body);
        return new Response('[{}]', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const rawBody = JSON.stringify(statusChange({ wamid: 'wamid.1', status: 'delivered' }));
    const signature = await signBody(rawBody, env.META_APP_SECRET);
    const request = new Request('https://example.com/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': signature },
      body: rawBody,
    });
    await onRequestPost({ request, env });
    assert.equal(statusPatchBody.status, 'delivered');
  });

  test('an out-of-order/duplicate status update is a no-op (idempotent)', async () => {
    let patchCalled = false;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('business_integrations')) {
        return new Response(
          JSON.stringify([
            { id: 'int-1', user_id: 'business-101', metadata: { phoneNumberId: '987654' } },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('whatsapp_messages') && (!init || init.method === undefined)) {
        // Message is already 'read' — an incoming 'delivered' must not downgrade it.
        return new Response(JSON.stringify([{ id: 'msg-1', status: 'read' }]), { status: 200 });
      }
      if (href.includes('whatsapp_messages') && init?.method === 'PATCH') {
        patchCalled = true;
        return new Response('[{}]', { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const rawBody = JSON.stringify(statusChange({ wamid: 'wamid.1', status: 'delivered' }));
    const signature = await signBody(rawBody, env.META_APP_SECRET);
    const request = new Request('https://example.com/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': signature },
      body: rawBody,
    });
    await onRequestPost({ request, env });
    assert.equal(patchCalled, false);
  });
});
