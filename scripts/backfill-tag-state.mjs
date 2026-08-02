/*
 * One-off backfill: populate `state` and `country` on existing tag rows by
 * reverse-geocoding their (lat, lng) via Nominatim. Safe to re-run — only
 * touches rows where state is NULL.
 *
 * Usage (PowerShell / bash from repo root):
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/backfill-tag-state.mjs
 *
 * The service_role key is required so we can update rows owned by other users
 * (RLS blocks the anon key). Find it in your Supabase dashboard under
 * Project Settings → API → service_role secret. Never commit this value.
 *
 * Nominatim's fair-use policy is 1 req/sec. This script sleeps 1100ms between
 * requests and sends a proper User-Agent, so a few hundred rows will take a
 * few minutes end-to-end.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const source = readFileSync(resolve('src/app/environments/environment.ts'), 'utf8');
const supabaseUrl = source.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Could not read supabaseUrl from src/app/environments/environment.ts');
}
if (!serviceKey) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the environment before running.');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TagmateApp/1.0 (Backfill; admin@tagmate.com)' },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const { data: rows, error } = await supabase
    .from('tags')
    .select('id, lat, lng, hood_id, state, country')
    .is('state', null)
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error) throw error;
  if (!rows?.length) {
    console.log('No tag rows need backfill — nothing to do.');
    return;
  }

  console.log(`Backfilling state/country for ${rows.length} tag row(s)…`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, row] of rows.entries()) {
    const idx = `[${i + 1}/${rows.length}]`;
    try {
      const data = await reverseGeocode(row.lat, row.lng);
      const state = data?.address?.state?.trim() ?? null;
      const country = data?.address?.country?.trim() ?? row.country ?? null;

      if (!state && !country) {
        console.log(`${idx} skip id=${row.id} — no state/country in response`);
        skipped += 1;
      } else {
        const update = {};
        if (state) update.state = state;
        if (country && country !== row.country) update.country = country;

        const { error: upErr } = await supabase.from('tags').update(update).eq('id', row.id);
        if (upErr) throw upErr;
        console.log(`${idx} ok  id=${row.id} → ${state ?? '—'} / ${country ?? '—'}`);
        ok += 1;
      }
    } catch (err) {
      console.error(`${idx} FAIL id=${row.id}:`, err.message ?? err);
      failed += 1;
    }

    // Nominatim fair-use: max 1 req/sec. 1100ms is a safe margin.
    await sleep(1100);
  }

  console.log(`\nDone. updated=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
