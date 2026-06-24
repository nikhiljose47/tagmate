import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

const angularApp = new AngularAppEngine();

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(async (req) => {
	const url = new URL(req.url);
	
	// OpenStreetMap Nominatim Proxy
	if (url.pathname === '/api/nominatim/search') {
		const q = url.searchParams.get('q') || '';
		const proxyUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}`;
		const response = await fetch(proxyUrl, { headers: { 'User-Agent': 'TagmateApp/1.0 (Contact: admin@tagmate.com)' } });
		return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
	}

	if (url.pathname === '/api/nominatim/boundary') {
		const q = url.searchParams.get('q') || '';
		const proxyUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&q=${encodeURIComponent(q)}`;
		const response = await fetch(proxyUrl, { headers: { 'User-Agent': 'TagmateApp/1.0 (Contact: admin@tagmate.com)' } });
		return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
	}

	if (url.pathname === '/api/nominatim/reverse') {
		const lat = url.searchParams.get('lat') || '';
		const lon = url.searchParams.get('lon') || '';
		const proxyUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(proxyUrl, { headers: { 'User-Agent': 'TagmateApp/1.0 (Contact: admin@tagmate.com)' } });
		return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
	}

	const res = await angularApp.handle(req);

	return res ?? new Response('Page not found.', { status: 404 });
});


export default { fetch: reqHandler };
