// AES-256-GCM helper for encrypting/decrypting business-integration secrets
// (OAuth access/refresh tokens) before they ever touch Postgres. Runs on the
// Cloudflare Workers runtime, which implements the standard Web Crypto API,
// so no extra dependency is needed.
//
// Not called anywhere yet — this is the Step 1 foundation only. Step 2 (real
// Instagram OAuth) will call `encryptSecret`/`decryptSecret` when writing
// `access_token_encrypted`/`refresh_token_encrypted` on `business_integrations`.
//
// Ciphertext is stored as `${ivBase64}.${cipherTextBase64}` — the IV must be
// unique per encryption but is not secret, so storing it alongside the
// ciphertext (rather than in a separate column) is safe and simpler.

/** Reads and validates `INTEGRATION_ENCRYPTION_KEY` (base64, 32 raw bytes). */
export function requiredEncryptionKey(env) {
  const raw = env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing INTEGRATION_ENCRYPTION_KEY environment variable.');
  }
  return raw;
}

async function importKey(base64Key) {
  const keyBytes = base64ToBytes(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).');
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(env, plainText) {
  const key = await importKey(requiredEncryptionKey(env));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBytes = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText)),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(cipherBytes)}`;
}

export async function decryptSecret(env, encrypted) {
  const [ivPart, cipherPart] = encrypted.split('.');
  if (!ivPart || !cipherPart) {
    throw new Error('Malformed encrypted secret (expected "<iv>.<ciphertext>").');
  }
  const key = await importKey(requiredEncryptionKey(env));
  const iv = base64ToBytes(ivPart);
  const plainBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(cipherPart),
  );
  return new TextDecoder().decode(plainBytes);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
