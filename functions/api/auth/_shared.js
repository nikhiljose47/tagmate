const rateLimits = new Map();

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** A best-effort per-edge-instance limit; the hosting WAF should add a global limit in production. */
export function isRateLimited(request, scope, limit, windowMs = 60_000) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const state = rateLimits.get(key);
  if (!state || now - state.startedAt >= windowMs) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return false;
  }
  state.count += 1;
  return state.count > limit;
}

export function requiredEnv(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase authentication environment variables.');
  }
  return env;
}

export function escapeLike(value) {
  return value.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

export async function findUser(env, field, value, select) {
  const url = new URL('/rest/v1/users', env.SUPABASE_URL);
  url.searchParams.set('select', select);
  url.searchParams.set(field, `ilike.${escapeLike(value)}`);
  url.searchParams.set('limit', '1');
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Could not query account availability.');
  const rows = await response.json();
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

export function validEmail(value) {
  return (
    typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function validUsername(value) {
  return typeof value === 'string' && value.trim().length >= 3 && value.trim().length <= 40;
}
