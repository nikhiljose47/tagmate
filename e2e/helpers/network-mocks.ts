import { Page } from '@playwright/test';

/**
 * Configure Playwright network route intercepts for 100% hermetic, offline test runs.
 * Intercepts Nominatim geocoding API, MapTiler map tiles, and Supabase REST/Realtime API calls.
 */
export async function setupHermeticNetworkMocks(page: Page): Promise<void> {
  // Mock OpenStreetMap Nominatim reverse geocoding API
  await page.route('**/api/nominatim/reverse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        place_id: 1001,
        display_name: 'Downtown Hood, Tagmate City, Hoodland',
        address: {
          neighbourhood: 'Downtown Hood',
          suburb: 'Central District',
          city: 'Tagmate City',
          country: 'Hoodland',
        },
      }),
    });
  });

  // Mock OpenStreetMap Nominatim search API
  await page.route('**/api/nominatim/search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          place_id: 2002,
          display_name: 'Central Park, Tagmate City',
          lat: '37.7749',
          lon: '-122.4194',
        },
      ]),
    });
  });

  // Mock MapTiler Vector Tile & Style requests to run without API keys or internet
  await page.route('**/*.maptiler.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('.json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 8,
          name: 'Hermetic Mock Style',
          sources: {},
          layers: [],
        }),
      });
    } else {
      // 1x1 transparent PNG for tile requests
      const transparentPixelPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: transparentPixelPng,
      });
    }
  });

  // Mock Supabase REST endpoints as fallback for offline test suites
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-0/0' },
        body: JSON.stringify([]),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    }
  });
}
