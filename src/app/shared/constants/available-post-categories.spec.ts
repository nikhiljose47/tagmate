import { TagCategory } from '../../core/enums/tag-category.enum';
import { isAvailablePost, matchesAvailableCategory } from './available-post-categories';

describe('available post classification', () => {
  it('classifies the new available intent without losing its category', () => {
    const post = { tag: TagCategory.Space, intent: 'available_now' as const };

    expect(isAvailablePost(post)).toBeTrue();
    expect(matchesAvailableCategory(post, TagCategory.Space)).toBeTrue();
  });

  it('keeps local posts outside available mode', () => {
    expect(isAvailablePost({ tag: TagCategory.Around })).toBeFalse();
  });

  it('keeps existing business and hiring posts discoverable', () => {
    const post = {
      tag: TagCategory.Food,
      postType: 'business' as const,
      postSubtype: 'job',
    };

    expect(isAvailablePost(post)).toBeTrue();
    expect(matchesAvailableCategory(post, TagCategory.Job)).toBeTrue();
  });

  it('does not mistake shared local tags for advertisement posts', () => {
    expect(isAvailablePost({ tag: TagCategory.Service })).toBeFalse();
    expect(isAvailablePost({ tag: TagCategory.Space })).toBeFalse();
  });

  it('recognizes legacy available-now posts that predate the intent field', () => {
    const post = {
      tag: TagCategory.Help,
      highlight: 'Bike wash slot - Available now',
    };

    expect(isAvailablePost(post)).toBeTrue();
    expect(matchesAvailableCategory(post, TagCategory.Service)).toBeTrue();
  });
});
