/**
 * SSR-safe localStorage helpers. Reads/writes never throw - private-mode
 * browsers or quota errors just fall back to the default in-memory value.
 */

export function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled - non-fatal, setting just won't persist.
  }
}

export interface StorageEnvelope<T> {
  version: number;
  value: T;
  expiresAt?: number;
}

/** Versioned persistence for values that may evolve between deployments. */
export function readVersionedLocalStorage<T>(key: string, version: number, fallback: T): T {
  const envelope = readLocalStorage<StorageEnvelope<T> | null>(key, null);
  if (
    !envelope ||
    envelope.version !== version ||
    (envelope.expiresAt && envelope.expiresAt <= Date.now())
  ) {
    removeLocalStorage(key);
    return fallback;
  }
  return envelope.value;
}

export function writeVersionedLocalStorage<T>(
  key: string,
  version: number,
  value: T,
  expiresAt?: number,
): void {
  writeLocalStorage(key, {
    version,
    value,
    ...(expiresAt ? { expiresAt } : {}),
  } satisfies StorageEnvelope<T>);
}

export function removeLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be disabled or inaccessible; removal is best effort.
  }
}

/** Namespaces values that are safe to retain across account sign-outs. */
export function deviceStorageKey(name: string): string {
  return `tagmate:device:${name}`;
}

/** Namespaces values that must be removed when a user signs out. */
export function userStorageKey(uid: string, name: string): string {
  return `tagmate:user:${uid}:${name}`;
}

/**
 * Moves a legacy key to its namespaced replacement without overwriting a
 * newer value. This is intentionally best-effort for private-mode browsers.
 */
export function migrateLocalStorageKey(legacyKey: string, namespacedKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(namespacedKey) !== null) return;
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue === null) return;
    window.localStorage.setItem(namespacedKey, legacyValue);
    window.localStorage.removeItem(legacyKey);
  } catch {
    // A failed migration must not prevent the application from starting.
  }
}

/** Removes only cached data belonging to one signed-out user. */
export function clearUserStorage(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  const prefix = `tagmate:user:${uid}:`;
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index),
    ).filter((key): key is string => key?.startsWith(prefix) ?? false);
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage may be inaccessible; sign-out must still succeed.
  }
}
