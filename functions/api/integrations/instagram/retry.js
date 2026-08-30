// POST /api/integrations/instagram/retry
// Body: { publicationId: string }
import {
  authenticateRequest,
  isRateLimited,
  json,
  readJson,
  requiredInstagramEnv,
  serviceRoleRest,
} from '../_shared.js';
import { runInstagramPublication } from './_publish.js';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'instagram-retry', 15)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  let env;
  try {
    env = requiredInstagramEnv(context.env);
  } catch {
    return json({ error: 'Instagram publishing is temporarily unavailable.' }, 503);
  }

  const uid = await authenticateRequest(context.request, env);
  if (!uid) return json({ error: 'You must be signed in.' }, 401);

  const body = await readJson(context.request);
  const publicationId = body?.publicationId;
  if (!publicationId || typeof publicationId !== 'string') {
    return json({ error: 'A publicationId is required.' }, 400);
  }

  const pubResponse = await serviceRoleRest(
    env,
    `post_publications?id=eq.${encodeURIComponent(publicationId)}&provider=eq.instagram&select=id,post_id,status,post:tags(id,user_id,images,highlight,title)`,
  );
  const pubRows = pubResponse.ok ? await pubResponse.json().catch(() => []) : [];
  const publication = pubRows[0];
  if (!publication) return json({ error: 'Publication not found.' }, 404);

  const post = publication.post;
  // Ownership: the post referenced by this publication must belong to the
  // authenticated business — never trust the publicationId alone as proof.
  if (!post || post.user_id !== uid) {
    return json({ error: 'You do not own this post.' }, 403);
  }

  // Idempotency: never re-trigger a publish that's already succeeded or is
  // actively in flight — avoids duplicate Instagram posts from a double-click
  // or overlapping retry.
  if (publication.status === 'published') {
    return json({ status: 'published', message: 'Already published to Instagram.' });
  }
  if (publication.status === 'publishing') {
    return json({ status: 'publishing', message: 'Instagram publishing is already in progress.' });
  }

  console.log('instagram.retry.started', { businessId: uid, publicationId });
  context.waitUntil(
    runInstagramPublication(env, { businessId: uid, post, publicationId: publication.id }),
  );
  return json({ status: 'publishing' });
}
