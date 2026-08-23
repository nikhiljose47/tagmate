/**
 * Business post template registry — Step 1 + Step 2.A.
 *
 * Step 1 created the registry with one "general" template per category.
 * Step 2.A extends TemplateField with richer types, adds `mapsTo` for
 * universal-vs-templateData mapping, reusable presets, buildTitle(),
 * validation, expiry resolution, and value-extraction helpers.
 *
 * The "general" templates are kept as enabled=false legacy entries so old
 * posts with post_subtype="general" still resolve. New templates added in
 * Step 2.B will replace them as the defaults.
 *
 * Registry contract:
 *   - One template per (category, id) pair — ids must be unique within a category.
 *   - template_version >= 1.
 *   - displayOrder drives sort order in future pickers.
 *   - enabled: false → excluded from normal selection (admin/sunset).
 *   - recommended: true → returned first by getRecommendedTemplates().
 *   - defaultIntent/defaultCta/defaultExpiresIn → pre-fill composer values.
 */

import { TagCategory } from '../../../core/enums/tag-category.enum';
import { PostCta, PostIntent } from '../../../core/models/tag.model';

// ─── Field types ─────────────────────────────────────────────────────────────

export type TemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'price'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'time'
  | 'datetime'
  | 'toggle'
  | 'url'
  | 'phone';

/**
 * Identifies which Tag column a template field should map to on submission.
 * Fields without a `mapsTo` value are stored inside `Tag.templateData`.
 */
export type UniversalFieldMapping =
  | 'title'
  | 'price'
  | 'originalPrice'
  | 'availabilityNote'
  | 'eventStart'
  | 'eventEnd'
  | 'productLink'
  | 'cta'
  | 'intent'
  | 'expiresIn';

export interface TemplateField {
  /** Unique within the template — key used by buildHighlight and value maps. */
  readonly key: string;
  readonly type: TemplateFieldType;
  readonly label: string;
  /** Shorter label for mobile/validation messages. Falls back to label. */
  readonly shortLabel?: string;
  readonly placeholder?: string;
  /** Explanatory text shown below the control. */
  readonly helpText?: string;
  readonly required?: boolean;
  /** Required for 'select' and 'multi-select'. */
  readonly options?: readonly string[];
  readonly defaultValue?: string;
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
  /**
   * When set, the field's value is written to the named Tag column instead of
   * templateData. Omit (or leave undefined) for category-specific data that
   * belongs in the JSONB column.
   */
  readonly mapsTo?: UniversalFieldMapping;
}

// ─── Template definition ─────────────────────────────────────────────────────

export interface PostTemplateDefinition {
  /** Unique within its parent category — stored as `post_subtype` on the row. */
  readonly id: string;
  readonly category: TagCategory;
  /** Human-readable label shown in future picker UI. */
  readonly label: string;
  readonly shortDescription?: string;
  readonly icon?: string;
  /** Monotonic version; bumped when fields change in a breaking way. */
  readonly version: number;
  readonly recommended?: boolean;
  /** Lower number = shown first. */
  readonly displayOrder?: number;
  /** Set to false to hide from normal selection (disabled/sunset). */
  readonly enabled?: boolean;
  /** Intro text shown above the quick-fill form. */
  readonly intro: string;
  readonly fields: readonly TemplateField[];
  /** Composes the post caption from the filled-in field values. */
  buildHighlight(values: Record<string, string>): string;
  /** Generates a concise structured title. Returns '' when not enough data. */
  buildTitle?(values: Record<string, string>): string;
  readonly defaultIntent?: PostIntent;
  readonly defaultCta?: PostCta;
  /** Suggested expiry in minutes. */
  readonly defaultExpiresIn?: number;
  /**
   * Optional cross-field validator. Returns a map of key → error message.
   * Called after per-field validation; only fields that passed individual
   * checks are available for cross-field logic.
   */
  validate?(values: Record<string, string>): Record<string, string>;
}

// ─── Highlight / title helpers ───────────────────────────────────────────────

/** True when a value is present and non-blank. */
export const has = (v: Record<string, string>, key: string): boolean => !!v[key]?.trim();

/** Join non-empty fragments with a separator (default ' • '). */
export const joinParts = (parts: (string | false | undefined | null)[], sep = ' • '): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join(sep);

/** Format a price value with ₹ prefix. Returns '' if value is empty/invalid. */
export const fmtPrice = (v: string | undefined): string => {
  if (!v?.trim()) return '';
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n}` : v;
};

/** Builds "₹199 (was ₹299)" or just "₹199" depending on what's provided. */
export const fmtPriceRange = (
  price: string | undefined,
  originalPrice: string | undefined,
): string => {
  const p = fmtPrice(price);
  const o = fmtPrice(originalPrice);
  if (!p && !o) return '';
  if (p && o && o !== p) return `${p} (was ${o})`;
  return p || o;
};

// ─── Reusable field presets ──────────────────────────────────────────────────
// Each returns a fresh object so callers can spread-override properties.

export const presets = {
  price: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'price',
    type: 'price',
    label: 'Price',
    placeholder: 'e.g. 199',
    mapsTo: 'price',
    min: 0,
    ...overrides,
  }),

  originalPrice: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'originalPrice',
    type: 'price',
    label: 'Original price',
    shortLabel: 'Original price',
    placeholder: 'e.g. 299',
    mapsTo: 'originalPrice',
    min: 0,
    ...overrides,
  }),

  description: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'description',
    type: 'textarea',
    label: 'Short description',
    placeholder: 'A line or two about this…',
    maxLength: 500,
    ...overrides,
  }),

  eventStart: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'eventStart',
    type: 'datetime',
    label: 'Start date & time',
    mapsTo: 'eventStart',
    ...overrides,
  }),

  eventEnd: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'eventEnd',
    type: 'datetime',
    label: 'End date & time',
    mapsTo: 'eventEnd',
    ...overrides,
  }),

  startDate: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'startDate',
    type: 'date',
    label: 'Date',
    ...overrides,
  }),

  startTime: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'startTime',
    type: 'time',
    label: 'Time',
    ...overrides,
  }),

  endDate: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'endDate',
    type: 'date',
    label: 'End date',
    ...overrides,
  }),

  endTime: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'endTime',
    type: 'time',
    label: 'End time',
    ...overrides,
  }),

  slotCount: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'slotCount',
    type: 'number',
    label: 'Number of slots',
    placeholder: 'e.g. 5',
    min: 1,
    ...overrides,
  }),

  validUntil: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'validUntil',
    type: 'text',
    label: 'Valid until',
    placeholder: 'e.g. Today only, End of month',
    ...overrides,
  }),

  productLink: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'productLink',
    type: 'url',
    label: 'Product link',
    placeholder: 'https://…',
    mapsTo: 'productLink',
    ...overrides,
  }),

  availabilityNote: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'availabilityNote',
    type: 'text',
    label: 'Availability note',
    placeholder: 'e.g. 3 slots left, Walk-ins welcome',
    mapsTo: 'availabilityNote',
    ...overrides,
  }),

  phone: (overrides?: Partial<TemplateField>): TemplateField => ({
    key: 'contactPhone',
    type: 'phone',
    label: 'Contact phone',
    placeholder: 'e.g. +91 98765 43210',
    ...overrides,
  }),
} as const;

/** Price + original-price pair ready to spread into a fields array. */
export const priceGroup = (
  priceOverrides?: Partial<TemplateField>,
  origOverrides?: Partial<TemplateField>,
): [TemplateField, TemplateField] => [
  presets.price(priceOverrides),
  presets.originalPrice(origOverrides),
];

/** Event start + end pair. */
export const eventGroup = (
  startOverrides?: Partial<TemplateField>,
  endOverrides?: Partial<TemplateField>,
): [TemplateField, TemplateField] => [
  presets.eventStart(startOverrides),
  presets.eventEnd(endOverrides),
];

/** Appointment date + time pair (not mapped to eventStart/End — stored in templateData). */
export const appointmentGroup = (
  dateOverrides?: Partial<TemplateField>,
  timeOverrides?: Partial<TemplateField>,
): [TemplateField, TemplateField] => [
  presets.startDate(dateOverrides),
  presets.startTime(timeOverrides),
];

// ─── Value extraction & sanitisation ─────────────────────────────────────────

export interface MappedTemplateOutput {
  /** Values that should be written to top-level Tag columns. */
  tagFields: Partial<Record<UniversalFieldMapping, string>>;
  /** Everything else — written to Tag.templateData. */
  templateData: Record<string, unknown>;
}

/**
 * Splits filled template values into universal Tag fields vs templateData,
 * based on each field's `mapsTo` declaration.
 *
 * - Blank/undefined values are omitted from both maps.
 * - Only fields defined by the template are included (stale keys from a
 *   previous template are dropped).
 * - `false` and `0` are preserved as legitimate values.
 */
export function mapTemplateValues(
  template: Pick<PostTemplateDefinition, 'fields'>,
  values: Record<string, string>,
): MappedTemplateOutput {
  const tagFields: Partial<Record<UniversalFieldMapping, string>> = {};
  const templateData: Record<string, unknown> = {};
  for (const field of template.fields) {
    const raw = values[field.key];
    // Keep '0' and 'false'; drop only undefined/null/empty-string.
    if (raw === undefined || raw === null || raw === '') continue;

    if (field.mapsTo) {
      tagFields[field.mapsTo] = raw;
    } else {
      templateData[field.key] = raw;
    }
  }

  return { tagFields, templateData };
}

/**
 * Sanitises a raw templateData object before persistence.
 * Removes undefined, non-serialisable values, and keys not in the template.
 */
export function sanitiseTemplateData(
  template: Pick<PostTemplateDefinition, 'fields'>,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = new Set(template.fields.filter((f) => !f.mapsTo).map((f) => f.key));
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.has(k)) continue;
    if (v === undefined) continue;
    // Drop non-serialisable values (functions, symbols, blob URLs)
    if (typeof v === 'function' || typeof v === 'symbol') continue;
    if (typeof v === 'string' && v.startsWith('blob:')) continue;
    clean[k] = v;
  }
  return clean;
}

/**
 * Restores stored Tag + templateData back into a flat values map suitable for
 * the template form. Inverse of `mapTemplateValues`.
 */
export function restoreTemplateValues(
  template: Pick<PostTemplateDefinition, 'fields'>,
  tagFields: Record<string, unknown>,
  templateData: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    if (field.mapsTo) {
      const v = tagFields[field.mapsTo];
      values[field.key] = v != null ? String(v) : '';
    } else {
      const v = templateData?.[field.key];
      values[field.key] = v != null ? String(v) : '';
    }
  }
  return values;
}

// ─── Defaults resolver ───────────────────────────────────────────────────────

export interface TemplateDefaults {
  intent?: PostIntent;
  cta?: PostCta;
  expiresIn?: number;
}

/**
 * Resolves template defaults. Only returns values that should be applied — the
 * caller must not overwrite already-filled fields.
 */
export function resolveTemplateDefaults(
  template: Pick<PostTemplateDefinition, 'defaultIntent' | 'defaultCta' | 'defaultExpiresIn'>,
): TemplateDefaults {
  const d: TemplateDefaults = {};
  if (template.defaultIntent) d.intent = template.defaultIntent;
  if (template.defaultCta) d.cta = template.defaultCta;
  if (template.defaultExpiresIn) d.expiresIn = template.defaultExpiresIn;
  return d;
}

// ─── Expiry resolver ─────────────────────────────────────────────────────────

/**
 * Suggests an expiry in minutes for a template + values pair.
 *
 * Priority:
 *   1. If the template has an eventEnd-mapped field with a valid future value,
 *      use eventEnd + 60 min (capped at 30 days).
 *   2. Fall back to template's defaultExpiresIn.
 *   3. Return undefined — caller should keep current selection.
 */
export function resolveExpiry(
  template: Pick<PostTemplateDefinition, 'fields' | 'defaultExpiresIn'>,
  values: Record<string, string>,
): number | undefined {
  const endField = template.fields.find((f) => f.mapsTo === 'eventEnd');
  if (endField) {
    const raw = values[endField.key]?.trim();
    if (raw) {
      const ms = new Date(raw).getTime();
      if (!isNaN(ms)) {
        const diffMin = Math.round((ms - Date.now()) / 60_000);
        if (diffMin > 0) return Math.min(diffMin + 60, 43_200); // cap 30 days
      }
    }
  }
  return template.defaultExpiresIn;
}

// ─── Shared template factories ───────────────────────────────────────────────

function makeJobTemplate(cat: TagCategory, order: number): PostTemplateDefinition {
  return {
    id: 'job',
    category: cat,
    label: "💼 We're Hiring",
    icon: '💼',
    shortDescription: 'Post a job opening',
    version: 1,
    displayOrder: order,
    intro: 'What role are you hiring for?',
    fields: [
      {
        key: 'role',
        type: 'text',
        label: 'Role / job title',
        required: true,
        placeholder: 'e.g. Delivery helper',
        mapsTo: 'title',
      },
      {
        key: 'openings',
        type: 'number',
        label: 'Number of openings',
        placeholder: 'e.g. 2',
        min: 1,
      },
      {
        key: 'workType',
        type: 'select',
        label: 'Work type',
        options: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Temporary'],
      },
      {
        key: 'experience',
        type: 'text',
        label: 'Experience / skills',
        placeholder: 'e.g. 1 year experience',
      },
      { key: 'salary', type: 'text', label: 'Salary / pay', placeholder: 'e.g. ₹15,000/month' },
      {
        key: 'howToApply',
        type: 'text',
        label: 'How to apply',
        placeholder: 'e.g. Call us, walk in',
      },
    ],
    buildTitle: (v) => v['role']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `💼 Hiring: ${v['role']}`,
        has(v, 'workType') ? v['workType'] : undefined,
        has(v, 'salary') ? v['salary'] : undefined,
        has(v, 'openings') ? `${v['openings']} opening(s)` : undefined,
      ]),
    defaultIntent: 'looking_for',
    defaultCta: 'interested',
    defaultExpiresIn: 20160,
  };
}

function makeLookingForTemplate(cat: TagCategory, order: number): PostTemplateDefinition {
  return {
    id: 'looking_for',
    category: cat,
    label: '❓ Looking For',
    icon: '❓',
    shortDescription: 'Post a requirement or wanted ad',
    version: 1,
    displayOrder: order,
    intro: 'What are you looking for?',
    fields: [
      {
        key: 'item',
        type: 'text',
        label: 'What are you looking for?',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Supplier, equipment, partner',
      },
      {
        key: 'details',
        type: 'textarea',
        label: 'Details',
        placeholder: 'Describe what you need…',
        maxLength: 500,
      },
      { key: 'budget', type: 'text', label: 'Budget', placeholder: 'e.g. Up to ₹10,000' },
      { key: 'quantity', type: 'text', label: 'Quantity', placeholder: 'e.g. 50 units' },
      { key: 'neededBy', type: 'text', label: 'Needed by', placeholder: 'e.g. End of month' },
    ],
    buildTitle: (v) => v['item']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `❓ Looking for: ${v['item']}`,
        has(v, 'details') ? v['details'] : undefined,
        has(v, 'budget') ? `Budget: ${v['budget']}` : undefined,
        has(v, 'neededBy') ? `Needed by ${v['neededBy']}` : undefined,
      ]),
    defaultIntent: 'looking_for',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  };
}

function makeUpdateTemplate(cat: TagCategory, order: number): PostTemplateDefinition {
  return {
    id: 'update',
    category: cat,
    label: '📢 Update',
    icon: '📢',
    shortDescription: 'Share a general update',
    version: 1,
    displayOrder: order,
    intro: "What's the update?",
    fields: [
      {
        key: 'updateTitle',
        type: 'text',
        label: 'Update title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Opening late today',
      },
      {
        key: 'details',
        type: 'textarea',
        label: 'Details',
        placeholder: 'Any extra info…',
        maxLength: 500,
      },
      {
        key: 'effectiveUntil',
        type: 'text',
        label: 'Effective until',
        placeholder: 'e.g. Tomorrow, End of week',
      },
    ],
    buildTitle: (v) => v['updateTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📢 ${v['updateTitle']}`,
        has(v, 'details') ? v['details'] : undefined,
        has(v, 'effectiveUntil') ? `Until ${v['effectiveUntil']}` : undefined,
      ]),
    defaultExpiresIn: 4320,
  };
}

