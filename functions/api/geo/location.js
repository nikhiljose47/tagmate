// Cloudflare populates `request.cf` from the edge the request hit — a free,
// instant, no-permission-dialog IP geolocation with no external call needed.
// Not available outside Cloudflare's network (e.g. local `ng serve`), so
// callers must treat a response with null fields as "unknown".
const COUNTRY_NAMES = {
  IN: 'India',
};

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { Allow: 'GET', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const cf = context.request.cf;
  const countryCode = cf?.country ?? null;

  const body = {
    state: cf?.region ?? null,
    country: countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : null,
    city: cf?.city ?? null,
    lat: typeof cf?.latitude === 'string' ? Number(cf.latitude) : null,
    lng: typeof cf?.longitude === 'string' ? Number(cf.longitude) : null,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
