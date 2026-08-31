/**
 * Temporary, device-level transport for a `?ref=CODE` query param seen
 * before the visitor has an account yet. This is NEVER authoritative — the
 * server independently validates the code, resolves the referrer, and
 * decides eligibility (see register_referral()/evaluate_referral()); this
 * storage only survives the signup/OTP-confirm flow long enough to hand the
 * code to the server once, then gets cleared.
 */
import {
  deviceStorageKey,
  readVersionedLocalStorage,
  removeLocalStorage,
  writeVersionedLocalStorage,
} from './local-storage.util';

const STORAGE_KEY = deviceStorageKey('pending_referral_code');
const STORAGE_VERSION = 1;
/** Bounds how long the client keeps trying to submit a stashed code — not a
 *  security boundary, just housekeeping so it doesn't linger forever. */
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Loose client-side sanity check only (avoids stashing obvious garbage) —
 *  the server's own format check is the one that actually matters. */
export function isPlausibleReferralCode(value: string): boolean {
  return /^[A-Za-z0-9]{4,12}$/.test(value.trim());
}

export function stashPendingReferralCode(code: string): void {
  writeVersionedLocalStorage(STORAGE_KEY, STORAGE_VERSION, code.trim().toUpperCase(), Date.now() + EXPIRY_MS);
}

export function readPendingReferralCode(): string | null {
  return readVersionedLocalStorage<string | null>(STORAGE_KEY, STORAGE_VERSION, null);
}

export function clearPendingReferralCode(): void {
  removeLocalStorage(STORAGE_KEY);
}
