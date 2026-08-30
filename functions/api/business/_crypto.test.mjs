import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from './_crypto.js';

// A fixed, valid 32-byte key for tests only — never a real credential.
const env = { INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };

describe('encryptSecret / decryptSecret', () => {
  test('round-trips a plaintext secret', async () => {
    const encrypted = await encryptSecret(env, 'IGAA-fake-access-token');
    const decrypted = await decryptSecret(env, encrypted);
    assert.equal(decrypted, 'IGAA-fake-access-token');
  });

  test('never stores the plaintext token inside the ciphertext string', async () => {
    const secret = 'IGAA-super-secret-token-value';
    const encrypted = await encryptSecret(env, secret);
    assert.equal(encrypted.includes(secret), false);
  });

  test('uses a fresh IV each time — encrypting the same secret twice differs', async () => {
    const a = await encryptSecret(env, 'same-secret');
    const b = await encryptSecret(env, 'same-secret');
    assert.notEqual(a, b);
  });

  test('throws on a missing encryption key rather than silently succeeding', async () => {
    await assert.rejects(() => encryptSecret({}, 'x'));
  });
});
