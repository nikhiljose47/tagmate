import { escapeHtml } from './string.utils';

describe('escapeHtml', () => {
  it('should escape basic HTML special characters', () => {
    expect(escapeHtml('<script>alert("hello")</script>')).toBe('&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;');
    expect(escapeHtml('A & B')).toBe('A &amp; B');
    expect(escapeHtml("John's Book")).toBe('John&#039;s Book');
  });

  it('should strip null bytes', () => {
    expect(escapeHtml('hello\0world')).toBe('helloworld');
  });

  it('should preserve unicode escapes', () => {
    expect(escapeHtml('Hello 🚀 \u2602')).toBe('Hello 🚀 \u2602');
  });

  it('should return empty string for null, undefined, or empty values', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as any)).toBe('');
    expect(escapeHtml(undefined as any)).toBe('');
  });
});
