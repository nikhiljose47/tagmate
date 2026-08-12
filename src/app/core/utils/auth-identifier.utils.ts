const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Distinguish an email address from a username without treating `@handle` as an email. */
export function isEmailAddress(value: string): boolean {
  return EMAIL_ADDRESS_PATTERN.test(value.trim());
}

/** Accept an optional leading @ in the UI, but never persist it as part of a username. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '');
}

export function isValidUsername(value: string): boolean {
  const username = normalizeUsername(value);
  return username.length >= 3 && username.length <= 40 && !username.includes('@');
}
