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
