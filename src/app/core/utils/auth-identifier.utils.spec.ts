import { isEmailAddress, isValidUsername, normalizeUsername } from './auth-identifier.utils';

describe('auth identifier utilities', () => {
  it('treats only complete email addresses as emails', () => {
    expect(isEmailAddress('neighbor@example.com')).toBeTrue();
    expect(isEmailAddress('@handle')).toBeFalse();
    expect(isEmailAddress('name@local')).toBeFalse();
  });

  it('normalizes a leading at-sign and rejects embedded at-signs in usernames', () => {
    expect(normalizeUsername(' @handle ')).toBe('handle');
    expect(isValidUsername('@handle')).toBeTrue();
    expect(isValidUsername('name@local')).toBeFalse();
  });
});
