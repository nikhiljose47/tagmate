import { ACTIONABLE_TAGS, allowedStatusesForTag } from './social.model';

describe('social trust model', () => {
  it('limits verification to actionable local update categories', () => {
    expect(ACTIONABLE_TAGS.has('alert')).toBeTrue();
    expect(ACTIONABLE_TAGS.has('event')).toBeTrue();
    expect(ACTIONABLE_TAGS.has('food')).toBeFalse();
  });

  it('keeps poll status transitions intentionally narrow', () => {
    expect(allowedStatusesForTag('poll')).toEqual(['active', 'closed']);
    expect(allowedStatusesForTag('alert')).toEqual(['active', 'resolved', 'cancelled']);
  });
});
