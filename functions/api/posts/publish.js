// POST /api/posts/publish
// Body: { postId: string, destinations: Array<'website' | 'instagram'> }
//
// The frontend still creates the Post itself directly against Supabase (tag
// creation is unaffected — see post.ts) since that's this app's existing
// pattern; this endpoint's only job is recording which destinations were
// requested (PostPublication, backend-owned per Step 1's RLS) and driving
// the actual Instagram publish. Website "publishing" is just our own DB, so
// it completes synchronously; Instagram runs in the background via
// `context.waitUntil` and the client polls/subscribes to `post_publications`
// for live PENDING → PUBLISHING → PUBLISHED/FAILED updates (already readable
// by the post owner per Step 1's RLS policy).
import {
  authenticateRequest,
  isRateLimited,
  json,
  readJson,
  requiredInstagramEnv,
  serviceRoleRest,
} from '../integrations/_shared.js';
import { runInstagramPublication } from '../integrations/instagram/_publish.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'posts-publish', 30)) {
    return json({ error: 'Too many requests. Please slow down.' }, 429);
  }

  let env;
  try {
    env = requiredInstagramEnv(context.env);
  } catch {
    // Website-only publishing should still work even if Instagram env vars
    // aren't configured yet — fall back to the base Supabase env only.
    env = context.env;
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const body = await readJson(context.request);
  const postId = body?.postId;
  const destinations = Array.isArray(body?.destinations) ? body.destinations : ['website'];
  if (!postId || typeof postId !== 'string') {
    return json({ error: 'A postId is required.' }, 400);
  }

  const postResponse = await serviceRoleRest(
    env,
    `tags?id=eq.${encodeURIComponent(postId)}&select=id,user_id,images,highlight,title`,
  );
  const postRows = postResponse.ok ? await postResponse.json().catch(() => []) : [];
  const post = postRows[0];
  if (!post) return json({ error: 'Post not found.' }, 404);
  // Ownership is derived from the authenticated uid — never from the request body.
  if (post.user_id !== uid) {
    return json({ error: 'You do not own this post.' }, 403);
  }

  const result = { website: null, instagram: null };

  if (destinations.includes('website')) {
    const upserted = await upsertPublication(env, postId, 'website', {
      status: 'published',
      published_at: new Date().toISOString(),
    });
    result.website = upserted;
  }

  if (destinations.includes('instagram')) {
    const integrationResponse = await serviceRoleRest(
      env,
      `business_integrations?user_id=eq.${encodeURIComponent(uid)}&provider=eq.instagram&select=status`,
    );
    const integrationRows = integrationResponse.ok
      ? await integrationResponse.json().catch(() => [])
      : [];
    if (integrationRows[0]?.status !== 'connected') {
      return json(
        { error: 'Instagram is not connected. Connect Instagram before publishing to it.' },
        409,
      );
    }

    const pending = await upsertPublication(env, postId, 'instagram', { status: 'pending' });
    result.instagram = pending;
    console.log('instagram.publish.queued', { businessId: uid, postId, publicationId: pending.id });
    context.waitUntil(
      runInstagramPublication(env, { businessId: uid, post, publicationId: pending.id }),
    );
  }

  return json(result);
}

async function upsertPublication(env, postId, provider, patch) {
  const response = await serviceRoleRest(env, 'post_publications?on_conflict=post_id,provider', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ post_id: postId, provider, ...patch }),
  });
  const rows = response.ok ? await response.json().catch(() => []) : [];
  return rows[0] ?? null;
}
