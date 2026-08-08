import { TagCategory } from '../../../core/enums/tag-category.enum';

/**
 * Quick-fill post templates — v1.
 *
 * Each tag can optionally define a small set of structured fields. When the
 * user picks that tag on the "choose a tag" step, the details step shows a
 * tiny form built from `fields` instead of (well, in addition to) a blank
 * textarea — filling it in composes a detailed, consistent post caption via
 * `buildHighlight()`, so a shop owner can post "bike wash slot free now" in
 * three taps instead of typing a paragraph.
 *
 * Tags with no entry here just get the plain free-text composer, unchanged —
 * adding structure is opt-in per tag, never required.
 *
 * ─── Adding a new template (v2.0 and beyond) ────────────────────────────
 * 1. Add a `TagCategory.X: { ... }` entry below.
 * 2. List its `fields` (each needs a unique `key` — used to look up the
 *    filled-in value in `buildHighlight`).
 * 3. Write `buildHighlight(values)` to turn those values into a caption.
 * That's it — the post page picks it up automatically, no component changes.
 */

export type TemplateFieldType = 'text' | 'select' | 'number';

export interface TemplateField {
  /** Unique within the template — the key `buildHighlight` reads from `values`. */
  readonly key: string;
  readonly label: string;
  readonly type: TemplateFieldType;
  readonly placeholder?: string;
  /** Required for type: 'select'. */
  readonly options?: readonly string[];
  readonly required?: boolean;
}

export interface PostTemplate {
  /** One-line nudge shown above the quick-fill fields. */
  readonly intro: string;
  readonly fields: readonly TemplateField[];
  /** Composes the post caption from the filled-in field values, keyed by `field.key`. */
  buildHighlight(values: Record<string, string>): string;
}

/** Small helpers to keep `buildHighlight` implementations short and consistent. */
const has = (v: Record<string, string>, key: string): boolean => !!v[key]?.trim();
const line = (parts: (string | false | undefined)[]): string =>
  parts.filter((p): p is string => !!p && p.trim().length > 0).join(' • ');

