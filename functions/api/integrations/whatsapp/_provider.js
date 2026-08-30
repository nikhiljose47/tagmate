// WhatsApp Business Platform — Cloud API + Embedded Signup provider
// abstraction. Mirrors functions/api/integrations/instagram/_provider.js:
// all raw Meta Graph calls for WhatsApp live in this one file, using the
// same centralized `META_GRAPH_API_VERSION` env var as Instagram.
//
// IMPORTANT: re-verify every endpoint/param below against Meta's current
// WhatsApp Business Platform + Embedded Signup docs
// (developers.facebook.com/docs/whatsapp/embedded-signup) before production
// — this reflects the currently-documented flow at the time it was written,
// and Meta does change these between API versions.

const GRAPH_HOST = 'https://graph.facebook.com';

// whatsapp_business_management + whatsapp_business_messaging cover
// everything Step 3 needs (connect a WABA/number, send/receive messages).
// business_management is requested too — Embedded Signup's shared WABA
// discovery via /debug_token's granular_scopes typically also needs it to
// resolve the underlying Business ID cleanly for Tech Provider setups.
export const WHATSAPP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
];

export class ProviderError extends Error {
  constructor(code, userMessage, providerDetail) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.providerDetail = providerDetail; // Meta's own (sanitized) error object — never a token
  }
}

function graphVersion(env) {
  if (!env.META_GRAPH_API_VERSION) {
    throw new Error('Missing META_GRAPH_API_VERSION environment variable.');
  }
  return env.META_GRAPH_API_VERSION;
}

function graphUrl(env, path) {
  return `${GRAPH_HOST}/${graphVersion(env)}/${path}`;
}

async function graphFetch(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const meta = payload?.error;
    throw new ProviderError(
      meta?.code ? `GRAPH_${meta.code}` : 'GRAPH_REQUEST_FAILED',
      'WhatsApp could not process this request.',
      meta,
    );
  }
  return payload;
}

/** Exchanges the authorization `code` Meta's Embedded Signup JS SDK returned
 *  for a business token that can access the shared WABA. */
export async function exchangeSignupCode(env, code) {
  const url = new URL(graphUrl(env, 'oauth/access_token'));
  url.searchParams.set('client_id', env.META_APP_ID);
  url.searchParams.set('client_secret', env.META_APP_SECRET);
  url.searchParams.set('code', code);
  const payload = await graphFetch(url);
  if (!payload?.access_token) {
    throw new ProviderError('SIGNUP_CODE_EXCHANGE_FAILED', 'Could not complete WhatsApp sign-in.');
  }
  return payload.access_token;
}

/** Reads which WABA(s) Embedded Signup actually granted access to, via the
 *  token's own granular scopes — this is the current documented way to
 *  discover the shared asset without the business having to type an ID in. */
export async function getSharedWabaId(env, accessToken) {
  const url = new URL(graphUrl(env, 'debug_token'));
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', `${env.META_APP_ID}|${env.META_APP_SECRET}`);
  const payload = await graphFetch(url);
  const scopes = payload?.data?.granular_scopes ?? [];
  const wabaScope = scopes.find((s) => s.scope === 'whatsapp_business_management');
  const wabaId = wabaScope?.target_ids?.[0];
  if (!wabaId) {
    throw new ProviderError('NO_WABA_GRANTED', 'No WhatsApp Business Account was shared with us.');
  }
  return wabaId;
}

export async function getPhoneNumbers(env, wabaId, accessToken) {
  const url = new URL(graphUrl(env, `${wabaId}/phone_numbers`));
  url.searchParams.set('access_token', accessToken);
  const payload = await graphFetch(url);
  return (payload?.data ?? []).map((p) => ({
    id: p.id,
    displayPhoneNumber: p.display_phone_number,
    verifiedName: p.verified_name,
  }));
}

/** Best-effort — many current Embedded Signup flows already register the
 *  number as part of Meta's own popup UI. Callers should not fail the whole
 *  connection just because this errors (e.g. "already registered"). */
export async function registerPhoneNumber(env, phoneNumberId, accessToken, pin) {
  const url = graphUrl(env, `${phoneNumberId}/register`);
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  });
}

export async function subscribeWaba(env, wabaId, accessToken) {
  const url = new URL(graphUrl(env, `${wabaId}/subscribed_apps`));
  url.searchParams.set('access_token', accessToken);
  await graphFetch(url, { method: 'POST' });
}

/** Best-effort on disconnect — same caveat as Instagram's revoke. */
export async function unsubscribeWaba(env, wabaId, accessToken) {
  try {
    const url = new URL(graphUrl(env, `${wabaId}/subscribed_apps`));
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url, { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}

/** Counts the highest `{{n}}` placeholder in a template's body — WhatsApp
 *  requires all positional variables 1..n to be filled when sending, even if
 *  a template only actually uses a subset of numbers (rare in practice). */
function countBodyVariables(bodyText) {
  const matches = [...(bodyText?.matchAll(/\{\{\s*(\d+)\s*\}\}/g) ?? [])];
  if (!matches.length) return 0;
  return Math.max(...matches.map((m) => Number(m[1])));
}

export async function getMessageTemplates(env, wabaId, accessToken) {
  const url = new URL(graphUrl(env, `${wabaId}/message_templates`));
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('fields', 'name,language,category,components,status');
  const payload = await graphFetch(url);
  return (payload?.data ?? [])
    .filter((t) => t.status === 'APPROVED')
    .map((t) => {
      const bodyComponent = (t.components ?? []).find((c) => c.type === 'BODY');
      const bodyText = bodyComponent?.text ?? t.name;
      return {
        name: t.name,
        language: t.language,
        category: t.category,
        preview: bodyText,
        bodyText,
        variableCount: countBodyVariables(bodyText),
        // Meta-supplied sample values, e.g. ["Rahul", "#829"] — used to hint
        // the input placeholders rather than showing bare "{{1}}".
        exampleValues: bodyComponent?.example?.body_text?.[0] ?? [],
      };
    });
}

export async function sendTextMessage(env, phoneNumberId, accessToken, to, body) {
  const payload = await graphFetch(graphUrl(env, `${phoneNumberId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  return payload?.messages?.[0]?.id ?? null;
}

/** `template.parameters`, if provided, fills the body's positional `{{n}}`
 *  placeholders in order — index 0 → `{{1}}`, etc. Omit it entirely for a
 *  template with no variables. */
export async function sendTemplateMessage(env, phoneNumberId, accessToken, to, template) {
  const components = template.parameters?.length
    ? [
        {
          type: 'body',
          parameters: template.parameters.map((text) => ({ type: 'text', text })),
        },
      ]
    : undefined;
  const payload = await graphFetch(graphUrl(env, `${phoneNumberId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        ...(components ? { components } : {}),
      },
    }),
  });
  return payload?.messages?.[0]?.id ?? null;
}

export async function markMessageRead(env, phoneNumberId, accessToken, providerMessageId) {
  await graphFetch(graphUrl(env, `${phoneNumberId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: providerMessageId,
    }),
  });
}
