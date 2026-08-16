import { TagCategory } from '../../core/enums/tag-category.enum';

/**
 * The fixed set of categories a business account can register under.
 * Shared by signup (choose once), profile (change later), and the post
 * composer (auto-assigned — business accounts no longer pick a tag per post).
 *
 * 12 categories — see the category table in docs for examples per category.
 */
export const BUSINESS_TAG_CATEGORIES: readonly TagCategory[] = [
  TagCategory.Shop,
  TagCategory.Food,
  TagCategory.Service,
  TagCategory.Beauty,
  TagCategory.Health,
  TagCategory.Fitness,
  TagCategory.Learn,
  TagCategory.Auto,
  TagCategory.Space,
  TagCategory.Travel,
  TagCategory.Event,
  TagCategory.Biz,
];

/** Every category EXCEPT hot-now — that tag has its own top-right toggle. */
export const PERSONAL_TAG_CATEGORIES: readonly TagCategory[] = [
  TagCategory.Around,
  TagCategory.Dating,
  TagCategory.Game,
  TagCategory.Help,
  TagCategory.Notice,
  TagCategory.Alert,
  TagCategory.Poll,
];

const TAG_LABELS: Partial<Record<TagCategory, string>> = {
  [TagCategory.Around]: 'Local update',
  [TagCategory.Dating]: 'Meet people',
  [TagCategory.Game]: 'Games & sports',
  [TagCategory.Help]: 'Ask for help',
  [TagCategory.Notice]: 'Notice',
  [TagCategory.Alert]: 'Alert',
  [TagCategory.Poll]: 'Poll',
  [TagCategory.Shop]: 'Shop & retail',
  [TagCategory.Food]: 'Food & dining',
  [TagCategory.Service]: 'Services & repair',
  [TagCategory.Beauty]: 'Beauty & wellness',
  [TagCategory.Health]: 'Health & care',
  [TagCategory.Fitness]: 'Fitness & sports',
  [TagCategory.Learn]: 'Education & classes',
  [TagCategory.Auto]: 'Automotive',
  [TagCategory.Space]: 'Property & spaces',
  [TagCategory.Travel]: 'Travel & hospitality',
  [TagCategory.Event]: 'Events & entertainment',
  [TagCategory.Biz]: 'Professional & business services',
  [TagCategory.Job]: 'Jobs',
};

export function tagCategoryLabel(tag: TagCategory | string): string {
  return TAG_LABELS[tag as TagCategory] ?? tag;
}