export const POST_TEMPLATES: Partial<Record<TagCategory, PostTemplate>> = {
  [TagCategory.Help]: {
    intro: 'What service, and when are you free?',
    fields: [
      {
        key: 'service',
        label: 'Service',
        type: 'select',
        required: true,
        options: [
          'Bike wash',
          'Car wash',
          'Electrician',
          'Plumber',
          'Carpenter',
          'AC repair',
          'Appliance repair',
          'Painter',
          'Cleaning',
          'Pest control',
          'Pet care',
          'Other repair/service',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Slot open today', 'By appointment'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹150' },
      {
        key: 'note',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. No wait, walk-ins welcome',
      },
    ],
    buildHighlight: (v) =>
      line([
        `🔧 ${v['service']} — ${v['availability']}`,
        has(v, 'price') ? v['price'] : undefined,
        v['note'],
      ]),
  },

  [TagCategory.Shop]: {
    intro: "What's the deal?",
    fields: [
      {
        key: 'item',
        label: 'Item / shop',
        type: 'text',
        required: true,
        placeholder: 'e.g. Bakery, mobile covers',
      },
      {
        key: 'dealType',
        label: 'Deal type',
        type: 'select',
        required: true,
        options: [
          'New arrival',
          'Discount',
          'Flash sale',
          'Clearance',
          'New stock',
          'New shop opened',
          'Free sample',
          'Bulk offer',
        ],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹99 flat' },
      {
        key: 'validUntil',
        label: 'Valid until (optional)',
        type: 'text',
        placeholder: 'e.g. Today only',
      },
    ],
    buildHighlight: (v) =>
      line([
        `🛍️ ${v['item']} — ${v['dealType']}`,
        v['price'],
        has(v, 'validUntil') ? `Valid: ${v['validUntil']}` : undefined,
      ]),
  },

  [TagCategory.Food]: {
    intro: "What's on offer?",
    fields: [
      {
        key: 'dish',
        label: 'Dish / place',
        type: 'text',
        required: true,
        placeholder: 'e.g. Masala dosa',
      },
      {
        key: 'offerType',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          "Today's special",
          'Lunch/dinner offer',
          'Happy hour',
          'Combo offer',
          'Buffet',
          'Fresh batch ready',
        ],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹120' },
      {
        key: 'window',
        label: 'Time window (optional)',
        type: 'text',
        placeholder: 'e.g. Till 9 PM',
      },
    ],
    buildHighlight: (v) =>
      line([
        `🍜 ${v['dish']} — ${v['offerType']}`,
        v['price'],
        has(v, 'window') ? `Available: ${v['window']}` : undefined,
      ]),
  },

  [TagCategory.Health]: {
    intro: 'What care or appointment is available?',
    fields: [
      {
        key: 'service',
        label: 'Service',
        type: 'select',
        required: true,
        options: [
          'Haircut',
          'Salon service',
          'Clinic appointment',
          'Dental appointment',
          'Therapy session',
          'Home care',
          'Other care service',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Slot open today', 'Book for later'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. 250' },
      {
        key: 'note',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. Walk-ins welcome',
      },
    ],
    buildHighlight: (v) => line([`${v['service']} - ${v['availability']}`, v['price'], v['note']]),
  },

  [TagCategory.Fitness]: {
    intro: "What's the session?",
    fields: [
      {
        key: 'activity',
        label: 'Activity',
        type: 'select',
        required: true,
        options: [
          'Gym slot',
          'Yoga class',
          'Trainer session',
          'Zumba',
          'Swimming slot',
          'Other fitness slot',
        ],
      },
      { key: 'time', label: 'When', type: 'text', required: true, placeholder: 'e.g. Today 6 PM' },
      { key: 'spots', label: 'Spots left (optional)', type: 'number', placeholder: 'e.g. 3' },
    ],
    buildHighlight: (v) =>
      line([
        `💪 ${v['activity']} — ${v['time']}`,
        has(v, 'spots') ? `${v['spots']} spot(s) left` : undefined,
      ]),
  },

  [TagCategory.Game]: {
    intro: 'Looking for players or a partner?',
    fields: [
      {
        key: 'sport',
        label: 'Sport / game',
        type: 'select',
        required: true,
        options: ['Football', 'Cricket', 'Badminton', 'Tennis', 'Running', 'Cycling', 'Other'],
      },
      { key: 'when', label: 'When', type: 'text', required: true, placeholder: 'e.g. Today 5 PM' },
      {
        key: 'playersNeeded',
        label: 'Players needed (optional)',
        type: 'number',
        placeholder: 'e.g. 2',
      },
    ],
    buildHighlight: (v) =>
      line([
        `⚽ ${v['sport']} — ${v['when']}`,
        has(v, 'playersNeeded') ? `Need ${v['playersNeeded']} more` : undefined,
      ]),
  },

  [TagCategory.Job]: {
    intro: 'What work, and how urgently?',
    fields: [
      {
        key: 'role',
        label: 'Role / work needed',
        type: 'text',
        required: true,
        placeholder: 'e.g. Delivery helper',
      },
      {
        key: 'workType',
        label: 'Type',
        type: 'select',
        required: true,
        options: ['Full-time', 'Part-time', 'Few hours today', 'Temporary', 'Freelance'],
      },
      { key: 'pay', label: 'Pay (optional)', type: 'text', placeholder: 'e.g. ₹500/day' },
    ],
    buildHighlight: (v) => line([`💼 ${v['role']} — ${v['workType']}`, v['pay']]),
  },

  [TagCategory.Event]: {
    intro: "What's happening?",
    fields: [
      {
        key: 'name',
        label: 'Event name',
        type: 'text',
        required: true,
        placeholder: 'e.g. Open mic night',
      },
      {
        key: 'eventType',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          'Live music',
          'Open mic',
          'Tournament',
          'Meetup',
          'Workshop',
          'Exhibition',
          'Other',
        ],
      },
      { key: 'when', label: 'When', type: 'text', required: true, placeholder: 'e.g. Sat 7 PM' },
    ],
    buildHighlight: (v) => line([`🎉 ${v['name']} — ${v['eventType']}`, v['when']]),
  },

  [TagCategory.Notice]: {
    intro: "What's the update?",
    fields: [
      {
        key: 'noticeType',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          'Lost & found',
          'Volunteer needed',
          'Cleanup drive',
          'Giveaway',
          'General notice',
        ],
      },
      {
        key: 'details',
        label: 'Details',
        type: 'text',
        required: true,
        placeholder: 'A couple of lines…',
      },
    ],
    buildHighlight: (v) => line([`📌 ${v['noticeType']}`, v['details']]),
  },

  [TagCategory.Dating]: {
    intro: 'What kind of hangout, and when?',
    fields: [
      {
        key: 'activity',
        label: 'Activity',
        type: 'select',
        required: true,
        options: ['Coffee', 'Walk', 'Dinner', 'Movie', 'Game night', 'Other'],
      },
      {
        key: 'when',
        label: 'When',
        type: 'text',
        required: true,
        placeholder: 'e.g. This weekend',
      },
      {
        key: 'lookingFor',
        label: 'Looking for (optional)',
        type: 'text',
        placeholder: 'e.g. Someone chill to grab coffee with',
      },
    ],
    buildHighlight: (v) => line([`💕 ${v['activity']} — ${v['when']}`, v['lookingFor']]),
  },

  [TagCategory.Learn]: {
    intro: "What's the skill, and what kind of session?",
    fields: [
      {
        key: 'skill',
        label: 'Skill / subject',
        type: 'text',
        required: true,
        placeholder: 'e.g. Guitar basics',
      },
      {
        key: 'sessionType',
        label: 'Type',
        type: 'select',
        required: true,
        options: ['Tuition', 'Workshop', 'Skill exchange', 'Study group', 'Language practice'],
      },
      { key: 'when', label: 'When (optional)', type: 'text', placeholder: 'e.g. Weekday evenings' },
    ],
    buildHighlight: (v) => line([`📚 ${v['skill']} — ${v['sessionType']}`, v['when']]),
  },

  [TagCategory.Space]: {
    intro: "What's available, and when?",
    fields: [
      {
        key: 'spaceType',
        label: 'Space',
        type: 'select',
        required: true,
        options: [
          'Room',
          'Meeting room',
          'Coworking desk',
          'Sports court/turf',
          'Parking',
          'Storage',
          'Venue',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Available today', 'By booking'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹500/hour' },
    ],
    buildHighlight: (v) => line([`🔑 ${v['spaceType']} — ${v['availability']}`, v['price']]),
  },

  [TagCategory.Travel]: {
    intro: "What's the trip?",
    fields: [
      {
        key: 'serviceType',
        label: 'Service',
        type: 'select',
        required: true,
        options: ['Taxi', 'Carpool', 'Driver', 'Rental', 'Local guide', 'Shared trip'],
      },
      {
        key: 'route',
        label: 'Route',
        type: 'text',
        required: true,
        placeholder: 'e.g. Airport to Whitefield',
      },
      { key: 'when', label: 'When (optional)', type: 'text', placeholder: 'e.g. Today 6 AM' },
      { key: 'seats', label: 'Seats available (optional)', type: 'number', placeholder: 'e.g. 2' },
    ],
    buildHighlight: (v) =>
      line([
        `🚗 ${v['serviceType']} — ${v['route']}`,
        v['when'],
        has(v, 'seats') ? `${v['seats']} seat(s) left` : undefined,
      ]),
  },

  [TagCategory.Biz]: {
    intro: 'Share a service slot, opening, arrival, or business update.',
    fields: [
      {
        key: 'updateType',
        label: 'Update',
        type: 'select',
        required: true,
        options: [
          'Service slot available',
          'New business opened',
          'New arrival',
          'Discount or offer',
          'Bookings open',
          'Walk-ins available',
          'Supplier needed',
          'Equipment available',
        ],
      },
      {
        key: 'service',
        label: 'Business or service',
        type: 'text',
        required: true,
        placeholder: 'e.g. Bike wash, salon, tailoring',
      },
      {
        key: 'availability',
        label: 'When (optional)',
        type: 'text',
        placeholder: 'e.g. Today until 7 PM',
      },
      {
        key: 'details',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. No wait, call or walk in',
      },
    ],
    buildHighlight: (v) =>
      line([`${v['service']} - ${v['updateType']}`, v['availability'], v['details']]),
  },

  [TagCategory.Alert]: {
    intro: "What's happening, and where?",
    fields: [
      {
        key: 'alertType',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          'Safety',
          'Weather',
          'Traffic/road',
          'Utility outage',
          'Urgent lost & found',
          'Other',
        ],
      },
      {
        key: 'details',
        label: 'Details',
        type: 'text',
        required: true,
        placeholder: 'What neighbors need to know',
      },
    ],
    buildHighlight: (v) => line([`⚠️ ${v['alertType']}`, v['details']]),
  },

  [TagCategory.Around]: {
    intro: 'Looking to hang out?',
    fields: [
      {
        key: 'activity',
        label: 'Activity',
        type: 'select',
        required: true,
        options: [
          'Coffee',
          'Walk',
          'Cycling',
          'Board games',
          'Study session',
          'Work from café',
          'Networking',
          'Food exploration',
          'Music jam',
        ],
      },
      { key: 'when', label: 'When (optional)', type: 'text', placeholder: 'e.g. This evening' },
    ],
    buildHighlight: (v) => line([`👋 ${v['activity']}`, v['when']]),
  },
};

/** A blank `values` object matching a template's fields — starting state for the quick-fill form. */
export function emptyTemplateValues(template: PostTemplate): Record<string, string> {
  return Object.fromEntries(template.fields.map((f) => [f.key, '']));
}

/** True once every required field in the template has a non-empty value. */
export function isTemplateComplete(
  template: PostTemplate,
  values: Record<string, string>,
): boolean {
  return template.fields.every((f) => !f.required || has(values, f.key));
}
