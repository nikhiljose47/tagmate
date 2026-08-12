/**
 * Local lookup for short place codes shown in the topbar hood chip — avoids a
 * network round-trip (e.g. to Nominatim) just to render a 2-3 letter badge.
 *
 * Keys are lowercased full names. Indian states/UTs use the common
 * vehicle-registration-style codes users already recognize (not the raw
 * ISO 3166-2:IN codes, which differ for a few states like Chhattisgarh/CT
 * and Odisha/OR — the codes below are what's printed on license plates and
 * what people actually search for).
 */
export const PLACE_CODES: Record<string, string> = {
  // India — states
  'andhra pradesh': 'AP',
  'arunachal pradesh': 'AR',
  assam: 'AS',
  bihar: 'BR',
  chhattisgarh: 'CG',
  goa: 'GA',
  gujarat: 'GJ',
  haryana: 'HR',
  'himachal pradesh': 'HP',
  jharkhand: 'JH',
  karnataka: 'KA',
  kerala: 'KL',
  'madhya pradesh': 'MP',
  maharashtra: 'MH',
  manipur: 'MN',
  meghalaya: 'ML',
  mizoram: 'MZ',
  nagaland: 'NL',
  odisha: 'OD',
  orissa: 'OD',
  punjab: 'PB',
  rajasthan: 'RJ',
  sikkim: 'SK',
  'tamil nadu': 'TN',
  telangana: 'TS',
  tripura: 'TR',
  'uttar pradesh': 'UP',
  uttarakhand: 'UK',
  'west bengal': 'WB',

  // India — union territories
  'andaman and nicobar islands': 'AN',
  chandigarh: 'CH',
  'dadra and nagar haveli and daman and diu': 'DH',
  delhi: 'DL',
  'new delhi': 'DL',
  'jammu and kashmir': 'JK',
  ladakh: 'LA',
  lakshadweep: 'LD',
  puducherry: 'PY',

  // Common non-India examples the app already surfaces
  ontario: 'ON',
  'british columbia': 'BC',
  california: 'CA',
  'new york': 'NY',
  texas: 'TX',
  tokyo: 'TY',
};

/**
 * Short code for a place name — looks up {@link PLACE_CODES}, falling back to
 * a derived code (first letter of up to the first two words) for anything
 * not in the table, so unmapped countries/states still get a compact badge.
 */
export function placeCode(name: string | undefined | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';

  const known = PLACE_CODES[trimmed.toLowerCase()];
  if (known) return known;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}
