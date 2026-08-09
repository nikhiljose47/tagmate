const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'TagmateApp/1.0 (Contact: admin@tagmate.com)';

// Simple token-bucket rate limiter (per isolate / per edge node).
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const LIMIT = 15;
  const WINDOW_MS = 60_000;
  const now = Date.now();

  // Evict stale entries every 2 minutes.
  if (rateLimitMap._lastSweep === undefined) rateLimitMap._lastSweep = 0;
  if (now - rateLimitMap._lastSweep > 120_000) {
    rateLimitMap._lastSweep = now;
    for (const [k, v] of rateLimitMap) {
      if (k !== '_lastSweep' && now - v.lastRefill > 120_000) rateLimitMap.delete(k);
    }
  }

  let client = rateLimitMap.get(ip);
  if (!client) {
    client = { tokens: LIMIT, lastRefill: now };
    rateLimitMap.set(ip, client);
  }

  const elapsed = now - client.lastRefill;
  if (elapsed > 0) {
    const refilled = Math.floor(elapsed * (LIMIT / WINDOW_MS));
    if (refilled > 0) {
      client.tokens = Math.min(LIMIT, client.tokens + refilled);
      client.lastRefill = now;
    }
  }

  if (client.tokens > 0) {
    client.tokens--;
    return false;
  }
  return true;
}

function jsonResponse(body, status = 200) {
  const cacheHeader = status >= 200 && status < 300 ? 'public, max-age=3600' : 'no-store';
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheHeader,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        Allow: 'GET',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  const url = new URL(context.request.url);

  // Derive which Nominatim endpoint to call from the path segment after /api/nominatim/
  const segment = url.pathname.split('/').filter(Boolean).pop() ?? '';

  let proxyUrl;
  if (segment === 'search') {
    const q = url.searchParams.get('q') ?? '';
    if (!q.trim() || q.length > 200) return jsonResponse({ error: 'Invalid search query.' }, 400);
    proxyUrl = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(q)}`;
  } else if (segment === 'boundary') {
    const q = url.searchParams.get('q') ?? '';
    if (!q.trim() || q.length > 200) return jsonResponse({ error: 'Invalid boundary query.' }, 400);
    proxyUrl = `${NOMINATIM_BASE}/search?format=jsonv2&polygon_geojson=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  } else if (segment === 'lookup') {
    const ids = url.searchParams.get('osm_ids') ?? '';
    if (!ids.trim() || ids.length > 1000)
      return jsonResponse({ error: 'Invalid OSM id list.' }, 400);
    proxyUrl = `${NOMINATIM_BASE}/lookup?format=jsonv2&polygon_geojson=1&osm_ids=${encodeURIComponent(ids)}`;
  } else if (segment === 'reverse') {
    const lat = url.searchParams.get('lat') ?? '';
    const lon = url.searchParams.get('lon') ?? '';
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return jsonResponse({ error: 'Invalid coordinates.' }, 400);
    }
    proxyUrl = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;
  } else {
    return jsonResponse({ error: 'Not Found' }, 404);
  }

  const ip = context.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (isRateLimited(ip)) {
    return jsonResponse({ error: 'Too Many Requests' }, 429);
  }

  try {
    const upstream = await fetch(proxyUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    const cacheHeader =
      upstream.status >= 200 && upstream.status < 300 ? 'public, max-age=3600' : 'no-store';
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheHeader },
    });
  } catch {
    return jsonResponse({ error: 'Bad Gateway', message: 'Geocoding service unreachable.' }, 502);
  }
}
