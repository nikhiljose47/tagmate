import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

const angularApp = new AngularAppEngine();

// Rate limiting state
interface RateLimitData {
  tokens: number;
  lastRefill: number;
}
const rateLimitMap = new Map<string, RateLimitData>();

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || 
         req.headers.get('x-real-ip') || 
         req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
         '127.0.0.1';
}

function isRateLimited(ip: string): boolean {
  const limit = 15; // Max 15 requests
  const windowMs = 60000; // Refill rate: 1 minute
  const now = Date.now();
  
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

function applySecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co https://*.maptiler.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://*.maptiler.com https://nominatim.openstreetmap.org",
    "img-src 'self' data: blob: https://*.supabase.co https://*.maptiler.com",
    "child-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');
  headers.set('Content-Security-Policy', csp);
  
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
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
		url.pathname === '/api/nominatim/reverse'
	) {
		const ip = getClientIp(req);
		if (isRateLimited(ip)) {
			return applySecurityHeaders(new Response(
				JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' }),
				{ status: 429, headers: { 'Content-Type': 'application/json' } }
			));
		}

		let proxyUrl = '';
		if (url.pathname === '/api/nominatim/search') {
			const q = url.searchParams.get('q') || '';
			proxyUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}`;
		} else if (url.pathname === '/api/nominatim/boundary') {
			const q = url.searchParams.get('q') || '';
			proxyUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&q=${encodeURIComponent(q)}`;
		} else {
			const lat = url.searchParams.get('lat') || '';
			const lon = url.searchParams.get('lon') || '';
			proxyUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		}

		try {
			const response = await fetch(proxyUrl, { headers: { 'User-Agent': 'TagmateApp/1.0 (Contact: admin@tagmate.com)' } });
			return applySecurityHeaders(new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } }));
		} catch (err) {
			return applySecurityHeaders(new Response(
				JSON.stringify({ error: 'Bad Gateway', message: 'Failed to fetch from geocoding service.' }),
				{ status: 502, headers: { 'Content-Type': 'application/json' } }
			));
		}
	}

	const res = await angularApp.handle(req);
	if (!res) {
		return applySecurityHeaders(new Response('Page not found.', { status: 404 }));
	}

	return applySecurityHeaders(res);
});


export default { fetch: reqHandler };
