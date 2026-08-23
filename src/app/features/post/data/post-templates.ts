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

  [TagCategory.Service]: {
    intro: 'What service are you offering?',
    fields: [
      {
        key: 'service',
        label: 'Service',
        type: 'select',
        required: true,
        options: [
          'Electrician',
          'Plumber',
          'Carpenter',
          'AC repair',
          'Appliance repair',
          'Cleaning',
          'Pest control',
          'Painter',
          'Freelance work',
          'Other service',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Slot open today', 'By appointment'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹300' },
      {
        key: 'area',
        label: 'Service area (optional)',
        type: 'text',
        placeholder: 'e.g. Whitefield, Marathahalli',
      },
    ],
    buildHighlight: (v) =>
      line([
        `🛠️ ${v['service']} — ${v['availability']}`,
        v['price'],
        has(v, 'area') ? `Area: ${v['area']}` : undefined,
      ]),
  },

  [TagCategory.Beauty]: {
    intro: 'What beauty or wellness service is available?',
    fields: [
      {
        key: 'service',
        label: 'Service',
        type: 'select',
        required: true,
        options: [
          'Haircut',
          'Hair colour / styling',
          'Facial',
          'Waxing',
          'Bridal makeup',
          'Manicure / pedicure',
          'Spa / massage',
          'Beard trim',
          'Other salon service',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Slot open today', 'Book for later'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹250' },
      {
        key: 'note',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. Walk-ins welcome, ladies only',
      },
    ],
    buildHighlight: (v) =>
      line([`💇 ${v['service']} — ${v['availability']}`, v['price'], v['note']]),
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
          'Clinic appointment',
          'Dental appointment',
          'Pharmacy',
          'Diagnostics / lab',
          'Physiotherapy',
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
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹250' },
      {
        key: 'note',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. Walk-ins welcome',
      },
    ],
    buildHighlight: (v) =>
      line([`🏥 ${v['service']} — ${v['availability']}`, v['price'], v['note']]),
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
    intro: "What's being taught?",
    fields: [
      {
        key: 'skill',
        label: 'Subject / skill',
        type: 'text',
        required: true,
        placeholder: 'e.g. Guitar basics, NEET coaching',
      },
      {
        key: 'sessionType',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          'Tuition',
          'Coaching / batch',
          'Workshop',
          'Music / dance class',
          'Language class',
          'Skill training',
          'Study group',
        ],
      },
      { key: 'when', label: 'When (optional)', type: 'text', placeholder: 'e.g. Weekday evenings' },
      { key: 'fee', label: 'Fee (optional)', type: 'text', placeholder: 'e.g. ₹2000/month' },
    ],
    buildHighlight: (v) => line([`📚 ${v['skill']} — ${v['sessionType']}`, v['when'], v['fee']]),
  },

  [TagCategory.Auto]: {
    intro: 'What automotive service is available?',
    fields: [
      {
        key: 'service',
        label: 'Service',
        type: 'select',
        required: true,
        options: [
          'Car wash',
          'Bike wash',
          'General service',
          'Tyre / puncture',
          'Denting & painting',
          'Accessories',
          'Vehicle rental',
          'Towing',
          'Other auto service',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Slot open today', 'By appointment'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹200' },
      {
        key: 'note',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. Doorstep service, no wait',
      },
    ],
    buildHighlight: (v) =>
      line([`🚗 ${v['service']} — ${v['availability']}`, v['price'], v['note']]),
  },

  [TagCategory.Space]: {
    intro: "What's available?",
    fields: [
      {
        key: 'spaceType',
        label: 'Space type',
        type: 'select',
        required: true,
        options: [
          'Room for rent',
          'Office space',
          'Shop for rent',
          'Coworking desk',
          'Hall / venue',
          'Parking',
          'Storage',
          'PG / hostel',
        ],
      },
      {
        key: 'availability',
        label: 'Availability',
        type: 'select',
        required: true,
        options: ['Available now', 'Available this month', 'By booking'],
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹8000/month' },
      {
        key: 'location',
        label: 'Location / area (optional)',
        type: 'text',
        placeholder: 'e.g. Koramangala 4th Block',
      },
    ],
    buildHighlight: (v) =>
      line([
        `🏠 ${v['spaceType']} — ${v['availability']}`,
        v['price'],
        has(v, 'location') ? v['location'] : undefined,
      ]),
  },

  [TagCategory.Travel]: {
    intro: "What's available for travellers?",
    fields: [
      {
        key: 'serviceType',
        label: 'Service',
        type: 'select',
        required: true,
        options: [
          'Hotel / homestay',
          'Resort',
          'Tour package',
          'Travel agent service',
          'Cab / taxi',
          'Vehicle rental',
          'Local guide',
        ],
      },
      {
        key: 'details',
        label: 'Details',
        type: 'text',
        required: true,
        placeholder: 'e.g. 2-night Coorg package, pickup included',
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹4500/night' },
      {
        key: 'validUntil',
        label: 'Valid until (optional)',
        type: 'text',
        placeholder: 'e.g. This weekend only',
      },
    ],
    buildHighlight: (v) =>
      line([
        `✈️ ${v['serviceType']} — ${v['details']}`,
        v['price'],
        has(v, 'validUntil') ? `Valid: ${v['validUntil']}` : undefined,
      ]),
  },

  [TagCategory.Biz]: {
    intro: 'Share a professional service update.',
    fields: [
      {
        key: 'updateType',
        label: 'Update',
        type: 'select',
        required: true,
        options: [
          'Consultation available',
          'New service launched',
          'Bookings open',
          'Offer / discount',
          'Walk-ins available',
          'Looking for clients',
          'Partnership / collab',
        ],
      },
      {
        key: 'service',
        label: 'Service / business',
        type: 'text',
        required: true,
        placeholder: 'e.g. Tax filing, web development, legal advice',
      },
      {
        key: 'availability',
        label: 'When (optional)',
        type: 'text',
        placeholder: 'e.g. Weekdays 10 AM–6 PM',
      },
      {
        key: 'details',
        label: 'Extra detail (optional)',
        type: 'text',
        placeholder: 'e.g. First consultation free',
      },
    ],
    buildHighlight: (v) =>
      line([`🏢 ${v['service']} — ${v['updateType']}`, v['availability'], v['details']]),
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
