import { TagCategory } from '../../core/enums/tag-category.enum';
import { PostIntent, Tag } from '../../core/models/tag.model';

export interface AvailablePostCategory {
  readonly value: TagCategory;
  readonly label: string;
  readonly icon: string;
}

/** Categories used when someone is advertising something available nearby. */
export const AVAILABLE_POST_CATEGORIES: readonly AvailablePostCategory[] = [
  { value: TagCategory.Space, label: 'Flats / properties', icon: 'bi-building' },
  { value: TagCategory.Job, label: 'Jobs', icon: 'bi-briefcase' },
  { value: TagCategory.Service, label: 'Services & repair', icon: 'bi-tools' },
  { value: TagCategory.Shop, label: 'Products & shops', icon: 'bi-bag' },
  { value: TagCategory.Food, label: 'Food & catering', icon: 'bi-cup-hot' },
  { value: TagCategory.Beauty, label: 'Beauty & wellness', icon: 'bi-stars' },
  { value: TagCategory.Health, label: 'Health & care', icon: 'bi-heart-pulse' },
  { value: TagCategory.Learn, label: 'Classes & training', icon: 'bi-book' },
  { value: TagCategory.Auto, label: 'Vehicles & automotive', icon: 'bi-car-front' },
  { value: TagCategory.Travel, label: 'Stays & travel', icon: 'bi-luggage' },
  { value: TagCategory.Event, label: 'Events', icon: 'bi-calendar-event' },
  { value: TagCategory.Fitness, label: 'Fitness & sports', icon: 'bi-activity' },
  { value: TagCategory.Biz, label: 'Professional services', icon: 'bi-people' },
];

const AVAILABLE_INTENTS = new Set<PostIntent>(['offer', 'available_now', 'open_slot', 'sell_give']);
const LEGACY_AVAILABLE_TEXT = /\b(available now|available today|slot open|for sale|for rent)\b/i;

/** Supports new two-mode posts plus existing business and legacy Available posts. */
export function isAvailablePost(
  post: Pick<Tag, 'tag' | 'intent' | 'postType'> & { highlight?: string },
): boolean {
  const tag = post.tag?.trim().toLowerCase();
  return (
    post.postType === 'business' ||
    tag === TagCategory.Available ||
    (!!post.intent && AVAILABLE_INTENTS.has(post.intent)) ||
    LEGACY_AVAILABLE_TEXT.test(post.highlight ?? '')
  );
}

export function matchesAvailableCategory(
  post: Pick<Tag, 'tag' | 'postSubtype'>,
  category: string | null,
): boolean {
  if (!category) return true;
  if (category === TagCategory.Job) {
    return post.tag === TagCategory.Job || post.postSubtype === 'job';
  }
  if (category === TagCategory.Service && post.tag === TagCategory.Help) return true;
  return post.tag === category;
}
