import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve('.env') });

const environmentSource = readFileSync(resolve('src/app/environments/environment.ts'), 'utf8');
const supabaseUrl = environmentSource.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const supabaseAnonKey = environmentSource.match(/supabaseAnonKey:\s*\n?\s*'([^']+)'/)?.[1];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Could not read the public Supabase configuration.');
}

const users = [1, 2, 3, 4, 5].map((index) => {
  const email = process.env[`E2E_USER${index}_EMAIL`];
  const password = process.env[`E2E_USER${index}_PASSWORD`] ?? process.env.E2E_TEST_PASSWORD;
  const name = process.env[`E2E_USER${index}_NAME`] ?? `E2E User ${index}`;
  if (!email || !password) {
    throw new Error(`Missing E2E_USER${index}_EMAIL or password in .env.`);
  }
  return { index, email, password, name };
});

const postDefinitions = [
  { userIndex: 1, tag: 'alert', highlight: '[E2E Seed] Active traffic alert near Central Park' },
  { userIndex: 2, tag: 'food', highlight: '[E2E Seed] Neighbourhood food recommendation' },
  {
    userIndex: 3,
    tag: 'question',
    highlight: '[E2E Seed] Two-option neighbourhood poll',
    poll_options: ['Yes', 'No'],
  },
  {
    userIndex: 4,
    tag: 'question',
    highlight: '[E2E Seed] Five-option neighbourhood poll',
    poll_options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
  },
  { userIndex: 5, tag: 'event', highlight: '[E2E Seed] Community meetup event' },
  { userIndex: 1, tag: 'sale', highlight: '[E2E Seed] Active community sale' },
];

const sessions = new Map();

for (const user of users) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.user) {
    throw new Error(`Could not sign in E2E User ${user.index}: ${error?.message ?? 'no user returned'}`);
  }

  const { error: profileError } = await client.from('users').upsert(
    {
      uid: data.user.id,
      name: user.name,
      email: user.email,
      is_guest: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'uid' },
  );
  if (profileError) {
    throw new Error(`Could not create profile for E2E User ${user.index}: ${profileError.message}`);
  }

  const { error: cleanupError } = await client
    .from('tags')
    .delete()
    .eq('user_id', data.user.id)
    .like('highlight', '[E2E Seed]%');
  if (cleanupError) {
    throw new Error(`Could not replace old E2E posts for User ${user.index}: ${cleanupError.message}`);
  }

  sessions.set(user.index, { client, uid: data.user.id, name: user.name });
}

const { error: pollSchemaError } = await sessions.get(1).client.from('tags').select('poll_options').limit(1);
if (pollSchemaError) {
  throw new Error(
    'The deployed tags table does not support poll_options. Apply the poll schema migration before seeding E2E polls.',
  );
}

let created = 0;
for (const definition of postDefinitions) {
  const session = sessions.get(definition.userIndex);
  if (!session) throw new Error(`No session for E2E User ${definition.userIndex}.`);

  const { error } = await session.client.from('tags').insert({
    username: session.name,
    user_id: session.uid,
    highlight: definition.highlight,
    lat: 12.9716,
    lng: 77.5946,
    expires_in: 10_080,
    tag: definition.tag,
    created_at: new Date().toISOString(),
    images: [],
    hood_id: 'Nearby',
    country: 'India',
    poll_options: definition.poll_options,
  });
  if (error) throw new Error(`Could not create "${definition.highlight}": ${error.message}`);
  created++;
}

console.log(`Seeded ${created} active E2E posts for ${users.length} test profiles.`);
