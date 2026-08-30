import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './retry.js';

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

function postRequest(body, headers = {}) {
  return new Request('https://example.com/api/integrations/instagram/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function fakeContext(request) {
  return { request, env, waitUntil: () => {} };
}

function mockPublicationLookup(publication) {
  return async (url) => {
    const href = url.toString();
    if (href.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
    }
    if (href.includes('/rest/v1/post_publications')) {
      return new Response(JSON.stringify([publication]), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };
}

describe('POST /api/integrations/instagram/retry', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestPost(fakeContext(postRequest({ publicationId: 'pub-1' })));
    assert.equal(response.status, 401);
  });

  test('rejects retrying a publication for a post owned by another business', async () => {
    globalThis.fetch = mockPublicationLookup({
      id: 'pub-1',
      post_id: 'p1',
      status: 'failed',
      post: { id: 'p1', user_id: 'business-999', images: [] },
    });
    const response = await onRequestPost(
      fakeContext(postRequest({ publicationId: 'pub-1' }, { Authorization: 'Bearer t' })),
    );
    assert.equal(response.status, 403);
  });

  test('is idempotent — refuses to re-trigger an already-published publication', async () => {
    globalThis.fetch = mockPublicationLookup({
      id: 'pub-1',
      post_id: 'p1',
      status: 'published',
      post: { id: 'p1', user_id: 'business-101', images: ['https://x/a.jpg'] },
    });
    const response = await onRequestPost(
      fakeContext(postRequest({ publicationId: 'pub-1' }, { Authorization: 'Bearer t' })),
    );
    const body = await response.json();
    assert.equal(body.status, 'published');
  });

  test('refuses to double-trigger a publication that is already in progress', async () => {
    globalThis.fetch = mockPublicationLookup({
      id: 'pub-1',
      post_id: 'p1',
      status: 'publishing',
      post: { id: 'p1', user_id: 'business-101', images: ['https://x/a.jpg'] },
    });
    const response = await onRequestPost(
      fakeContext(postRequest({ publicationId: 'pub-1' }, { Authorization: 'Bearer t' })),
    );
    const body = await response.json();
    assert.equal(body.status, 'publishing');
  });

  test('accepts a retry for a failed publication owned by the caller', async () => {
    // The retry handler evaluates `runInstagramPublication(...)` eagerly (its
    // promise is what gets handed to waitUntil), so this mock must also
    // answer whatever that background workflow calls — not just the
    // ownership lookup — even though the test itself only asserts on the
    // synchronous response.
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/post_publications') && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify([
            {
              id: 'pub-1',
              post_id: 'p1',
              status: 'failed',
              post: { id: 'p1', user_id: 'business-101', images: ['https://x/a.jpg'] },
            },
          ]),
          { status: 200 },
        );
      }
      if (href.includes('/rest/v1/post_publications') && init?.method === 'PATCH') {
        return new Response('[{}]', { status: 200 });
      }
      if (href.includes('/rest/v1/business_integrations')) {
        return new Response(JSON.stringify([{ status: 'disconnected' }]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    let waitUntilPromise = null;
    const response = await onRequestPost({
      request: postRequest({ publicationId: 'pub-1' }, { Authorization: 'Bearer t' }),
      env,
      waitUntil: (promise) => {
        waitUntilPromise = promise;
      },
    });
    const body = await response.json();
    assert.equal(body.status, 'publishing');
    assert.ok(waitUntilPromise, 'expected the background publish workflow to be scheduled');
    await waitUntilPromise; // let the (mocked) background work settle before the test exits
  });
});
