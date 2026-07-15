import {
  readLocalStorage,
  readVersionedLocalStorage,
  removeLocalStorage,
  clearUserStorage,
  migrateLocalStorageKey,
  userStorageKey,
  writeLocalStorage,
  writeVersionedLocalStorage,
} from './local-storage.util';

describe('localStorage utilities', () => {
  const key = 'tagmate-test-storage';

  beforeEach(() => window.localStorage.removeItem(key));
  afterEach(() => window.localStorage.removeItem(key));

  it('reads and writes JSON values', () => {
    writeLocalStorage(key, { enabled: true });

    expect(readLocalStorage(key, { enabled: false })).toEqual({ enabled: true });
  });

  it('returns the fallback for missing or invalid values', () => {
    expect(readLocalStorage(key, 'fallback')).toBe('fallback');

    window.localStorage.setItem(key, 'not-json');
    expect(readLocalStorage(key, 'fallback')).toBe('fallback');
  });

  it('reads a valid versioned value', () => {
    writeVersionedLocalStorage(key, 2, ['saved'], Date.now() + 60_000);

    expect(readVersionedLocalStorage(key, 2, [] as string[])).toEqual(['saved']);
  });

  it('removes stale or incompatible versioned values', () => {
    writeVersionedLocalStorage(key, 1, 'old');
    expect(readVersionedLocalStorage(key, 2, 'fallback')).toBe('fallback');
    expect(window.localStorage.getItem(key)).toBeNull();

    writeVersionedLocalStorage(key, 2, 'expired', Date.now() - 1);
    expect(readVersionedLocalStorage(key, 2, 'fallback')).toBe('fallback');
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('removes stored values', () => {
    writeLocalStorage(key, 'saved');
    removeLocalStorage(key);

    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('migrates a legacy key without replacing a newer value', () => {
    window.localStorage.setItem('legacy-key', JSON.stringify('legacy'));
    migrateLocalStorageKey('legacy-key', key);
    expect(readLocalStorage(key, '')).toBe('legacy');
    expect(window.localStorage.getItem('legacy-key')).toBeNull();

    writeLocalStorage(key, 'newer');
    window.localStorage.setItem('legacy-key', JSON.stringify('older'));
    migrateLocalStorageKey('legacy-key', key);
    expect(readLocalStorage(key, '')).toBe('newer');
  });

  it('clears only values scoped to the signed-out user', () => {
    const userKey = userStorageKey('user-a', 'settings');
    const otherUserKey = userStorageKey('user-b', 'settings');
    writeLocalStorage(userKey, { enabled: true });
    writeLocalStorage(otherUserKey, { enabled: true });
    writeLocalStorage('tagmate:device:theme', 'dark');

    clearUserStorage('user-a');

    expect(window.localStorage.getItem(userKey)).toBeNull();
    expect(window.localStorage.getItem(otherUserKey)).not.toBeNull();
    expect(window.localStorage.getItem('tagmate:device:theme')).not.toBeNull();
    window.localStorage.removeItem(otherUserKey);
    window.localStorage.removeItem('tagmate:device:theme');
  });
});
