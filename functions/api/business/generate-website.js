import { findUser, isRateLimited, json, readJson, requiredEnv } from '../auth/_shared';

const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const MAX_ATTEMPTS = 12;

function randomCode() {
  let out = '';
  for (let i = 0; i < 3; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function slugify(name) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'business';
}

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'generate-website', 20)) {
    return json({ error: 'Please wait before trying again.' }, 429);
  }

  const body = await readJson(context.request);
  const businessName = typeof body?.businessName === 'string' ? body.businessName.trim() : '';
  if (!businessName || businessName.length > 100) {
    return json({ error: 'Enter a valid business name.', code: 'invalid_input' }, 400);
  }

  try {
    const env = requiredEnv(context.env);
    const slug = slugify(businessName);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = randomCode();
      const website = `https://mshop.in/${code}/${slug}`;
      // eslint-disable-next-line no-await-in-loop
      const existing = await findUser(env, 'business_website', website, 'uid');
      if (!existing) {
        return json({ website });
      }
    }

    return json({ error: 'Could not generate a unique website link — please try again.' }, 503);
  } catch {
    return json({ error: 'Website generation is temporarily unavailable.' }, 503);
  }
}
