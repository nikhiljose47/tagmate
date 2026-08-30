import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './publish.js';

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
  return new Request('https://example.com/api/posts/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function fakeContext(request) {
  return { request, env, waitUntil: () => {} };
}

describe('POST /api/posts/publish', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requires authentication', async () => {
    const response = await onRequestPost(fakeContext(postRequest({ postId: 'p1' })));
    assert.equal(response.status, 401);
  });

  test('rejects publishing a post owned by another business (never trusts postId ownership blindly)', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/tags')) {
        return new Response(JSON.stringify([{ id: 'p1', user_id: 'business-999', images: [] }]), {
          status: 200,
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };
    const response = await onRequestPost(
      fakeContext(postRequest({ postId: 'p1' }, { Authorization: 'Bearer t' })),
    );
    assert.equal(response.status, 403);
  });

  test('website-only publish records a PUBLISHED website row and does not touch Instagram at all', async () => {
    let websiteUpsertBody = null;
    globalThis.fetch = async (url, init) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/tags')) {
        return new Response(
          JSON.stringify([{ id: 'p1', user_id: 'business-101', images: ['https://x/img.jpg'] }]),
          { status: 200 },
        );
      }
      if (href.includes('/rest/v1/post_publications')) {
        websiteUpsertBody = JSON.parse(init.body);
        return new Response(JSON.stringify([{ id: 'pub-1', ...websiteUpsertBody }]), {
          status: 201,
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    const response = await onRequestPost(
      fakeContext(
        postRequest({ postId: 'p1', destinations: ['website'] }, { Authorization: 'Bearer t' }),
      ),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.website.status, 'published');
    assert.equal(body.instagram, null);
    assert.equal(websiteUpsertBody.provider, 'website');
  });

  test('rejects selecting Instagram as a destination when it is not connected', async () => {
    globalThis.fetch = async (url) => {
      const href = url.toString();
      if (href.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'business-101' }), { status: 200 });
      }
      if (href.includes('/rest/v1/tags')) {
        return new Response(
          JSON.stringify([{ id: 'p1', user_id: 'business-101', images: ['https://x/img.jpg'] }]),
          { status: 200 },
        );
      }
      if (href.includes('/rest/v1/post_publications')) {
        return new Response('[{}]', { status: 201 });
      }
      if (href.includes('/rest/v1/business_integrations')) {
        return new Response(JSON.stringify([{ status: 'disconnected' }]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    };

    const response = await onRequestPost(
      fakeContext(
        postRequest(
          { postId: 'p1', destinations: ['website', 'instagram'] },
          { Authorization: 'Bearer t' },
        ),
      ),
    );
    assert.equal(response.status, 409);
  });
});
