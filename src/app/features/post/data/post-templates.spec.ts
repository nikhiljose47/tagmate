import { TagCategory } from '../../../core/enums/tag-category.enum';
import { rowToTag, tagToRow } from '../../../core/services/tag.mapper';
import { POST_TEMPLATES } from './post-templates';

describe('business post templates', () => {
  it('covers every business tag shown by the composer', () => {
    const businessTags = [
      TagCategory.Shop,
      TagCategory.Biz,
      TagCategory.Food,
      TagCategory.Job,
      TagCategory.Health,
      TagCategory.Fitness,
      TagCategory.Learn,
      TagCategory.Space,
      TagCategory.Travel,
      TagCategory.Event,
    ];

    expect(businessTags.every((tag) => !!POST_TEMPLATES[tag])).toBeTrue();
  });

  it('builds useful posts for common local business updates', () => {
    const shop = POST_TEMPLATES[TagCategory.Shop]!;
    const service = POST_TEMPLATES[TagCategory.Biz]!;
    const care = POST_TEMPLATES[TagCategory.Health]!;

    expect(
      shop.buildHighlight({
        item: 'Corner Store',
        dealType: 'New arrival',
        price: '99',
        validUntil: 'Today',
      }),
    ).toContain('New arrival');
    expect(
      service.buildHighlight({
        service: 'Bike wash',
        updateType: 'Service slot available',
        availability: 'Today 5 PM',
        details: '',
      }),
    ).toContain('Bike wash');
    expect(
      care.buildHighlight({
        service: 'Haircut',
        availability: 'Slot open today',
        price: '',
        note: '',
      }),
    ).toContain('Haircut');
  });

  it('persists the personal or business classification', () => {
    const row = tagToRow({
      username: 'Asha',
      userId: 'user-1',
      highlight: 'Fresh stock today',
      lat: 12.9,
      lng: 77.6,
      expiresIn: 60,
      tag: TagCategory.Shop,
      postType: 'business',
      createdAt: '2026-08-08T10:00:00.000Z',
      images: [],
    });

    expect(row.post_type).toBe('business');
    expect(rowToTag(row).postType).toBe('business');
  });
});
