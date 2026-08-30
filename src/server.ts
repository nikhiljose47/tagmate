import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

const angularApp = new AngularAppEngine();

// Rate limiting state
interface RateLimitData {
  tokens: number;
  lastRefill: number;
}
const rateLimitMap = new Map<string, RateLimitData>();
let lastRateLimitSweep = 0;

function getClientIp(req: Request): string {
  // CF-Connecting-IP is written by Cloudflare. Forwarded headers can be
  // supplied by an attacker and must not be trusted for rate-limit identity.
  return req.headers.get('CF-Connecting-IP') || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const limit = 15; // Max 15 requests
  const windowMs = 60000; // Refill rate: 1 minute
  const now = Date.now();

  // Evict client entries older than 2 minutes to prevent unbounded growth
  const ttl = 120000;
  if (now - lastRateLimitSweep > ttl) {
    lastRateLimitSweep = now;
    for (const [key, val] of rateLimitMap.entries()) {
      if (now - val.lastRefill > ttl) {
        rateLimitMap.delete(key);
      }
    }
  }

  let client = rateLimitMap.get(ip);
  if (!client) {
    client = { tokens: limit, lastRefill: now };
    rateLimitMap.set(ip, client);
  }

  const elapsed = now - client.lastRefill;
  if (elapsed > 0) {
    const refilled = Math.floor(elapsed * (limit / windowMs));
    if (refilled > 0) {
      client.tokens = Math.min(limit, client.tokens + refilled);
      client.lastRefill = now;
    }
  }

  if (client.tokens > 0) {
    client.tokens--;
    return false;
  }

  return true;
}

function applySecurityHeaders(res: Response, nonce?: string): Response {
  const headers = new Headers(res.headers);

  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // https://connect.facebook.net (SDK script) + https://*.facebook.com (the
  // Embedded Signup popup/iframe itself) are needed only for the WhatsApp
  // "Connect" button (functions/api/integrations/whatsapp/*) — see
  // docs/WHATSAPP_INTEGRATION_SETUP.md. No other Meta call happens from the
  // browser; all Graph API requests are server-side.
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' https://*.supabase.co https://*.maptiler.com https://connect.facebook.net`
    : `'self' https://*.supabase.co https://*.maptiler.com https://connect.facebook.net`;

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://*.maptiler.com https://nominatim.openstreetmap.org https://*.facebook.com https://*.facebook.net",
    "img-src 'self' data: blob: https://*.supabase.co https://*.maptiler.com",
    "child-src 'self' blob: https://*.facebook.com",
    "frame-src 'self' https://*.facebook.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');
  headers.set('Content-Security-Policy', csp);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, status: number, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(async (req) => {
  const url = new URL(req.url);

  // OpenStreetMap Nominatim Proxy
  if (
    url.pathname === '/api/nominatim/search' ||
    url.pathname === '/api/nominatim/boundary' ||
    url.pathname === '/api/nominatim/lookup' ||
    url.pathname === '/api/nominatim/reverse'
  ) {
    if (req.method !== 'GET') {
      return applySecurityHeaders(
        new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            Allow: 'GET',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }),
      );
    }

    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return applySecurityHeaders(
        jsonResponse(
          { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' },
          429,
        ),
      );
    }

    let proxyUrl = '';
    if (url.pathname === '/api/nominatim/search') {
      const q = url.searchParams.get('q') || '';
      if (!q.trim() || q.length > 200) {
        return applySecurityHeaders(jsonResponse({ error: 'Invalid search query.' }, 400));
      }
      proxyUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}`;
    } else if (url.pathname === '/api/nominatim/boundary') {
      const q = url.searchParams.get('q') || '';
      if (!q.trim() || q.length > 200) {
        return applySecurityHeaders(jsonResponse({ error: 'Invalid boundary query.' }, 400));
      }
      // Clamp to Nominatim's own default (10) so callers (e.g. the place-search
      // suggestions list) can ask for more results without opening this up to abuse.
      const requestedLimit = Number(url.searchParams.get('limit'));
      const limit =
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(Math.trunc(requestedLimit), 10)
          : 10;
      proxyUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
    } else if (url.pathname === '/api/nominatim/lookup') {
      const osmIds = url.searchParams.get('osm_ids') || '';
      if (!osmIds.trim() || osmIds.length > 1000) {
        return applySecurityHeaders(jsonResponse({ error: 'Invalid OSM id list.' }, 400));
      }
      proxyUrl = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&polygon_geojson=1&osm_ids=${encodeURIComponent(osmIds)}`;
    } else {
      const lat = url.searchParams.get('lat') || '';
      const lon = url.searchParams.get('lon') || '';
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
        return applySecurityHeaders(jsonResponse({ error: 'Invalid coordinates.' }, 400));
      }
      proxyUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;
    }

    try {
      const response = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'TagmateApp/1.0 (Contact: admin@tagmate.com)' },
        signal: AbortSignal.timeout(8000),
      });
      return applySecurityHeaders(
        new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': response.ok ? 'public, max-age=3600' : 'no-store',
          },
        }),
      );
    } catch {
      return applySecurityHeaders(
        jsonResponse(
          { error: 'Bad Gateway', message: 'Failed to fetch from geocoding service.' },
          502,
        ),
      );
    }
  }

  const nonce = generateNonce();
  const res = await angularApp.handle(req, nonce);
  if (!res) {
    return applySecurityHeaders(new Response('Page not found.', { status: 404 }));
  }

  return applySecurityHeaders(res, nonce);
});

export default { fetch: reqHandler };
