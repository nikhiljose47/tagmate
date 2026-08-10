import {
  findUser,
  isRateLimited,
  json,
  readJson,
  requiredEnv,
  validEmail,
  validUsername,
} from './_shared';

export async function onRequestPost(context) {
  if (isRateLimited(context.request, 'availability', 20)) {
    return json({ error: 'Please wait before checking again.' }, 429);
  }

  const body = await readJson(context.request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (
    (!email && !username) ||
    (email && !validEmail(email)) ||
    (username && !validUsername(username))
  ) {
    return json({ error: 'Enter a valid email address or username.', code: 'invalid_input' }, 400);
  }

  try {
    const env = requiredEnv(context.env);
    const [emailRow, usernameRow] = await Promise.all([
      email ? findUser(env, 'email', email, 'uid') : Promise.resolve(null),
      username ? findUser(env, 'name', username, 'uid') : Promise.resolve(null),
    ]);
    return json({ emailTaken: !!emailRow, usernameTaken: !!usernameRow });
  } catch {
    return json({ error: 'Account validation is temporarily unavailable.' }, 503);
  }
}