function makeEventSubtemplate(cat: TagCategory, order: number): PostTemplateDefinition {
  return {
    id: 'event',
    category: cat,
    label: '🎉 Event',
    icon: '🎉',
    shortDescription: 'Announce an event',
    version: 1,
    displayOrder: order,
    intro: 'What event are you hosting?',
    fields: [
      {
        key: 'eventName',
        type: 'text',
        label: 'Event name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Grand opening, live music night',
      },
      ...eventGroup({ required: true }),
      { key: 'venue', type: 'text', label: 'Venue / location', placeholder: 'e.g. Main branch' },
      {
        key: 'details',
        type: 'textarea',
        label: 'Details',
        placeholder: 'What to expect…',
        maxLength: 500,
      },
      presets.price({ label: 'Entry fee', placeholder: 'e.g. 200 (or leave blank if free)' }),
    ],
    buildTitle: (v) => v['eventName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎉 ${v['eventName']}`,
        has(v, 'venue') ? `at ${v['venue']}` : undefined,
        fmtPrice(v['price']) ? `Entry: ${fmtPrice(v['price'])}` : 'Free entry',
      ]),
    defaultIntent: 'happening',
    defaultCta: 'join',
    defaultExpiresIn: 1440,
  };
}

function makeOfferTemplate(
  cat: TagCategory,
  order: number,
  overrides?: Partial<
    Pick<PostTemplateDefinition, 'label' | 'icon' | 'shortDescription' | 'intro' | 'recommended'>
  >,
): PostTemplateDefinition {
  return {
    id: 'offer',
    category: cat,
    label: '🏷 Offer / Discount',
    icon: '🏷',
    shortDescription: 'Post a deal or discount',
    version: 1,
    recommended: true,
    displayOrder: order,
    intro: "What's the offer?",
    ...overrides,
    fields: [
      {
        key: 'offerTitle',
        type: 'text',
        label: 'Offer title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 20% off all items',
      },
      ...priceGroup({ label: 'Offer price' }),
      {
        key: 'details',
        type: 'textarea',
        label: 'Offer details',
        placeholder: "What's included…",
        maxLength: 500,
      },
      presets.validUntil(),
      {
        key: 'conditions',
        type: 'text',
        label: 'Conditions',
        placeholder: 'e.g. Min ₹500 purchase',
      },
    ],
    buildTitle: (v) => v['offerTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏷 ${v['offerTitle']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'details') ? v['details'] : undefined,
        has(v, 'validUntil') ? `Valid until ${v['validUntil']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'visit_shop',
    defaultExpiresIn: 1440,
  };
}

function makeLegacyGeneral(
  cat: TagCategory,
  label: string,
  intro: string,
  fields: PostTemplateDefinition['fields'],
  buildHighlight: PostTemplateDefinition['buildHighlight'],
  defaults?: Partial<
    Pick<PostTemplateDefinition, 'defaultIntent' | 'defaultCta' | 'defaultExpiresIn'>
  >,
): PostTemplateDefinition {
  return {
    id: 'general',
    category: cat,
    label,
    version: 1,
    recommended: false,
    displayOrder: 999,
    enabled: false,
    intro,
    fields,
    buildHighlight,
    ...defaults,
  };
}

// ─── Category catalogues ─────────────────────────────────────────────────────

// ━━━ SHOP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SHOP_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'product',
    category: TagCategory.Shop,
    label: '🛒 Product for Sale',
    icon: '🛒',
    shortDescription: 'List a product with price and details',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What product are you selling?',
    fields: [
      {
        key: 'productName',
        type: 'text',
        label: 'Product name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Wireless earbuds',
      },
      presets.price({ required: true }),
      presets.originalPrice(),
      presets.description(),
      { key: 'brand', type: 'text', label: 'Brand', placeholder: 'e.g. Samsung' },
      {
        key: 'stockStatus',
        type: 'select',
        label: 'Stock status',
        options: ['In stock', 'Limited stock', 'Last few pieces', 'Made to order'],
      },
      presets.productLink(),
    ],
    buildTitle: (v) => v['productName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🛒 ${v['productName']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'brand') ? `Brand: ${v['brand']}` : undefined,
        has(v, 'stockStatus') ? v['stockStatus'] : undefined,
      ]),
    defaultIntent: 'sell_give',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  makeOfferTemplate(TagCategory.Shop, 20),
  {
    id: 'new_arrival',
    category: TagCategory.Shop,
    label: '✨ New Arrival',
    icon: '✨',
    shortDescription: 'Announce new stock or products',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: "What's new in your shop?",
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: 'Product / item name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Summer collection',
      },
      presets.price(),
      {
        key: 'whatsNew',
        type: 'textarea',
        label: "What's new / special?",
        placeholder: 'Describe what makes it special…',
        maxLength: 300,
      },
      {
        key: 'brand',
        type: 'text',
        label: 'Brand / category',
        placeholder: 'e.g. Nike, Electronics',
      },
      presets.availabilityNote({ placeholder: 'e.g. Limited stock, While supplies last' }),
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `✨ New arrival: ${v['itemName']}`,
        fmtPrice(v['price']),
        has(v, 'whatsNew') ? v['whatsNew'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'visit_shop',
    defaultExpiresIn: 10080,
  },
  {
    id: 'available_today',
    category: TagCategory.Shop,
    label: '⏰ Available Today',
    icon: '⏰',
    shortDescription: 'Short-lived availability post',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: "What's available today?",
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: 'What is available?',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Fresh flowers, phone cases',
      },
      presets.price(),
      {
        key: 'availableUntil',
        type: 'text',
        label: 'Available until',
        placeholder: 'e.g. 8 PM today',
      },
      presets.availabilityNote(),
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `⏰ Available today: ${v['itemName']}`,
        fmtPrice(v['price']),
        has(v, 'availableUntil') ? `Until ${v['availableUntil']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'visit_shop',
    defaultExpiresIn: 720,
  },
  {
    id: 'limited_stock',
    category: TagCategory.Shop,
    label: '🔥 Limited Stock',
    icon: '🔥',
    shortDescription: 'Highlight low-stock items',
    version: 1,
    displayOrder: 50,
    intro: "What's running low?",
    fields: [
      {
        key: 'productName',
        type: 'text',
        label: 'Product',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. iPhone 15 cases',
      },
      presets.price(),
      { key: 'stockNote', type: 'text', label: 'Stock note', placeholder: 'e.g. Only 3 left' },
      presets.description(),
    ],
    buildTitle: (v) => v['productName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🔥 Limited stock: ${v['productName']}`,
        fmtPrice(v['price']),
        has(v, 'stockNote') ? v['stockNote'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'visit_shop',
    defaultExpiresIn: 1440,
  },
  {
    id: 'back_in_stock',
    category: TagCategory.Shop,
    label: '📦 Back in Stock',
    icon: '📦',
    shortDescription: 'Announce restocked items',
    version: 1,
    displayOrder: 60,
    intro: "What's back in stock?",
    fields: [
      {
        key: 'productName',
        type: 'text',
        label: 'Product',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Samsung Galaxy buds',
      },
      presets.price(),
      {
        key: 'stockNote',
        type: 'text',
        label: 'Stock note',
        placeholder: 'e.g. Fresh batch, limited quantity',
      },
      presets.description(),
    ],
    buildTitle: (v) => v['productName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📦 Back in stock: ${v['productName']}`,
        fmtPrice(v['price']),
        has(v, 'stockNote') ? v['stockNote'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'visit_shop',
    defaultExpiresIn: 4320,
  },
  makeUpdateTemplate(TagCategory.Shop, 70),
  makeJobTemplate(TagCategory.Shop, 80),
  makeEventSubtemplate(TagCategory.Shop, 85),
  makeLookingForTemplate(TagCategory.Shop, 90),
  makeLegacyGeneral(
    TagCategory.Shop,
    'General shop update',
    "What's the deal?",
    [
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
    (v) =>
      joinParts([
        `🛍️ ${v['item']} — ${v['dealType']}`,
        v['price'],
        has(v, 'validUntil') ? `Valid: ${v['validUntil']}` : undefined,
      ]),
    { defaultIntent: 'offer', defaultCta: 'visit_shop' },
  ),
];

// ━━━ FOOD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FOOD_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'todays_special',
    category: TagCategory.Food,
    label: "🍽️ Today's Special",
    icon: '🍽️',
    shortDescription: "Highlight today's special dish or meal",
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: "What's today's special?",
    fields: [
      {
        key: 'dishName',
        type: 'text',
        label: 'Dish / special name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Chicken Biriyani Combo',
      },
      presets.price(),
      presets.originalPrice(),
      presets.description({
        label: 'Short description',
        placeholder: 'e.g. Served with raita and salad',
      }),
      { key: 'availableUntil', type: 'text', label: 'Available until', placeholder: 'e.g. 9 PM' },
      { key: 'serves', type: 'text', label: 'Serves', placeholder: 'e.g. 2 people' },
      {
        key: 'dietary',
        type: 'select',
        label: 'Dietary type',
        options: ['Veg', 'Non-veg', 'Vegan', 'Egg-free', 'Gluten-free'],
      },
      {
        key: 'dineIn',
        type: 'toggle',
        label: 'Dine-in',
        defaultValue: 'true',
        placeholder: 'Available',
      },
      { key: 'pickup', type: 'toggle', label: 'Pickup', placeholder: 'Available' },
      { key: 'delivery', type: 'toggle', label: 'Delivery', placeholder: 'Available' },
    ],
    buildTitle: (v) => v['dishName']?.trim() || '',
    buildHighlight: (v) => {
      const modes = [
        v['dineIn'] === 'true' ? 'Dine-in' : '',
        v['pickup'] === 'true' ? 'Pickup' : '',
        v['delivery'] === 'true' ? 'Delivery' : '',
      ]
        .filter(Boolean)
        .join(', ');
      return joinParts([
        `🍽️ Today's special: ${v['dishName']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'availableUntil') ? `Available until ${v['availableUntil']}` : undefined,
        modes || undefined,
      ]);
    },
    defaultIntent: 'available_now',
    defaultCta: 'directions',
    defaultExpiresIn: 720,
  },
  makeOfferTemplate(TagCategory.Food, 20),
  {
    id: 'available_now',
    category: TagCategory.Food,
    label: '🟢 Available Now',
    icon: '🟢',
    shortDescription: "Announce what's ready right now",
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: "What's available right now?",
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: "What's available?",
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Hot samosas, fresh juice',
      },
      presets.price(),
      { key: 'availableUntil', type: 'text', label: 'Available until', placeholder: 'e.g. 2 PM' },
      {
        key: 'dineIn',
        type: 'toggle',
        label: 'Dine-in',
        defaultValue: 'true',
        placeholder: 'Available',
      },
      { key: 'pickup', type: 'toggle', label: 'Pickup', placeholder: 'Available' },
      { key: 'delivery', type: 'toggle', label: 'Delivery', placeholder: 'Available' },
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🟢 Available now: ${v['itemName']}`,
        fmtPrice(v['price']),
        has(v, 'availableUntil') ? `Until ${v['availableUntil']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'directions',
    defaultExpiresIn: 360,
  },
  {
    id: 'table_available',
    category: TagCategory.Food,
    label: '🪑 Table Available',
    icon: '🪑',
    shortDescription: 'Announce table availability',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'When is a table available?',
    fields: [
      { key: 'date', type: 'date', label: 'Date', required: true },
      { key: 'time', type: 'time', label: 'Available time', required: true },
      {
        key: 'partySize',
        type: 'text',
        label: 'Table / party size',
        placeholder: 'e.g. 2–4 people',
      },
      { key: 'tables', type: 'number', label: 'Tables available', placeholder: 'e.g. 3', min: 1 },
      {
        key: 'bookingNote',
        type: 'text',
        label: 'Booking note',
        placeholder: 'e.g. Walk-in or call to reserve',
      },
    ],
    buildTitle: () => 'Table Available',
    buildHighlight: (v) =>
      joinParts([
        `🪑 Table available on ${v['date']} at ${v['time']}`,
        has(v, 'partySize') ? `for ${v['partySize']}` : undefined,
        has(v, 'tables') ? `${v['tables']} table(s)` : undefined,
        has(v, 'bookingNote') ? v['bookingNote'] : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 720,
  },
  {
    id: 'menu_item',
    category: TagCategory.Food,
    label: '📋 Menu Item',
    icon: '📋',
    shortDescription: 'Highlight a menu item',
    version: 1,
    displayOrder: 50,
    intro: 'Which menu item do you want to feature?',
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: 'Item name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Paneer Butter Masala',
      },
      presets.price({ required: true }),
      presets.description({ placeholder: 'e.g. Creamy, rich, served with naan' }),
      {
        key: 'dietary',
        type: 'select',
        label: 'Dietary type',
        options: ['Veg', 'Non-veg', 'Vegan', 'Egg-free'],
      },
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📋 ${v['itemName']}`,
        fmtPrice(v['price']),
        has(v, 'dietary') ? v['dietary'] : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'directions',
    defaultExpiresIn: 10080,
  },
  {
    id: 'new_menu_item',
    category: TagCategory.Food,
    label: '🆕 New Menu Item',
    icon: '🆕',
    shortDescription: 'Announce a new addition to the menu',
    version: 1,
    displayOrder: 55,
    intro: "What's new on the menu?",
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: 'New item name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Truffle Mushroom Pizza',
      },
      presets.price(),
      presets.description({
        label: 'Description',
        required: true,
        placeholder: 'Tell people about this new item',
      }),
      {
        key: 'availableFrom',
        type: 'text',
        label: 'Available from',
        placeholder: 'e.g. This weekend',
      },
      {
        key: 'dietary',
        type: 'select',
        label: 'Dietary type',
        options: ['Veg', 'Non-veg', 'Vegan', 'Egg-free'],
      },
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 New on the menu: ${v['itemName']}`,
        fmtPrice(v['price']),
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'directions',
    defaultExpiresIn: 10080,
  },
  {
    id: 'preorder',
    category: TagCategory.Food,
    label: '📦 Pre-order',
    icon: '📦',
    shortDescription: 'Accept pre-orders for items',
    version: 1,
    displayOrder: 60,
    intro: 'What can customers pre-order?',
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: 'Item',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Christmas cake',
      },
      presets.price(),
      {
        key: 'orderBy',
        type: 'text',
        label: 'Order by',
        required: true,
        placeholder: 'e.g. Dec 20',
      },
      {
        key: 'pickupDate',
        type: 'text',
        label: 'Pickup / delivery date',
        placeholder: 'e.g. Dec 24',
      },
      { key: 'minQty', type: 'number', label: 'Minimum quantity', placeholder: 'e.g. 1', min: 1 },
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📦 Pre-order: ${v['itemName']}`,
        fmtPrice(v['price']),
        `Order by ${v['orderBy']}`,
        has(v, 'pickupDate') ? `Ready ${v['pickupDate']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'delivery_update',
    category: TagCategory.Food,
    label: '🛵 Delivery Update',
    icon: '🛵',
    shortDescription: 'Announce delivery area or status changes',
    version: 1,
    displayOrder: 65,
    intro: "What's the delivery update?",
    fields: [
      {
        key: 'updateTitle',
        type: 'text',
        label: 'Update title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Now delivering to Whitefield',
      },
      {
        key: 'deliveryArea',
        type: 'text',
        label: 'Delivery area / status',
        required: true,
        placeholder: 'e.g. Within 5 km, Koramangala area',
      },
      { key: 'availableUntil', type: 'text', label: 'Available until', placeholder: 'e.g. 10 PM' },
      { key: 'minOrder', type: 'text', label: 'Minimum order', placeholder: 'e.g. ₹200' },
    ],
    buildTitle: (v) => v['updateTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🛵 ${v['updateTitle']}`,
        v['deliveryArea'],
        has(v, 'minOrder') ? `Min order: ${v['minOrder']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 720,
  },
  makeEventSubtemplate(TagCategory.Food, 70),
  makeJobTemplate(TagCategory.Food, 80),
  makeUpdateTemplate(TagCategory.Food, 85),
  makeLookingForTemplate(TagCategory.Food, 90),
  makeLegacyGeneral(
    TagCategory.Food,
    'General food update',
    "What's on offer?",
    [
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
    (v) =>
      joinParts([
        `🍜 ${v['dish']} — ${v['offerType']}`,
        v['price'],
        has(v, 'window') ? `Available: ${v['window']}` : undefined,
      ]),
    { defaultIntent: 'offer', defaultCta: 'visit_shop' },
  ),
];

// ━━━ SERVICE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SERVICE_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'service_available',
    category: TagCategory.Service,
    label: '🛠️ Service Available',
    icon: '🛠️',
    shortDescription: 'Announce an available service',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What service are you offering?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. AC repair & maintenance',
      },
      presets.price({ label: 'Starting price' }),
      presets.description(),
      {
        key: 'serviceArea',
        type: 'text',
        label: 'Service area',
        placeholder: 'e.g. Whitefield, Marathahalli',
      },
      { key: 'homeVisit', type: 'toggle', label: 'Home visit available', placeholder: 'Yes' },
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🛠️ ${v['serviceName']}`,
        fmtPrice(v['price']) ? `From ${fmtPrice(v['price'])}` : undefined,
        has(v, 'serviceArea') ? `Area: ${v['serviceArea']}` : undefined,
        v['homeVisit'] === 'true' ? 'Home visit available' : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  {
    id: 'available_now',
    category: TagCategory.Service,
    label: '🟢 Available Now',
    icon: '🟢',
    shortDescription: 'Announce immediate availability',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: "What's available right now?",
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Plumber — no waiting',
      },
      {
        key: 'availableUntil',
        type: 'text',
        label: 'Available until',
        required: true,
        placeholder: 'e.g. 6 PM today',
      },
      { key: 'area', type: 'text', label: 'Area', placeholder: 'e.g. HSR Layout' },
      presets.price(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🟢 Available now: ${v['serviceName']}`,
        fmtPrice(v['price']),
        `Until ${v['availableUntil']}`,
        has(v, 'area') ? `Area: ${v['area']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 360,
  },
  {
    id: 'appointment_slot',
    category: TagCategory.Service,
    label: '📅 Appointment Slot',
    icon: '📅',
    shortDescription: 'Open appointment slots',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What appointment slot is open?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Pest control visit',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      presets.price(),
      presets.slotCount(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 ${v['serviceName']} — ${v['startDate']} at ${v['startTime']}`,
        fmtPrice(v['price']),
        has(v, 'slotCount') ? `${v['slotCount']} slot(s) open` : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 1440,
  },
  makeOfferTemplate(TagCategory.Service, 40),
  {
    id: 'emergency_service',
    category: TagCategory.Service,
    label: '🚨 Emergency Service',
    icon: '🚨',
    shortDescription: 'Offer urgent / emergency service',
    version: 1,
    displayOrder: 50,
    intro: 'What emergency service is available?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 24/7 plumbing',
      },
      {
        key: 'availableUntil',
        type: 'text',
        label: 'Available until',
        placeholder: 'e.g. Midnight',
      },
      {
        key: 'serviceArea',
        type: 'text',
        label: 'Service area',
        placeholder: 'e.g. Bangalore city',
      },
      presets.price({ label: 'Callout charge' }),
      {
        key: 'note',
        type: 'text',
        label: 'Note',
        placeholder: 'e.g. Quick response, 30 min arrival',
      },
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🚨 Emergency: ${v['serviceName']}`,
        fmtPrice(v['price']) ? `Callout: ${fmtPrice(v['price'])}` : undefined,
        has(v, 'serviceArea') ? `Area: ${v['serviceArea']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 720,
  },
  {
    id: 'new_service',
    category: TagCategory.Service,
    label: '🆕 New Service',
    icon: '🆕',
    shortDescription: 'Announce a new service offering',
    version: 1,
    displayOrder: 55,
    intro: 'What new service are you offering?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Solar panel installation',
      },
      presets.description({ required: true }),
      presets.price({ label: 'Starting price' }),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 New service: ${v['serviceName']}`,
        fmtPrice(v['price']) ? `From ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'service_package',
    category: TagCategory.Service,
    label: '📦 Service Package',
    icon: '📦',
    shortDescription: 'Offer a bundled service package',
    version: 1,
    displayOrder: 60,
    intro: "What's in the package?",
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Annual AC maintenance plan',
      },
      presets.price({ required: true }),
      presets.originalPrice(),
      {
        key: 'includes',
        type: 'textarea',
        label: "What's included",
        required: true,
        placeholder: 'e.g. 2 services, filter cleaning, gas top-up',
        maxLength: 500,
      },
      { key: 'validity', type: 'text', label: 'Validity', placeholder: 'e.g. 1 year' },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📦 ${v['packageName']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        `Includes: ${v['includes']}`,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'service_area_update',
    category: TagCategory.Service,
    label: '📍 Service Area Update',
    icon: '📍',
    shortDescription: 'Update your service area',
    version: 1,
    displayOrder: 65,
    intro: 'What areas do you now serve?',
    fields: [
      {
        key: 'updateTitle',
        type: 'text',
        label: 'Update',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Now serving Sarjapur Road',
      },
      {
        key: 'areasServed',
        type: 'text',
        label: 'Areas served',
        required: true,
        placeholder: 'e.g. HSR, Sarjapur, Bellandur',
      },
      {
        key: 'effectiveDate',
        type: 'text',
        label: 'Effective date',
        placeholder: 'e.g. From next Monday',
      },
    ],
    buildTitle: (v) => v['updateTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📍 ${v['updateTitle']}`,
        `Areas: ${v['areasServed']}`,
        has(v, 'effectiveDate') ? `From ${v['effectiveDate']}` : undefined,
      ]),
    defaultExpiresIn: 10080,
  },
  makeJobTemplate(TagCategory.Service, 70),
  makeUpdateTemplate(TagCategory.Service, 80),
  makeLookingForTemplate(TagCategory.Service, 90),
  makeLegacyGeneral(
    TagCategory.Service,
    'General service update',
    'What service are you offering?',
    [
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
        placeholder: 'e.g. Whitefield',
      },
    ],
    (v) =>
      joinParts([
        `🛠️ ${v['service']} — ${v['availability']}`,
        v['price'],
        has(v, 'area') ? `Area: ${v['area']}` : undefined,
      ]),
    { defaultIntent: 'available_now', defaultCta: 'call' },
  ),
];

// ━━━ BEAUTY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BEAUTY_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'service',
    category: TagCategory.Beauty,
    label: '💇 Service',
    icon: '💇',
    shortDescription: 'Offer a beauty or wellness service',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What service are you offering?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service / treatment',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Haircut + blow-dry',
      },
      presets.price({ required: true }),
      { key: 'duration', type: 'text', label: 'Duration', placeholder: 'e.g. 45 min' },
      presets.description(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `💇 ${v['serviceName']}`,
        fmtPrice(v['price']),
        has(v, 'duration') ? v['duration'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'appointment_available',
    category: TagCategory.Beauty,
    label: '📅 Appointment Available',
    icon: '📅',
    shortDescription: 'Open appointment slots',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What appointment is available?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Facial + cleanup',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      presets.price(),
      presets.slotCount(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 ${v['serviceName']} — ${v['startDate']} at ${v['startTime']}`,
        fmtPrice(v['price']),
        has(v, 'slotCount') ? `${v['slotCount']} slot(s)` : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 1440,
  },
  {
    id: 'last_minute_slot',
    category: TagCategory.Beauty,
    label: '⚡ Last-Minute Slot',
    icon: '⚡',
    shortDescription: 'Fill a cancellation or last-minute opening',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What slot just opened up?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Haircut + Styling',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'When',
        required: true,
        placeholder: 'e.g. Today at 4:30 PM',
      },
      presets.price({ required: true }),
      presets.originalPrice(),
      { key: 'slotsLeft', type: 'number', label: 'Slots remaining', placeholder: 'e.g. 1', min: 1 },
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `⚡ Last-minute slot for ${v['serviceName']}`,
        v['dateTime'],
        fmtPriceRange(v['price'], v['originalPrice']),
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 360,
  },
  makeOfferTemplate(TagCategory.Beauty, 40),
  {
    id: 'new_treatment',
    category: TagCategory.Beauty,
    label: '🆕 New Treatment',
    icon: '🆕',
    shortDescription: 'Introduce a new service or treatment',
    version: 1,
    displayOrder: 50,
    intro: 'What new treatment are you introducing?',
    fields: [
      {
        key: 'treatmentName',
        type: 'text',
        label: 'Treatment / service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Keratin hair treatment',
      },
      presets.description({ required: true }),
      presets.price({ label: 'Introductory price' }),
    ],
    buildTitle: (v) => v['treatmentName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 New: ${v['treatmentName']}`,
        fmtPrice(v['price']) ? `Intro price: ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'package',
    category: TagCategory.Beauty,
    label: '🎁 Package',
    icon: '🎁',
    shortDescription: 'Offer a service package or bundle',
    version: 1,
    displayOrder: 55,
    intro: "What's in the package?",
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Glow Up Package',
      },
      presets.price({ required: true }),
      {
        key: 'includes',
        type: 'textarea',
        label: 'Included services',
        required: true,
        placeholder: 'e.g. Facial, cleanup, manicure',
        maxLength: 500,
      },
      {
        key: 'sessions',
        type: 'number',
        label: 'Number of sessions',
        placeholder: 'e.g. 5',
        min: 1,
      },
      { key: 'validity', type: 'text', label: 'Validity', placeholder: 'e.g. 3 months' },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`🎁 ${v['packageName']}`, fmtPrice(v['price']), `Includes: ${v['includes']}`]),
    defaultIntent: 'offer',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'bridal_package',
    category: TagCategory.Beauty,
    label: '👰 Bridal Package',
    icon: '👰',
    shortDescription: 'Bridal and wedding packages',
    version: 1,
    displayOrder: 60,
    intro: 'What bridal package are you offering?',
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Complete Bridal Makeup',
      },
      presets.price({ required: true }),
      {
        key: 'includes',
        type: 'textarea',
        label: 'Includes',
        required: true,
        placeholder: 'e.g. Makeup, hair styling, draping',
        maxLength: 500,
      },
      {
        key: 'leadTime',
        type: 'text',
        label: 'Booking lead time',
        placeholder: 'e.g. Book 2 weeks in advance',
      },
      { key: 'trialIncluded', type: 'toggle', label: 'Trial included', placeholder: 'Yes' },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `👰 ${v['packageName']}`,
        fmtPrice(v['price']),
        `Includes: ${v['includes']}`,
        v['trialIncluded'] === 'true' ? 'Trial included' : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 43200,
  },
  makeEventSubtemplate(TagCategory.Beauty, 65),
  makeJobTemplate(TagCategory.Beauty, 70),
  makeUpdateTemplate(TagCategory.Beauty, 80),
  makeLookingForTemplate(TagCategory.Beauty, 90),
  makeLegacyGeneral(
    TagCategory.Beauty,
    'General beauty & wellness update',
    'What service is available?',
    [
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
      { key: 'note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. Walk-ins welcome' },
    ],
    (v) => joinParts([`💇 ${v['service']} — ${v['availability']}`, v['price'], v['note']]),
    { defaultIntent: 'open_slot', defaultCta: 'book' },
  ),
];

// ━━━ HEALTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const HEALTH_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'consultation_available',
    category: TagCategory.Health,
    label: '🩺 Consultation Available',
    icon: '🩺',
    shortDescription: 'Announce consultation availability',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What consultation is available?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Consultation / service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. General physician consultation',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      {
        key: 'practitioner',
        type: 'text',
        label: 'Practitioner / speciality',
        placeholder: 'e.g. Dr. Sharma, Cardiologist',
      },
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🩺 ${v['serviceName']}`,
        `${v['startDate']} at ${v['startTime']}`,
        has(v, 'practitioner') ? v['practitioner'] : undefined,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 1440,
  },
  {
    id: 'appointment_slot',
    category: TagCategory.Health,
    label: '📅 Appointment Slot',
    icon: '📅',
    shortDescription: 'Open appointment slots',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What appointment slots are open?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Dental checkup',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      presets.slotCount(),
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 ${v['serviceName']} — ${v['startDate']} at ${v['startTime']}`,
        has(v, 'slotCount') ? `${v['slotCount']} slot(s)` : undefined,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 1440,
  },
  {
    id: 'health_service',
    category: TagCategory.Health,
    label: '🏥 Health Service',
    icon: '🏥',
    shortDescription: 'Announce a health or care service',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What health service are you offering?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Physiotherapy at home',
      },
      presets.price({ label: 'Fee' }),
      presets.description({ label: 'Details' }),
      presets.availabilityNote({ label: 'Availability', placeholder: 'e.g. Mon–Sat 9 AM – 5 PM' }),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏥 ${v['serviceName']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  {
    id: 'clinic_update',
    category: TagCategory.Health,
    label: '📢 Clinic Update',
    icon: '📢',
    shortDescription: 'Hours, availability, or facility updates',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: "What's the clinic update?",
    fields: [
      {
        key: 'updateTitle',
        type: 'text',
        label: 'Update title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Dr. Kumar available this Saturday',
      },
      presets.description({ label: 'Details', placeholder: 'e.g. Extended hours, new facility' }),
      {
        key: 'effectiveDate',
        type: 'text',
        label: 'Effective date / time',
        placeholder: 'e.g. From Monday',
      },
    ],
    buildTitle: (v) => v['updateTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📢 ${v['updateTitle']}`,
        has(v, 'description') ? v['description'] : undefined,
        has(v, 'effectiveDate') ? `Effective: ${v['effectiveDate']}` : undefined,
      ]),
    defaultExpiresIn: 4320,
  },
  {
    id: 'diagnostic_test',
    category: TagCategory.Health,
    label: '🔬 Diagnostic Test',
    icon: '🔬',
    shortDescription: 'Announce available tests or screenings',
    version: 1,
    displayOrder: 50,
    intro: 'What test or screening is available?',
    fields: [
      {
        key: 'testName',
        type: 'text',
        label: 'Test / service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Full blood panel',
      },
      presets.price(),
      {
        key: 'prepNote',
        type: 'text',
        label: 'Preparation note',
        placeholder: 'e.g. Fasting required, bring ID',
      },
      presets.availabilityNote({
        label: 'Availability',
        placeholder: 'e.g. Walk-in or appointment',
      }),
    ],
    buildTitle: (v) => v['testName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🔬 ${v['testName']}`,
        fmtPrice(v['price']),
        has(v, 'prepNote') ? `Note: ${v['prepNote']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  {
    id: 'camp',
    category: TagCategory.Health,
    label: '⛺ Health Camp',
    icon: '⛺',
    shortDescription: 'Announce a health camp or screening program',
    version: 1,
    displayOrder: 55,
    intro: 'What program are you organising?',
    fields: [
      {
        key: 'campName',
        type: 'text',
        label: 'Camp / program name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Free eye check-up camp',
      },
      ...eventGroup({ label: 'Date & time', required: true }),
      {
        key: 'eligibility',
        type: 'textarea',
        label: 'Eligibility / details',
        placeholder: 'e.g. Open to all, age 40+',
        maxLength: 500,
      },
      presets.price({ label: 'Fee', placeholder: 'Leave blank if free' }),
      {
        key: 'registration',
        type: 'text',
        label: 'How to register',
        placeholder: 'e.g. Walk-in, call to register',
      },
    ],
    buildTitle: (v) => v['campName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `⛺ ${v['campName']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : 'Free',
        has(v, 'registration') ? v['registration'] : undefined,
      ]),
    defaultIntent: 'happening',
    defaultCta: 'join',
    defaultExpiresIn: 4320,
  },
  {
    id: 'new_service',
    category: TagCategory.Health,
    label: '🆕 New Service',
    icon: '🆕',
    shortDescription: 'Announce a new health service',
    version: 1,
    displayOrder: 60,
    intro: 'What new service are you introducing?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Tele-consultation',
      },
      presets.description({ required: true }),
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 Now available: ${v['serviceName']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  makeJobTemplate(TagCategory.Health, 70),
  makeEventSubtemplate(TagCategory.Health, 75),
  makeLookingForTemplate(TagCategory.Health, 90),
  makeLegacyGeneral(
    TagCategory.Health,
    'General health & care update',
    'What care is available?',
    [
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
      { key: 'note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. Walk-ins welcome' },
    ],
    (v) => joinParts([`🏥 ${v['service']} — ${v['availability']}`, v['price'], v['note']]),
    { defaultIntent: 'open_slot', defaultCta: 'book' },
  ),
];

// ━━━ FITNESS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FITNESS_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'class_session',
    category: TagCategory.Fitness,
    label: '🏋️ Class / Session',
    icon: '🏋️',
    shortDescription: 'Announce an upcoming class or session',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What class or session is happening?',
    fields: [
      {
        key: 'className',
        type: 'text',
        label: 'Class / activity',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Morning Yoga, HIIT workout',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'Date & time',
        required: true,
        placeholder: 'e.g. Tomorrow 6 AM',
      },
      presets.price(),
      {
        key: 'level',
        type: 'select',
        label: 'Level',
        options: ['All levels', 'Beginner', 'Intermediate', 'Advanced'],
      },
    ],
    buildTitle: (v) => v['className']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏋️ ${v['className']} — ${v['dateTime']}`,
        fmtPrice(v['price']),
        has(v, 'level') ? v['level'] : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 1440,
  },
  {
    id: 'slot_available',
    category: TagCategory.Fitness,
    label: '🟢 Slot Available',
    icon: '🟢',
    shortDescription: 'Open slot for a session',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What slot is open?',
    fields: [
      {
        key: 'sessionName',
        type: 'text',
        label: 'Session',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Evening gym slot',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'Date & time',
        required: true,
        placeholder: 'e.g. Today 5 PM',
      },
      {
        key: 'slotsLeft',
        type: 'number',
        label: 'Slots remaining',
        required: true,
        placeholder: 'e.g. 3',
        min: 1,
      },
      presets.price(),
    ],
    buildTitle: (v) => v['sessionName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🟢 ${v['sessionName']} — ${v['dateTime']}`,
        `${v['slotsLeft']} slot(s) left`,
        fmtPrice(v['price']),
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 720,
  },
  {
    id: 'membership_offer',
    category: TagCategory.Fitness,
    label: '🏷 Membership Offer',
    icon: '🏷',
    shortDescription: 'Promote a membership or subscription deal',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What membership offer do you have?',
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package / offer',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 3-month gym membership',
      },
      presets.price({ required: true }),
      presets.originalPrice(),
      {
        key: 'duration',
        type: 'text',
        label: 'Duration',
        required: true,
        placeholder: 'e.g. 3 months',
      },
      presets.validUntil(),
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏷 ${v['packageName']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        v['duration'],
        has(v, 'validUntil') ? `Valid until ${v['validUntil']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'batch_starting',
    category: TagCategory.Fitness,
    label: '📅 Batch Starting',
    icon: '📅',
    shortDescription: 'Announce a new batch or cohort',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'What batch is starting?',
    fields: [
      {
        key: 'activity',
        type: 'text',
        label: 'Activity / batch',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Swimming beginners batch',
      },
      { key: 'startDate', type: 'date', label: 'Start date', required: true },
      {
        key: 'schedule',
        type: 'text',
        label: 'Schedule',
        required: true,
        placeholder: 'e.g. Mon/Wed/Fri 6–7 AM',
      },
      {
        key: 'seatsLeft',
        type: 'number',
        label: 'Seats available',
        placeholder: 'e.g. 10',
        min: 1,
      },
      presets.price(),
    ],
    buildTitle: (v) => v['activity']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 ${v['activity']} starting ${v['startDate']}`,
        `Schedule: ${v['schedule']}`,
        fmtPrice(v['price']),
        has(v, 'seatsLeft') ? `${v['seatsLeft']} seat(s) left` : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'new_program',
    category: TagCategory.Fitness,
    label: '🆕 New Program',
    icon: '🆕',
    shortDescription: 'Launch a new fitness program',
    version: 1,
    displayOrder: 50,
    intro: 'What new program are you launching?',
    fields: [
      {
        key: 'programName',
        type: 'text',
        label: 'Program name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 6-week transformation challenge',
      },
      presets.description({ required: true }),
      { key: 'startDate', type: 'date', label: 'Start date' },
      { key: 'duration', type: 'text', label: 'Duration', placeholder: 'e.g. 6 weeks' },
      presets.price(),
    ],
    buildTitle: (v) => v['programName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 ${v['programName']}`,
        has(v, 'duration') ? v['duration'] : undefined,
        fmtPrice(v['price']),
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'personal_training',
    category: TagCategory.Fitness,
    label: '🏃 Personal Training',
    icon: '🏃',
    shortDescription: 'Offer personal training sessions',
    version: 1,
    displayOrder: 55,
    intro: 'What training do you offer?',
    fields: [
      {
        key: 'trainingType',
        type: 'text',
        label: 'Training type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Strength training, CrossFit',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'Available date/time',
        placeholder: 'e.g. Weekday mornings',
      },
      presets.price({ label: 'Price / session' }),
      {
        key: 'level',
        type: 'select',
        label: 'Experience level',
        options: ['All levels', 'Beginner', 'Intermediate', 'Advanced'],
      },
    ],
    buildTitle: (v) => v['trainingType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏃 Personal training: ${v['trainingType']}`,
        has(v, 'dateTime') ? v['dateTime'] : undefined,
        fmtPrice(v['price']) ? `${fmtPrice(v['price'])}/session` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'event_tournament',
    category: TagCategory.Fitness,
    label: '🏆 Event / Tournament',
    icon: '🏆',
    shortDescription: 'Announce a sports event or tournament',
    version: 1,
    displayOrder: 60,
    intro: 'What event or tournament is happening?',
    fields: [
      {
        key: 'eventName',
        type: 'text',
        label: 'Event name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 5K Fun Run',
      },
      ...eventGroup({ required: true }),
      presets.description(),
      presets.price({ label: 'Entry fee', placeholder: 'Leave blank if free' }),
    ],
    buildTitle: (v) => v['eventName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏆 ${v['eventName']}`,
        fmtPrice(v['price']) ? `Entry: ${fmtPrice(v['price'])}` : 'Free entry',
      ]),
    defaultIntent: 'happening',
    defaultCta: 'join',
    defaultExpiresIn: 4320,
  },
  {
    id: 'session_today',
    category: TagCategory.Fitness,
    label: '⚡ Session Today',
    icon: '⚡',
    shortDescription: 'Quick short-lived session post',
    version: 1,
    displayOrder: 65,
    intro: "What's happening today?",
    fields: [
      {
        key: 'sessionName',
        type: 'text',
        label: 'Session',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Open gym, group run',
      },
      { key: 'time', type: 'time', label: 'Time', required: true },
      presets.price(),
    ],
    buildTitle: (v) => v['sessionName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`⚡ Today: ${v['sessionName']} at ${v['time']}`, fmtPrice(v['price'])]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 360,
  },
  makeJobTemplate(TagCategory.Fitness, 70),
  makeUpdateTemplate(TagCategory.Fitness, 80),
  makeLookingForTemplate(TagCategory.Fitness, 90),
  makeLegacyGeneral(
    TagCategory.Fitness,
    'General fitness update',
    "What's the session?",
    [
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
    (v) =>
      joinParts([
        `💪 ${v['activity']} — ${v['time']}`,
        has(v, 'spots') ? `${v['spots']} spot(s) left` : undefined,
      ]),
    { defaultIntent: 'open_slot', defaultCta: 'book' },
  ),
];

// ━━━ LEARN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LEARN_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'course',
    category: TagCategory.Learn,
    label: '📚 Course / Class',
    icon: '📚',
    shortDescription: 'Announce a course or ongoing class',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What course or class are you offering?',
    fields: [
      {
        key: 'courseName',
        type: 'text',
        label: 'Course / class name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Spoken English, NEET coaching',
      },
      {
        key: 'subject',
        type: 'text',
        label: 'Subject / topic',
        required: true,
        placeholder: 'e.g. Mathematics, Guitar',
      },
      {
        key: 'level',
        type: 'text',
        label: 'Level / age / class',
        placeholder: 'e.g. Class 10, Beginners',
      },
      presets.price({ label: 'Fee' }),
      {
        key: 'schedule',
        type: 'text',
        label: 'Schedule',
        required: true,
        placeholder: 'e.g. Mon–Fri 4–5 PM',
      },
    ],
    buildTitle: (v) => v['courseName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📚 ${v['courseName']}`,
        v['subject'],
        has(v, 'level') ? v['level'] : undefined,
        fmtPrice(v['price']),
        `Schedule: ${v['schedule']}`,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'new_batch',
    category: TagCategory.Learn,
    label: '📅 New Batch',
    icon: '📅',
    shortDescription: 'Announce a new batch starting',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What batch is starting?',
    fields: [
      {
        key: 'subject',
        type: 'text',
        label: 'Subject / course',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Python Programming',
      },
      {
        key: 'batchName',
        type: 'text',
        label: 'Batch name',
        placeholder: 'e.g. Batch 5, Weekend batch',
      },
      { key: 'startDate', type: 'date', label: 'Start date', required: true },
      {
        key: 'schedule',
        type: 'text',
        label: 'Schedule',
        required: true,
        placeholder: 'e.g. Sat/Sun 10 AM–12 PM',
      },
      {
        key: 'seatsLeft',
        type: 'number',
        label: 'Seats available',
        placeholder: 'e.g. 15',
        min: 1,
      },
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['subject']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 New batch: ${v['subject']}`,
        `Starting ${v['startDate']}`,
        `Schedule: ${v['schedule']}`,
        has(v, 'seatsLeft') ? `${v['seatsLeft']} seat(s) left` : undefined,
        fmtPrice(v['price']),
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'demo_class',
    category: TagCategory.Learn,
    label: '🎓 Demo Class',
    icon: '🎓',
    shortDescription: 'Invite students to a trial or demo class',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What demo class are you offering?',
    fields: [
      {
        key: 'subject',
        type: 'text',
        label: 'Subject / course',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Carnatic music',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      presets.price({ label: 'Fee', placeholder: 'Leave blank if free' }),
      {
        key: 'regNote',
        type: 'text',
        label: 'Registration note',
        placeholder: 'e.g. Call to register, limited seats',
      },
    ],
    buildTitle: (v) => v['subject']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎓 Demo class: ${v['subject']}`,
        `${v['startDate']} at ${v['startTime']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : 'Free',
        has(v, 'regNote') ? v['regNote'] : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'interested',
    defaultExpiresIn: 4320,
  },
  {
    id: 'seat_available',
    category: TagCategory.Learn,
    label: '🪑 Seat Available',
    icon: '🪑',
    shortDescription: 'Announce available seats in a course',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'Which course has seats available?',
    fields: [
      {
        key: 'courseName',
        type: 'text',
        label: 'Course / batch',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. IELTS Preparation batch 3',
      },
      {
        key: 'seatsLeft',
        type: 'number',
        label: 'Seats remaining',
        required: true,
        placeholder: 'e.g. 5',
        min: 1,
      },
      { key: 'startDate', type: 'date', label: 'Start date / time' },
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['courseName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🪑 ${v['seatsLeft']} seat(s) left in ${v['courseName']}`,
        has(v, 'startDate') ? `Starts ${v['startDate']}` : undefined,
        fmtPrice(v['price']),
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'message',
    defaultExpiresIn: 4320,
  },
  {
    id: 'course_offer',
    category: TagCategory.Learn,
    label: '🏷 Course Offer',
    icon: '🏷',
    shortDescription: 'Discounted course or early-bird offer',
    version: 1,
    displayOrder: 50,
    intro: 'What course offer do you have?',
    fields: [
      {
        key: 'courseName',
        type: 'text',
        label: 'Course',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Full-stack web dev bootcamp',
      },
      ...priceGroup({ label: 'Offer price', required: true }, { required: true }),
      presets.validUntil(),
      presets.description({ label: 'Offer details' }),
    ],
    buildTitle: (v) => v['courseName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏷 ${v['courseName']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'validUntil') ? `Valid until ${v['validUntil']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'tutor_available',
    category: TagCategory.Learn,
    label: '👨‍🏫 Tutor Available',
    icon: '👨‍🏫',
    shortDescription: 'Announce tutor availability',
    version: 1,
    displayOrder: 55,
    intro: 'What subject can you teach?',
    fields: [
      {
        key: 'subject',
        type: 'text',
        label: 'Subject',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Physics, French',
      },
      {
        key: 'level',
        type: 'text',
        label: 'Level / class',
        placeholder: 'e.g. Class 8–10, College',
      },
      { key: 'mode', type: 'select', label: 'Mode', options: ['Online', 'Offline', 'Both'] },
      {
        key: 'schedule',
        type: 'text',
        label: 'Available schedule',
        placeholder: 'e.g. Evenings, weekends',
      },
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['subject']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `👨‍🏫 Tutor available: ${v['subject']}`,
        has(v, 'level') ? v['level'] : undefined,
        has(v, 'mode') ? v['mode'] : undefined,
        fmtPrice(v['price']),
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'admissions_open',
    category: TagCategory.Learn,
    label: '📝 Admissions Open',
    icon: '📝',
    shortDescription: 'Announce open admissions',
    version: 1,
    displayOrder: 60,
    intro: 'What admissions are open?',
    fields: [
      {
        key: 'programName',
        type: 'text',
        label: 'Program / course',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. B.Sc. Computer Science',
      },
      {
        key: 'deadline',
        type: 'text',
        label: 'Admission deadline',
        required: true,
        placeholder: 'e.g. Aug 30',
      },
      { key: 'startDate', type: 'date', label: 'Start date' },
      {
        key: 'eligibility',
        type: 'textarea',
        label: 'Eligibility / details',
        placeholder: 'e.g. 12th pass, entrance required',
        maxLength: 500,
      },
      presets.price({ label: 'Fee' }),
    ],
    buildTitle: (v) => v['programName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📝 Admissions open: ${v['programName']}`,
        `Deadline: ${v['deadline']}`,
        fmtPrice(v['price']),
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'workshop',
    category: TagCategory.Learn,
    label: '🎯 Workshop',
    icon: '🎯',
    shortDescription: 'Announce a workshop or masterclass',
    version: 1,
    displayOrder: 65,
    intro: 'What workshop are you hosting?',
    fields: [
      {
        key: 'workshopName',
        type: 'text',
        label: 'Workshop name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. UI/UX Design Workshop',
      },
      ...eventGroup({ required: true }),
      presets.description(),
      presets.price({ label: 'Fee', placeholder: 'Leave blank if free' }),
    ],
    buildTitle: (v) => v['workshopName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎯 Workshop: ${v['workshopName']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : 'Free',
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'happening',
    defaultCta: 'join',
    defaultExpiresIn: 4320,
  },
  makeJobTemplate(TagCategory.Learn, 70),
  makeUpdateTemplate(TagCategory.Learn, 80),
  makeLookingForTemplate(TagCategory.Learn, 90),
  makeLegacyGeneral(
    TagCategory.Learn,
    'General education update',
    "What's being taught?",
    [
      {
        key: 'skill',
        label: 'Subject / skill',
        type: 'text',
        required: true,
        placeholder: 'e.g. Guitar basics',
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
    (v) => joinParts([`📚 ${v['skill']} — ${v['sessionType']}`, v['when'], v['fee']]),
    { defaultIntent: 'available_now', defaultCta: 'message' },
  ),
];

// ━━━ AUTO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AUTO_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'vehicle_service',
    category: TagCategory.Auto,
    label: '🔧 Vehicle Service',
    icon: '🔧',
    shortDescription: 'Offer a vehicle service',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What service do you offer?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Full car service',
      },
      {
        key: 'vehicleType',
        type: 'select',
        label: 'Vehicle type',
        required: true,
        options: ['Car', 'Bike', 'Scooter', 'Auto', 'Truck', 'Any vehicle'],
      },
      presets.price({ label: 'Starting price' }),
      presets.description(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🔧 ${v['serviceName']} — ${v['vehicleType']}`,
        fmtPrice(v['price']) ? `From ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  {
    id: 'wash_detailing',
    category: TagCategory.Auto,
    label: '🚿 Wash & Detailing',
    icon: '🚿',
    shortDescription: 'Offer vehicle wash or detailing',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What wash or detailing service?',
    fields: [
      {
        key: 'vehicleType',
        type: 'select',
        label: 'Vehicle type',
        required: true,
        options: ['Car', 'Bike', 'Scooter', 'Any vehicle'],
      },
      {
        key: 'packageName',
        type: 'text',
        label: 'Package / service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Premium exterior wash',
      },
      presets.price({ required: true }),
      { key: 'duration', type: 'text', label: 'Duration', placeholder: 'e.g. 45 min' },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🚿 ${v['packageName']} — ${v['vehicleType']}`,
        fmtPrice(v['price']),
        has(v, 'duration') ? v['duration'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 4320,
  },
  makeOfferTemplate(TagCategory.Auto, 30),
  {
    id: 'service_slot',
    category: TagCategory.Auto,
    label: '📅 Service Slot',
    icon: '📅',
    shortDescription: 'Open service appointment slot',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'What service slot is open?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Oil change',
      },
      {
        key: 'vehicleType',
        type: 'select',
        label: 'Vehicle type',
        options: ['Car', 'Bike', 'Scooter', 'Any vehicle'],
      },
      ...appointmentGroup({ required: true }, { required: true }),
      presets.slotCount(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 ${v['serviceName']} — ${v['startDate']} at ${v['startTime']}`,
        has(v, 'vehicleType') ? v['vehicleType'] : undefined,
        has(v, 'slotCount') ? `${v['slotCount']} slot(s)` : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 1440,
  },
  {
    id: 'available_now',
    category: TagCategory.Auto,
    label: '🟢 Available Now',
    icon: '🟢',
    shortDescription: 'Immediate availability for service',
    version: 1,
    displayOrder: 50,
    intro: "What's available right now?",
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Puncture repair, quick wash',
      },
      { key: 'availableUntil', type: 'text', label: 'Available until', placeholder: 'e.g. 7 PM' },
      presets.price(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🟢 Available now: ${v['serviceName']}`,
        fmtPrice(v['price']),
        has(v, 'availableUntil') ? `Until ${v['availableUntil']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 360,
  },
  {
    id: 'repair',
    category: TagCategory.Auto,
    label: '🔩 Repair',
    icon: '🔩',
    shortDescription: 'Offer vehicle repair services',
    version: 1,
    displayOrder: 55,
    intro: 'What repair service do you offer?',
    fields: [
      {
        key: 'repairType',
        type: 'text',
        label: 'Repair / service type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Brake pad replacement',
      },
      {
        key: 'vehicleType',
        type: 'select',
        label: 'Vehicle type',
        required: true,
        options: ['Car', 'Bike', 'Scooter', 'Auto', 'Any vehicle'],
      },
      presets.price({ label: 'Starting price' }),
      presets.description(),
    ],
    buildTitle: (v) => v['repairType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🔩 ${v['repairType']} — ${v['vehicleType']}`,
        fmtPrice(v['price']) ? `From ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  {
    id: 'product_accessory',
    category: TagCategory.Auto,
    label: '🛒 Product / Accessory',
    icon: '🛒',
    shortDescription: 'Sell auto parts or accessories',
    version: 1,
    displayOrder: 60,
    intro: 'What product or accessory are you selling?',
    fields: [
      {
        key: 'productName',
        type: 'text',
        label: 'Product / accessory',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Alloy wheels, seat covers',
      },
      {
        key: 'compatible',
        type: 'text',
        label: 'Compatible vehicle / model',
        placeholder: 'e.g. Maruti Swift, Universal',
      },
      presets.price({ required: true }),
      { key: 'stockNote', type: 'text', label: 'Stock', placeholder: 'e.g. 5 in stock' },
      presets.productLink(),
    ],
    buildTitle: (v) => v['productName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🛒 ${v['productName']}`,
        fmtPrice(v['price']),
        has(v, 'compatible') ? `For: ${v['compatible']}` : undefined,
        has(v, 'stockNote') ? v['stockNote'] : undefined,
      ]),
    defaultIntent: 'sell_give',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'new_service',
    category: TagCategory.Auto,
    label: '🆕 New Service',
    icon: '🆕',
    shortDescription: 'Announce a new auto service',
    version: 1,
    displayOrder: 65,
    intro: 'What new service are you offering?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. EV charging station',
      },
      presets.description({ required: true }),
      presets.price(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 New: ${v['serviceName']}`,
        fmtPrice(v['price']),
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  makeJobTemplate(TagCategory.Auto, 70),
  makeUpdateTemplate(TagCategory.Auto, 80),
  makeLookingForTemplate(TagCategory.Auto, 90),
  makeLegacyGeneral(
    TagCategory.Auto,
    'General automotive update',
    'What service is available?',
    [
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
      { key: 'note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. Doorstep service' },
    ],
    (v) => joinParts([`🚗 ${v['service']} — ${v['availability']}`, v['price'], v['note']]),
    { defaultIntent: 'available_now', defaultCta: 'call' },
  ),
];

// ━━━ SPACE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SPACE_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'space_available',
    category: TagCategory.Space,
    label: '🏠 Space Available',
    icon: '🏠',
    shortDescription: 'List an available space or property',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What space is available?',
    fields: [
      {
        key: 'spaceName',
        type: 'text',
        label: 'Space / type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 2BHK apartment, office space',
      },
      presets.price({ label: 'Rent / price', required: true }),
      {
        key: 'availableFrom',
        type: 'text',
        label: 'Available from',
        required: true,
        placeholder: 'e.g. Immediately, Sep 1',
      },
      {
        key: 'locality',
        type: 'text',
        label: 'Area / locality',
        required: true,
        placeholder: 'e.g. Koramangala 4th Block',
      },
      presets.description(),
      { key: 'size', type: 'text', label: 'Size', placeholder: 'e.g. 1200 sq ft' },
      {
        key: 'furnished',
        type: 'select',
        label: 'Furnished',
        options: ['Unfurnished', 'Semi-furnished', 'Fully furnished'],
      },
      { key: 'deposit', type: 'text', label: 'Deposit', placeholder: 'e.g. 2 months rent' },
    ],
    buildTitle: (v) => v['spaceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏠 ${v['spaceName']}`,
        fmtPrice(v['price']),
        v['locality'],
        has(v, 'availableFrom') ? `Available from ${v['availableFrom']}` : undefined,
        has(v, 'furnished') ? v['furnished'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 43200,
  },
  {
    id: 'property_for_rent',
    category: TagCategory.Space,
    label: '🏘️ Property for Rent',
    icon: '🏘️',
    shortDescription: 'List a rental property',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What property is for rent?',
    fields: [
      {
        key: 'propertyType',
        type: 'select',
        label: 'Property type',
        required: true,
        options: ['1 BHK', '2 BHK', '3 BHK', 'Studio', 'Villa', 'Independent house', 'Duplex'],
      },
      presets.price({ label: 'Monthly rent', required: true }),
      {
        key: 'locality',
        type: 'text',
        label: 'Location / locality',
        required: true,
        placeholder: 'e.g. Indiranagar',
      },
      {
        key: 'availableFrom',
        type: 'text',
        label: 'Available from',
        required: true,
        placeholder: 'e.g. Sep 1',
      },
      { key: 'bedrooms', type: 'text', label: 'Bedrooms', placeholder: 'e.g. 2' },
      {
        key: 'furnished',
        type: 'select',
        label: 'Furnished status',
        options: ['Unfurnished', 'Semi-furnished', 'Fully furnished'],
      },
      { key: 'deposit', type: 'text', label: 'Deposit', placeholder: 'e.g. 3 months' },
    ],
    buildTitle: (v) => `${v['propertyType']} for Rent`,
    buildHighlight: (v) =>
      joinParts([
        `🏘️ ${v['propertyType']} for rent in ${v['locality']}`,
        fmtPrice(v['price']) ? `${fmtPrice(v['price'])}/month` : undefined,
        has(v, 'availableFrom') ? `From ${v['availableFrom']}` : undefined,
        has(v, 'furnished') ? v['furnished'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 43200,
  },
  {
    id: 'room_pg',
    category: TagCategory.Space,
    label: '🛏️ Room / PG',
    icon: '🛏️',
    shortDescription: 'List a room or PG accommodation',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What room or PG is available?',
    fields: [
      {
        key: 'roomType',
        type: 'text',
        label: 'Room / PG type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Single sharing PG, private room',
      },
      presets.price({ label: 'Rent', required: true }),
      {
        key: 'locality',
        type: 'text',
        label: 'Location',
        required: true,
        placeholder: 'e.g. BTM Layout',
      },
      {
        key: 'availableFrom',
        type: 'text',
        label: 'Available from',
        required: true,
        placeholder: 'e.g. Immediately',
      },
      {
        key: 'amenities',
        type: 'text',
        label: 'Amenities',
        placeholder: 'e.g. WiFi, food, laundry',
      },
    ],
    buildTitle: (v) => v['roomType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🛏️ ${v['roomType']} in ${v['locality']}`,
        fmtPrice(v['price']) ? `${fmtPrice(v['price'])}/month` : undefined,
        has(v, 'availableFrom') ? `From ${v['availableFrom']}` : undefined,
        has(v, 'amenities') ? `Amenities: ${v['amenities']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 43200,
  },
  {
    id: 'viewing_available',
    category: TagCategory.Space,
    label: '👀 Viewing Available',
    icon: '👀',
    shortDescription: 'Schedule a property viewing',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'When can people come see the property?',
    fields: [
      {
        key: 'propertyName',
        type: 'text',
        label: 'Property / space',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 2BHK Koramangala',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      {
        key: 'meetingNote',
        type: 'text',
        label: 'Meeting note',
        placeholder: 'e.g. Call before visiting',
      },
    ],
    buildTitle: (v) => v['propertyName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `👀 Viewing: ${v['propertyName']}`,
        `${v['startDate']} at ${v['startTime']}`,
        has(v, 'meetingNote') ? v['meetingNote'] : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 4320,
  },
  {
    id: 'commercial_space',
    category: TagCategory.Space,
    label: '🏢 Commercial Space',
    icon: '🏢',
    shortDescription: 'List commercial / business space',
    version: 1,
    displayOrder: 50,
    intro: 'What commercial space is available?',
    fields: [
      {
        key: 'spaceType',
        type: 'text',
        label: 'Space type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Shop, warehouse, office',
      },
      presets.price({ label: 'Rent', required: true }),
      { key: 'size', type: 'text', label: 'Area / size', placeholder: 'e.g. 500 sq ft' },
      {
        key: 'locality',
        type: 'text',
        label: 'Location',
        required: true,
        placeholder: 'e.g. MG Road',
      },
      { key: 'availableFrom', type: 'text', label: 'Available from', placeholder: 'e.g. Oct 1' },
      {
        key: 'suitableFor',
        type: 'text',
        label: 'Suitable for',
        placeholder: 'e.g. Retail, food outlet',
      },
    ],
    buildTitle: (v) => v['spaceType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏢 ${v['spaceType']} in ${v['locality']}`,
        fmtPrice(v['price']) ? `${fmtPrice(v['price'])}/month` : undefined,
        has(v, 'size') ? v['size'] : undefined,
        has(v, 'suitableFor') ? `Suitable for: ${v['suitableFor']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 43200,
  },
  {
    id: 'venue_hall',
    category: TagCategory.Space,
    label: '🏛️ Venue / Hall',
    icon: '🏛️',
    shortDescription: 'List a venue or hall for booking',
    version: 1,
    displayOrder: 55,
    intro: 'What venue is available?',
    fields: [
      {
        key: 'venueName',
        type: 'text',
        label: 'Venue name / type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Party hall, conference room',
      },
      { key: 'capacity', type: 'text', label: 'Capacity', placeholder: 'e.g. 100 guests' },
      presets.price({ required: true }),
      {
        key: 'dateTime',
        type: 'text',
        label: 'Available date / time',
        placeholder: 'e.g. Weekends, Sep onwards',
      },
      {
        key: 'facilities',
        type: 'text',
        label: 'Facilities',
        placeholder: 'e.g. AC, parking, catering',
      },
    ],
    buildTitle: (v) => v['venueName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏛️ ${v['venueName']}`,
        fmtPrice(v['price']),
        has(v, 'capacity') ? `Capacity: ${v['capacity']}` : undefined,
        has(v, 'facilities') ? v['facilities'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 20160,
  },
  {
    id: 'coworking',
    category: TagCategory.Space,
    label: '💻 Coworking',
    icon: '💻',
    shortDescription: 'List coworking or desk space',
    version: 1,
    displayOrder: 60,
    intro: 'What coworking space is available?',
    fields: [
      {
        key: 'deskType',
        type: 'text',
        label: 'Desk / office type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Hot desk, private cabin',
      },
      presets.price({ required: true }),
      {
        key: 'duration',
        type: 'select',
        label: 'Duration',
        required: true,
        options: ['Per day', 'Per week', 'Per month'],
      },
      {
        key: 'availability',
        type: 'text',
        label: 'Availability',
        placeholder: 'e.g. Immediate, 5 desks left',
      },
      { key: 'amenities', type: 'text', label: 'Amenities', placeholder: 'e.g. WiFi, AC, coffee' },
    ],
    buildTitle: (v) => v['deskType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `💻 ${v['deskType']}`,
        fmtPrice(v['price'])
          ? `${fmtPrice(v['price'])} ${v['duration']?.toLowerCase() || ''}`.trim()
          : undefined,
        has(v, 'amenities') ? v['amenities'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'rent_offer',
    category: TagCategory.Space,
    label: '🏷 Rent Offer',
    icon: '🏷',
    shortDescription: 'Promotional rent or deposit waiver',
    version: 1,
    displayOrder: 65,
    intro: 'What rent offer are you running?',
    fields: [
      {
        key: 'offerTitle',
        type: 'text',
        label: 'Offer title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. First month free, deposit waiver',
      },
      ...priceGroup({ label: 'Offer rent' }, {}),
      presets.validUntil(),
      presets.description({ label: 'Offer details' }),
    ],
    buildTitle: (v) => v['offerTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏷 ${v['offerTitle']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'validUntil') ? `Valid until ${v['validUntil']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  makeUpdateTemplate(TagCategory.Space, 80),
  makeLookingForTemplate(TagCategory.Space, 90),
  makeLegacyGeneral(
    TagCategory.Space,
    'General property update',
    "What's available?",
    [
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
        label: 'Location (optional)',
        type: 'text',
        placeholder: 'e.g. Koramangala',
      },
    ],
    (v) =>
      joinParts([
        `🏠 ${v['spaceType']} — ${v['availability']}`,
        v['price'],
        has(v, 'location') ? v['location'] : undefined,
      ]),
    { defaultIntent: 'available_now', defaultCta: 'message' },
  ),
];

// ━━━ TRAVEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TRAVEL_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'room_available',
    category: TagCategory.Travel,
    label: '🏨 Room Available',
    icon: '🏨',
    shortDescription: 'List available rooms or stays',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What room or stay is available?',
    fields: [
      {
        key: 'roomType',
        type: 'text',
        label: 'Room / stay type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Deluxe double room',
      },
      presets.price({ label: 'Price / night', required: true }),
      { key: 'checkIn', type: 'date', label: 'Check-in date', required: true },
      { key: 'checkOut', type: 'date', label: 'Check-out date' },
      {
        key: 'roomsAvailable',
        type: 'number',
        label: 'Rooms available',
        placeholder: 'e.g. 3',
        min: 1,
      },
      {
        key: 'guestCapacity',
        type: 'text',
        label: 'Guest capacity',
        placeholder: 'e.g. 2 adults + 1 child',
      },
    ],
    buildTitle: (v) => v['roomType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏨 ${v['roomType']}`,
        fmtPrice(v['price']) ? `${fmtPrice(v['price'])}/night` : undefined,
        `Check-in: ${v['checkIn']}`,
        has(v, 'roomsAvailable') ? `${v['roomsAvailable']} room(s)` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 20160,
  },
  {
    id: 'stay_offer',
    category: TagCategory.Travel,
    label: '🏷 Stay Offer',
    icon: '🏷',
    shortDescription: 'Promotional stay or package deal',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What stay offer do you have?',
    fields: [
      {
        key: 'offerName',
        type: 'text',
        label: 'Offer / package',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Weekend getaway deal',
      },
      ...priceGroup({ required: true }),
      presets.validUntil({ label: 'Valid dates', placeholder: 'e.g. Aug 15–31' }),
      {
        key: 'includes',
        type: 'textarea',
        label: "What's included",
        placeholder: 'e.g. Breakfast, pool access',
        maxLength: 500,
      },
    ],
    buildTitle: (v) => v['offerName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏷 ${v['offerName']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'validUntil') ? `Valid: ${v['validUntil']}` : undefined,
        has(v, 'includes') ? `Includes: ${v['includes']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'availability',
    category: TagCategory.Travel,
    label: '🟢 Availability',
    icon: '🟢',
    shortDescription: 'Announce general availability',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: "What's available?",
    fields: [
      {
        key: 'itemName',
        type: 'text',
        label: 'What is available?',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Houseboat for 4, campsite spots',
      },
      {
        key: 'dateRange',
        type: 'text',
        label: 'Date / date range',
        required: true,
        placeholder: 'e.g. Sep 1–15',
      },
      presets.price(),
      {
        key: 'quantity',
        type: 'text',
        label: 'Quantity / rooms / seats',
        placeholder: 'e.g. 2 boats, 5 tents',
      },
    ],
    buildTitle: (v) => v['itemName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🟢 Available: ${v['itemName']}`,
        v['dateRange'],
        fmtPrice(v['price']),
        has(v, 'quantity') ? v['quantity'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'travel_package',
    category: TagCategory.Travel,
    label: '🗺️ Travel Package',
    icon: '🗺️',
    shortDescription: 'Offer a travel or tour package',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'What travel package are you offering?',
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 3-night Goa beach package',
      },
      {
        key: 'destination',
        type: 'text',
        label: 'Destination',
        required: true,
        placeholder: 'e.g. Goa, Munnar',
      },
      {
        key: 'duration',
        type: 'text',
        label: 'Duration',
        required: true,
        placeholder: 'e.g. 3 nights / 4 days',
      },
      presets.price({ required: true }),
      { key: 'travelDates', type: 'text', label: 'Travel dates', placeholder: 'e.g. Sep 1–4' },
      {
        key: 'includes',
        type: 'textarea',
        label: 'Includes',
        placeholder: 'e.g. Stay, meals, sightseeing',
        maxLength: 500,
      },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`🗺️ ${v['packageName']}`, v['destination'], v['duration'], fmtPrice(v['price'])]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'tour_experience',
    category: TagCategory.Travel,
    label: '🎒 Tour / Experience',
    icon: '🎒',
    shortDescription: 'Offer a tour or local experience',
    version: 1,
    displayOrder: 50,
    intro: 'What tour or experience are you offering?',
    fields: [
      {
        key: 'tourName',
        type: 'text',
        label: 'Tour / experience',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Heritage walking tour',
      },
      {
        key: 'location',
        type: 'text',
        label: 'Location',
        required: true,
        placeholder: 'e.g. Old Bangalore',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'Date & time',
        required: true,
        placeholder: 'e.g. Sat 8 AM',
      },
      presets.price({ required: true }),
      { key: 'duration', type: 'text', label: 'Duration', placeholder: 'e.g. 3 hours' },
    ],
    buildTitle: (v) => v['tourName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎒 ${v['tourName']}`,
        v['location'],
        v['dateTime'],
        fmtPrice(v['price']),
        has(v, 'duration') ? v['duration'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 4320,
  },
  {
    id: 'transport_service',
    category: TagCategory.Travel,
    label: '🚐 Transport Service',
    icon: '🚐',
    shortDescription: 'Offer transport or cab service',
    version: 1,
    displayOrder: 55,
    intro: 'What transport service is available?',
    fields: [
      {
        key: 'serviceType',
        type: 'text',
        label: 'Transport / service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Airport cab, tempo traveller',
      },
      {
        key: 'route',
        type: 'text',
        label: 'Route / service area',
        required: true,
        placeholder: 'e.g. Bangalore ↔ Mysore',
      },
      presets.price(),
      {
        key: 'availability',
        type: 'text',
        label: 'Availability',
        placeholder: 'e.g. Daily, weekends only',
      },
    ],
    buildTitle: (v) => v['serviceType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🚐 ${v['serviceType']}`,
        v['route'],
        fmtPrice(v['price']),
        has(v, 'availability') ? v['availability'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'call',
    defaultExpiresIn: 10080,
  },
  {
    id: 'new_package',
    category: TagCategory.Travel,
    label: '🆕 New Package',
    icon: '🆕',
    shortDescription: 'Launch a new travel package',
    version: 1,
    displayOrder: 60,
    intro: 'What new package are you launching?',
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Monsoon Coorg retreat',
      },
      presets.description({ required: true }),
      presets.price({ required: true }),
      { key: 'availableFrom', type: 'text', label: 'Available from', placeholder: 'e.g. Sep 1' },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 New package: ${v['packageName']}`,
        fmtPrice(v['price']),
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  makeEventSubtemplate(TagCategory.Travel, 65),
  makeJobTemplate(TagCategory.Travel, 70),
  makeUpdateTemplate(TagCategory.Travel, 80),
  makeLookingForTemplate(TagCategory.Travel, 90),
  makeLegacyGeneral(
    TagCategory.Travel,
    'General travel update',
    "What's available?",
    [
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
        placeholder: 'e.g. 2-night Coorg package',
      },
      { key: 'price', label: 'Price (optional)', type: 'text', placeholder: 'e.g. ₹4500/night' },
      {
        key: 'validUntil',
        label: 'Valid until (optional)',
        type: 'text',
        placeholder: 'e.g. This weekend',
      },
    ],
    (v) =>
      joinParts([
        `✈️ ${v['serviceType']} — ${v['details']}`,
        v['price'],
        has(v, 'validUntil') ? `Valid: ${v['validUntil']}` : undefined,
      ]),
    { defaultIntent: 'offer', defaultCta: 'message' },
  ),
];

// ━━━ EVENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EVENT_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'business_event',
    category: TagCategory.Event,
    label: '🎉 Event',
    icon: '🎉',
    shortDescription: 'Announce your event',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'Tell people about your event',
    fields: [
      {
        key: 'eventName',
        type: 'text',
        label: 'Event name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Open Mic Night',
      },
      ...eventGroup({ required: true }),
      {
        key: 'venue',
        type: 'text',
        label: 'Venue / location',
        required: true,
        placeholder: 'e.g. Town Hall, MG Road',
      },
      presets.description(),
      presets.price({ label: 'Entry price', placeholder: 'Leave blank if free' }),
    ],
    buildTitle: (v) => v['eventName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎉 ${v['eventName']}`,
        `at ${v['venue']}`,
        fmtPrice(v['price']) ? `Entry: ${fmtPrice(v['price'])}` : 'Free entry',
      ]),
    defaultIntent: 'happening',
    defaultCta: 'join',
    defaultExpiresIn: 4320,
  },
  {
    id: 'tickets_registration',
    category: TagCategory.Event,
    label: '🎟️ Tickets / Registration',
    icon: '🎟️',
    shortDescription: 'Sell tickets or open registration',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What tickets are available?',
    fields: [
      {
        key: 'eventName',
        type: 'text',
        label: 'Event',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Comedy Night',
      },
      presets.price({ label: 'Ticket / registration price', required: true }),
      { key: 'deadline', type: 'text', label: 'Registration deadline', placeholder: 'e.g. Aug 20' },
      {
        key: 'seatsLeft',
        type: 'number',
        label: 'Tickets / seats remaining',
        placeholder: 'e.g. 50',
        min: 1,
      },
      presets.productLink({ label: 'Registration link' }),
    ],
    buildTitle: (v) => v['eventName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎟️ ${v['eventName']}`,
        fmtPrice(v['price']),
        has(v, 'seatsLeft') ? `${v['seatsLeft']} ticket(s) left` : undefined,
        has(v, 'deadline') ? `Register by ${v['deadline']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'interested',
    defaultExpiresIn: 10080,
  },
  {
    id: 'venue_available',
    category: TagCategory.Event,
    label: '🏛️ Venue Available',
    icon: '🏛️',
    shortDescription: 'List a venue for booking',
    version: 1,
    recommended: true,
    displayOrder: 30,
    intro: 'What venue is available?',
    fields: [
      {
        key: 'venueName',
        type: 'text',
        label: 'Venue',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Rooftop terrace, banquet hall',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'Available date / time',
        required: true,
        placeholder: 'e.g. Weekends in Sep',
      },
      { key: 'capacity', type: 'text', label: 'Capacity', placeholder: 'e.g. 200 guests' },
      presets.price({ required: true }),
      {
        key: 'facilities',
        type: 'text',
        label: 'Facilities',
        placeholder: 'e.g. AC, projector, catering',
      },
    ],
    buildTitle: (v) => v['venueName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏛️ ${v['venueName']}`,
        v['dateTime'],
        fmtPrice(v['price']),
        has(v, 'capacity') ? `Capacity: ${v['capacity']}` : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'book',
    defaultExpiresIn: 20160,
  },
  {
    id: 'event_service',
    category: TagCategory.Event,
    label: '📸 Event Service',
    icon: '📸',
    shortDescription: 'Offer an event-related service',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'What event service do you offer?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Event photography, decoration',
      },
      presets.price(),
      {
        key: 'availability',
        type: 'text',
        label: 'Availability',
        placeholder: 'e.g. Weekends, Sep–Oct',
      },
      presets.description(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📸 ${v['serviceName']}`,
        fmtPrice(v['price']),
        has(v, 'availability') ? v['availability'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'event_offer',
    category: TagCategory.Event,
    label: '🏷 Event Offer',
    icon: '🏷',
    shortDescription: 'Discount or deal on event services',
    version: 1,
    displayOrder: 50,
    intro: 'What event offer do you have?',
    fields: [
      {
        key: 'offerTitle',
        type: 'text',
        label: 'Offer title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. 20% off event photography',
      },
      ...priceGroup(),
      presets.validUntil(),
      presets.description({ label: 'Details' }),
    ],
    buildTitle: (v) => v['offerTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏷 ${v['offerTitle']}`,
        fmtPriceRange(v['price'], v['originalPrice']),
        has(v, 'validUntil') ? `Valid until ${v['validUntil']}` : undefined,
      ]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 10080,
  },
  {
    id: 'performer_entertainment',
    category: TagCategory.Event,
    label: '🎤 Performer / Entertainment',
    icon: '🎤',
    shortDescription: 'Offer entertainment or performer services',
    version: 1,
    displayOrder: 55,
    intro: 'What entertainment do you offer?',
    fields: [
      {
        key: 'performerType',
        type: 'text',
        label: 'Performer / service type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. DJ, live band, magician',
      },
      {
        key: 'availability',
        type: 'text',
        label: 'Availability',
        required: true,
        placeholder: 'e.g. Weekends, book 1 week ahead',
      },
      presets.price(),
      presets.description(),
    ],
    buildTitle: (v) => v['performerType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`🎤 ${v['performerType']}`, v['availability'], fmtPrice(v['price'])]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'booking_slot',
    category: TagCategory.Event,
    label: '📅 Booking Slot',
    icon: '📅',
    shortDescription: 'Open a booking slot',
    version: 1,
    displayOrder: 60,
    intro: 'What booking slot is available?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Wedding photography',
      },
      {
        key: 'dateTime',
        type: 'text',
        label: 'Date & time',
        required: true,
        placeholder: 'e.g. Sep 15, all day',
      },
      presets.price(),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`📅 ${v['serviceName']} — ${v['dateTime']}`, fmtPrice(v['price'])]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 10080,
  },
  {
    id: 'new_package',
    category: TagCategory.Event,
    label: '🆕 New Package',
    icon: '🆕',
    shortDescription: 'Launch a new event package',
    version: 1,
    displayOrder: 65,
    intro: 'What new package are you offering?',
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Birthday party package',
      },
      presets.price({ required: true }),
      {
        key: 'includes',
        type: 'textarea',
        label: 'Includes',
        required: true,
        placeholder: 'e.g. Venue, decoration, cake',
        maxLength: 500,
      },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`🆕 ${v['packageName']}`, fmtPrice(v['price']), `Includes: ${v['includes']}`]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  makeJobTemplate(TagCategory.Event, 70),
  makeUpdateTemplate(TagCategory.Event, 80),
  makeLookingForTemplate(TagCategory.Event, 90),
  makeLegacyGeneral(
    TagCategory.Event,
    'General event update',
    "What's happening?",
    [
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
          'Photography',
          'Workshop',
          'Exhibition',
          'Party / DJ night',
          'Meetup',
          'Decoration / setup',
          'Other event',
        ],
      },
      { key: 'when', label: 'When', type: 'text', required: true, placeholder: 'e.g. Sat 7 PM' },
      { key: 'venue', label: 'Venue (optional)', type: 'text', placeholder: 'e.g. Brigade Road' },
    ],
    (v) => joinParts([`🎉 ${v['name']} — ${v['eventType']}`, v['when'], v['venue']]),
    { defaultIntent: 'happening', defaultCta: 'join', defaultExpiresIn: 1440 },
  ),
];

// ━━━ BIZ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BIZ_TEMPLATES: PostTemplateDefinition[] = [
  {
    id: 'professional_service',
    category: TagCategory.Biz,
    label: '🏢 Professional Service',
    icon: '🏢',
    shortDescription: 'Announce a professional service',
    version: 1,
    recommended: true,
    displayOrder: 10,
    intro: 'What professional service do you offer?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Tax filing, legal consultation',
      },
      presets.price({ label: 'Starting price' }),
      presets.description({ required: true }),
      {
        key: 'deliveryMode',
        type: 'select',
        label: 'Delivery mode',
        options: ['Online', 'Offline', 'Both'],
      },
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🏢 ${v['serviceName']}`,
        fmtPrice(v['price']) ? `From ${fmtPrice(v['price'])}` : undefined,
        has(v, 'deliveryMode') ? v['deliveryMode'] : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'consultation_slot',
    category: TagCategory.Biz,
    label: '📅 Consultation Slot',
    icon: '📅',
    shortDescription: 'Open a consultation slot',
    version: 1,
    recommended: true,
    displayOrder: 20,
    intro: 'What consultation is available?',
    fields: [
      {
        key: 'consultType',
        type: 'text',
        label: 'Consultation type',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Free strategy call',
      },
      ...appointmentGroup({ required: true }, { required: true }),
      presets.price({ label: 'Fee' }),
      { key: 'duration', type: 'text', label: 'Duration', placeholder: 'e.g. 30 min' },
    ],
    buildTitle: (v) => v['consultType']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `📅 ${v['consultType']} — ${v['startDate']} at ${v['startTime']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : 'Free',
        has(v, 'duration') ? v['duration'] : undefined,
      ]),
    defaultIntent: 'open_slot',
    defaultCta: 'book',
    defaultExpiresIn: 4320,
  },
  makeOfferTemplate(TagCategory.Biz, 30, {
    label: '🏷 Service Offer',
    shortDescription: 'Discount on a professional service',
  }),
  {
    id: 'new_service',
    category: TagCategory.Biz,
    label: '🆕 New Service',
    icon: '🆕',
    shortDescription: 'Launch a new professional service',
    version: 1,
    recommended: true,
    displayOrder: 40,
    intro: 'What new service are you launching?',
    fields: [
      {
        key: 'serviceName',
        type: 'text',
        label: 'Service name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. GST return filing',
      },
      presets.description({ required: true }),
      presets.price({ label: 'Starting price' }),
    ],
    buildTitle: (v) => v['serviceName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🆕 New service: ${v['serviceName']}`,
        fmtPrice(v['price']) ? `From ${fmtPrice(v['price'])}` : undefined,
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'available_now',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'service_package',
    category: TagCategory.Biz,
    label: '📦 Service Package',
    icon: '📦',
    shortDescription: 'Bundle of professional services',
    version: 1,
    displayOrder: 50,
    intro: "What's in the package?",
    fields: [
      {
        key: 'packageName',
        type: 'text',
        label: 'Package name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Annual accounting package',
      },
      presets.price({ required: true }),
      {
        key: 'includes',
        type: 'textarea',
        label: 'Includes',
        required: true,
        placeholder: 'e.g. Monthly GST, quarterly audit',
        maxLength: 500,
      },
      { key: 'validity', type: 'text', label: 'Validity', placeholder: 'e.g. 1 year' },
    ],
    buildTitle: (v) => v['packageName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`📦 ${v['packageName']}`, fmtPrice(v['price']), `Includes: ${v['includes']}`]),
    defaultIntent: 'offer',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'company_update',
    category: TagCategory.Biz,
    label: '📢 Company Update',
    icon: '📢',
    shortDescription: 'Share a business update',
    version: 1,
    displayOrder: 55,
    intro: "What's the update?",
    fields: [
      {
        key: 'updateTitle',
        type: 'text',
        label: 'Update title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. New office location, extended hours',
      },
      presets.description({ label: 'Details' }),
    ],
    buildTitle: (v) => v['updateTitle']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([`📢 ${v['updateTitle']}`, has(v, 'description') ? v['description'] : undefined]),
    defaultExpiresIn: 10080,
  },
  {
    id: 'partnership',
    category: TagCategory.Biz,
    label: '🤝 Partnership',
    icon: '🤝',
    shortDescription: 'Seek a business partner or collaboration',
    version: 1,
    displayOrder: 60,
    intro: 'What partnership or collaboration are you looking for?',
    fields: [
      {
        key: 'opportunityTitle',
        type: 'text',
        label: 'Opportunity title',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Looking for marketing partner',
      },
      {
        key: 'lookingFor',
        type: 'textarea',
        label: 'What / who are you looking for?',
        required: true,
        placeholder: 'Describe the ideal partner…',
        maxLength: 500,
      },
      presets.description({ label: 'Details', placeholder: 'More context…' }),
      {
        key: 'contactMethod',
        type: 'text',
        label: 'Preferred contact method',
        placeholder: 'e.g. Email, WhatsApp',
      },
    ],
    buildTitle: (v) => v['opportunityTitle']?.trim() || '',
    buildHighlight: (v) => joinParts([`🤝 ${v['opportunityTitle']}`, v['lookingFor']]),
    defaultIntent: 'looking_for',
    defaultCta: 'message',
    defaultExpiresIn: 20160,
  },
  {
    id: 'business_event',
    category: TagCategory.Biz,
    label: '🎉 Business Event',
    icon: '🎉',
    shortDescription: 'Host a professional event or seminar',
    version: 1,
    displayOrder: 65,
    intro: 'What business event are you hosting?',
    fields: [
      {
        key: 'eventName',
        type: 'text',
        label: 'Event name',
        required: true,
        mapsTo: 'title',
        placeholder: 'e.g. Networking meetup, webinar',
      },
      ...eventGroup({ required: true }),
      presets.description(),
      presets.price({ label: 'Entry fee', placeholder: 'Leave blank if free' }),
    ],
    buildTitle: (v) => v['eventName']?.trim() || '',
    buildHighlight: (v) =>
      joinParts([
        `🎉 ${v['eventName']}`,
        fmtPrice(v['price']) ? `Fee: ${fmtPrice(v['price'])}` : 'Free',
        has(v, 'description') ? v['description'] : undefined,
      ]),
    defaultIntent: 'happening',
    defaultCta: 'join',
    defaultExpiresIn: 4320,
  },
  makeJobTemplate(TagCategory.Biz, 70),
  makeLookingForTemplate(TagCategory.Biz, 90),
  makeLegacyGeneral(
    TagCategory.Biz,
    'General professional update',
    'Share a professional service update.',
    [
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
        placeholder: 'e.g. Tax filing',
      },
      {
        key: 'availability',
        label: 'When (optional)',
        type: 'text',
        placeholder: 'e.g. Weekdays 10 AM–6 PM',
      },
      {
        key: 'details',
        label: 'Detail (optional)',
        type: 'text',
        placeholder: 'e.g. First consultation free',
      },
    ],
    (v) => joinParts([`🏢 ${v['service']} — ${v['updateType']}`, v['availability'], v['details']]),
    { defaultIntent: 'available_now', defaultCta: 'message' },
  ),
];

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Central store: one entry per business category, each holding an array of
 * template definitions. Personal categories are intentionally absent — they
 * use the legacy POST_TEMPLATES map which is still in place.
 *
 * Each category includes:
 *   - Category-specific templates (recommended ones first by displayOrder)
 *   - Shared cross-category templates (job, looking_for, update, event)
 *   - Legacy "general" template (enabled=false) for historical post resolution
 */
export const POST_TEMPLATE_REGISTRY: Partial<
  Record<TagCategory, readonly PostTemplateDefinition[]>
> = {
  [TagCategory.Shop]: SHOP_TEMPLATES,
  [TagCategory.Food]: FOOD_TEMPLATES,
  [TagCategory.Service]: SERVICE_TEMPLATES,
  [TagCategory.Beauty]: BEAUTY_TEMPLATES,
  [TagCategory.Health]: HEALTH_TEMPLATES,
  [TagCategory.Fitness]: FITNESS_TEMPLATES,
  [TagCategory.Learn]: LEARN_TEMPLATES,
  [TagCategory.Auto]: AUTO_TEMPLATES,
  [TagCategory.Space]: SPACE_TEMPLATES,
  [TagCategory.Travel]: TRAVEL_TEMPLATES,
  [TagCategory.Event]: EVENT_TEMPLATES,
  [TagCategory.Biz]: BIZ_TEMPLATES,
};

// ─── Dev-time validation ──────────────────────────────────────────────────────
if (typeof ngDevMode !== 'undefined' && ngDevMode) {
  for (const [category, templates] of Object.entries(POST_TEMPLATE_REGISTRY)) {
    if (!templates) continue;
    const ids = templates.map((t) => t.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) {
      console.error(
        `[PostTemplateRegistry] Duplicate template id(s) in category "${category}": ${dupes.join(', ')}`,
      );
    }
    for (const t of templates) {
      if (!t.id)
        console.error(`[PostTemplateRegistry] Template missing id in category "${category}"`);
      if (!t.label) console.error(`[PostTemplateRegistry] Template "${t.id}" missing label`);
      if (t.version < 1)
        console.error(`[PostTemplateRegistry] Template "${t.id}" version must be >= 1`);
      if (t.category !== (category as TagCategory)) {
        console.error(
          `[PostTemplateRegistry] Template "${t.id}" category mismatch: declared ${t.category}, registered under ${category}`,
        );
      }
    }
  }
}

// ─── Helper utilities ────────────────────────────────────────────────────────

/** A blank values object matching a template's fields — starting state for the quick-fill form. */
export function emptyTemplateValues(
  template: Pick<PostTemplateDefinition, 'fields'>,
): Record<string, string> {
  return Object.fromEntries(template.fields.map((f) => [f.key, f.defaultValue ?? '']));
}

/** True once every required field in the template has a non-empty value. */
export function isTemplateComplete(
  template: Pick<PostTemplateDefinition, 'fields'>,
  values: Record<string, string>,
): boolean {
  return template.fields.every((f) => !f.required || !!values[f.key]?.trim());
}
