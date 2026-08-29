import { resolveWhatsappHref } from './business-post-content.component';

describe('resolveWhatsappHref (whatsapp CTA destination)', () => {
  it('prefers a full businessWhatsapp URL as-is', () => {
    expect(resolveWhatsappHref('https://wa.me/919876543210', '9876543210')).toBe(
      'https://wa.me/919876543210',
    );
  });

  it('builds a wa.me link when businessWhatsapp is a bare number', () => {
    expect(resolveWhatsappHref('+91 98765 43210', undefined)).toBe('https://wa.me/919876543210');
  });

  it('falls back to businessPhone when businessWhatsapp is not set', () => {
    expect(resolveWhatsappHref(undefined, '+91 98765 43210')).toBe('https://wa.me/919876543210');
  });

  it('falls back to businessPhone when businessWhatsapp is blank', () => {
    expect(resolveWhatsappHref('   ', '9876543210')).toBe('https://wa.me/9876543210');
  });

  it('returns null when neither is set — existing posts must not get a broken CTA', () => {
    expect(resolveWhatsappHref(undefined, undefined)).toBeNull();
  });
});
