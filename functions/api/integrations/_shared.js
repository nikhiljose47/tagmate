// Shared helpers for the business-integrations Pages Functions
// (functions/api/integrations/**). Reuses the existing auth/_shared.js
// primitives (json, requiredEnv, isRateLimited) rather than duplicating them.
import { requiredEnv } from '../auth/_shared.js';
import { encryptSecret, decryptSecret } from '../business/_crypto.js';

export { json, readJson, requiredEnv, isRateLimited } from '../auth/_shared.js';

/** Thin re-export so integration endpoints don't need to know the
 *  encryption helper lives under functions/api/business/. */
export function encryptSecretSafely(env, plainText) {
  return encryptSecret(env, plainText);
}

export function decryptSecretSafely(env, encrypted) {
  return decryptSecret(env, encrypted);
}

/**
 * Verifies the request's `Authorization: Bearer <token>` against Supabase
 * Auth (same pattern as functions/api/auth/delete-account.js) and returns the
 * verified uid. Returns `null` if the request isn't authenticated — callers
 * should respond 401 rather than falling back to any client-supplied id.
 */
export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const authUser = await response.json();
  return authUser?.id ?? null;
}

export function serviceRoleHeaders(env, extra) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

/** Thin `fetch` wrapper for PostgREST calls made with the service-role key
 *  (i.e. calls that intentionally bypass RLS — every caller here MUST have
 *  already verified business ownership itself, since PostgREST won't). */
export async function serviceRoleRest(env, path, init = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...serviceRoleHeaders(env),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return response;
}

export function requiredInstagramEnv(env) {
  requiredEnv(env);
  if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET || !env.INSTAGRAM_REDIRECT_URI) {
    throw new Error('Missing Instagram OAuth environment variables.');
  }
  return env;
}

/** Rejects localhost/private/blob/file URLs — Meta must be able to fetch the
 *  media over the public internet at publish time. */
export function isPubliclyFetchableUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return false;
  }
  return true;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v'];

export function isVideoUrl(url) {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/** Instagram caption rules (per Meta's currently documented Content
 *  Publishing limits): plain text, max 2,200 characters. Kept as a small,
 *  named helper (rather than mutating the post) so it's easy to re-tune if
 *  Meta's limit changes. */
export function buildInstagramCaption(post) {
  const raw = (post.title ? `${post.title}\n\n${post.highlight}` : post.highlight) ?? '';
  const trimmed = raw.trim();
  const MAX_LENGTH = 2200;
  return trimmed.length > MAX_LENGTH ? `${trimmed.slice(0, MAX_LENGTH - 1)}…` : trimmed;
}

/** Account types the Instagram API with Instagram Login currently allows to
 *  publish content. Personal accounts cannot be connected for publishing. */
export const PUBLISHABLE_INSTAGRAM_ACCOUNT_TYPES = ['BUSINESS', 'MEDIA_CREATOR'];
