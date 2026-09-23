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

describe('BusinessPostContentComponent (TM-012)', () => {
  it('computes messageQueryParams with user id and business name', async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { provideRouter } = await import('@angular/router');
    const { BusinessPostContentComponent } = await import('./business-post-content.component');

    await TestBed.configureTestingModule({
      imports: [BusinessPostContentComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessPostContentComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('post', {
      id: 'tag-1',
      userId: 'user-42',
      businessName: 'Acme Cafe',
      username: 'acme',
      cta: 'message',
      tag: 'food',
      highlight: 'Special Coffee',
    } as any);
    fixture.detectChanges();

    expect(component.messageQueryParams()).toEqual({
      user: 'user-42',
      name: 'Acme Cafe',
    });
  });
});
