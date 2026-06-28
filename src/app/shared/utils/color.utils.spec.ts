import { tagGradient, tagEmoji, avatarBg, avatarInitials, coverGradient } from './color.utils';

describe('color.utils', () => {

  describe('tagGradient', () => {
    it('returns a gradient string', () => {
      expect(tagGradient('news')).toContain('linear-gradient');
    });
    it('returns default gradient for unknown tag', () => {
      expect(tagGradient('unknown')).toContain('linear-gradient');
    });
  });

  describe('tagEmoji', () => {
    it('returns correct emoji for known tag', () => {
      expect(tagEmoji('news')).toBe('📰');
      expect(tagEmoji('food')).toBe('🍜');
    });
    it('returns pin emoji for unknown tag', () => {
      expect(tagEmoji('unknown')).toBe('📌');
    });
  });

  describe('avatarBg', () => {
    it('returns a hex color string', () => {
      expect(avatarBg('Alice')).toMatch(/^#[0-9a-f]{6}$/i);
    });
    it('is deterministic', () => {
      expect(avatarBg('Alice')).toBe(avatarBg('Alice'));
    });
  });

  describe('avatarInitials', () => {
    it('extracts two-letter initials for full name', () => {
      expect(avatarInitials('John Doe')).toBe('JD');
    });
    it('uses first two chars for single word', () => {
      expect(avatarInitials('alice')).toBe('AL');
    });
    it('returns ?? for empty string', () => {
      expect(avatarInitials('')).toBe('??');
    });
  });

  describe('coverGradient', () => {
    it('returns a gradient string', () => {
      expect(coverGradient('user1')).toContain('linear-gradient');
    });
    it('is deterministic', () => {
      expect(coverGradient('user1')).toBe(coverGradient('user1'));
    });
  });
});
