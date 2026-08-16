import { isRateLimited, json, requiredEnv } from './_shared';

/**
 * Permanently deletes the caller's own account:
 *  1. Removes their uploaded post images from the `tag-images` Storage
 *     bucket (must happen before step 2 — once the `tags` rows are gone via
 *     cascade, there's no longer a record of which files were theirs).
 *  2. Calls the `delete_own_account()` RPC with the caller's OWN access
 *     token (not the service-role key) — it's SECURITY DEFINER but scoped
 *     to `auth.uid()`, so this step never risks touching the wrong row.
 *     That RPC's cascade removes their `public.users` row and everything
 *     hanging off it (posts, comments, reactions, follows, DMs, etc).
 *  3. Deletes the `auth.users` row via the admin API — this is the one step
 *     that genuinely requires the service-role key.
 */
export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'delete-account', 5)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  const authHeader = context.request.headers.get('Authorization') ?? '';
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return json({ error: 'You must be signed in to delete your account.' }, 401);
  }

  let env;
  try {
    env = requiredEnv(context.env);
  } catch {
    return json({ error: 'Account deletion is temporarily unavailable.' }, 503);
  }

  try {
    const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userResponse.ok) {
      return json({ error: 'Your session has expired. Please sign in again.' }, 401);
    }
    const authUser = await userResponse.json();
    const uid = authUser?.id;
    if (!uid) {
      return json({ error: 'Your session has expired. Please sign in again.' }, 401);
    }

    const serviceHeaders = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    };

    // Best-effort: pull this user's post image paths and remove the actual
    // files from Storage. A failure here shouldn't block account deletion —
    // an orphaned image is a much smaller problem than a stuck delete.
    try {
      const tagsUrl = new URL('/rest/v1/tags', env.SUPABASE_URL);
      tagsUrl.searchParams.set('select', 'images');
      tagsUrl.searchParams.set('user_id', `eq.${uid}`);
      const tagsResponse = await fetch(tagsUrl, { headers: serviceHeaders });
      if (tagsResponse.ok) {
        const rows = await tagsResponse.json();
        const paths = rows
          .flatMap((row) => row?.images ?? [])
          .map(storagePathFromPublicUrl)
          .filter(Boolean);
        if (paths.length) {
          await fetch(`${env.SUPABASE_URL}/storage/v1/object/tag-images`, {
            method: 'DELETE',
            headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: paths }),
          });
        }
      }
    } catch {
      // Non-fatal — continue with the account deletion regardless.
    }

    // Scoped to auth.uid() inside the function itself — called with the
    // caller's own token, not the service-role key.
    const rpcDelete = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/delete_own_account`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!rpcDelete.ok) {
      return json({ error: 'Could not delete your account data. Please try again.' }, 502);
    }

    const authDelete = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });
    if (!authDelete.ok) {
      // Profile data is already gone; the login itself will be cleaned up on
      // retry (re-running the RPC against an already-gone profile is a no-op).
      return json({ error: 'Account data was removed, but sign-in cleanup failed. Please try again.' }, 502);
    }

    return json({ ok: true });
  } catch {
    return json({ error: 'Account deletion is temporarily unavailable.' }, 503);
  }
}

/** Extracts the bucket-relative storage path from a `tag-images` public URL. */
function storagePathFromPublicUrl(url) {
  const marker = '/object/public/tag-images/';
  const index = typeof url === 'string' ? url.indexOf(marker) : -1;
  return index === -1 ? null : url.slice(index + marker.length);
}
