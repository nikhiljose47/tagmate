import { findUser, isRateLimited, json, readJson, requiredEnv, validUsername } from './_shared';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'resend-confirmation', 5, 15 * 60_000)) {
    return json({ error: 'Please wait before requesting another confirmation email.' }, 429);
  }

  const body = await readJson(context.request);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (!validUsername(username))
    return json({ error: 'Invalid username.', code: 'invalid_input' }, 400);

  try {
    const env = requiredEnv(context.env);
    const user = await findUser(env, 'name', username, 'email');
    if (user?.email) {
      await fetch(`${env.SUPABASE_URL}/auth/v1/resend`, {
        method: 'POST',
        headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup', email: user.email }),
      });
    }
    // Keep this response generic: confirmation requests must not reveal whether an account exists.
    return json({ ok: true });
  } catch {
    return json({ error: 'Confirmation email service is temporarily unavailable.' }, 503);
  }
}
