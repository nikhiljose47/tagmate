import { findUser, isRateLimited, json, readJson, requiredEnv, validUsername } from './_shared';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'username-login', 10)) {
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429);
  }

  const body = await readJson(context.request);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!validUsername(username) || !password) {
    return json({ error: 'Invalid username or password.', code: 'invalid_credentials' }, 400);
  }

  try {
    const env = requiredEnv(context.env);
    const user = await findUser(env, 'name', username, 'email');
    if (!user?.email) {
      return json({ error: 'Invalid username or password.', code: 'invalid_credentials' }, 400);
    }

    const authResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user.email, password }),
    });
    const authBody = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok) {
      const code =
        authBody.code === 'email_not_confirmed' ? 'email_not_confirmed' : 'invalid_credentials';
      const error =
        code === 'email_not_confirmed' ? 'Email not confirmed.' : 'Invalid username or password.';
      return json({ error, code }, 400);
    }
    return json({ access_token: authBody.access_token, refresh_token: authBody.refresh_token });
  } catch {
    return json({ error: 'Authentication service is temporarily unavailable.' }, 503);
  }
}
