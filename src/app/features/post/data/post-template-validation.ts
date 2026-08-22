/**
 * Step 2.A — Template-aware validation.
 *
 * Pure functions — no Angular dependency. Used by the composer and specs.
 */

import { PostTemplateDefinition, TemplateField } from './post-template-registry';

export interface ValidationResult {
  valid: boolean;
  /** key → user-facing error message. Empty when valid. */
  errors: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numOrUndef(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isValidUrl(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

function isValidPhone(v: string): boolean {
  return PHONE_RE.test(v.trim());
}

function displayName(f: TemplateField): string {
  return f.shortLabel ?? f.label;
}

// ─── Per-field validation ────────────────────────────────────────────────────

function validateField(field: TemplateField, raw: string): string | null {
  const value = raw.trim();

  // Required
  if (field.required && !value) return `${displayName(field)} is required`;
  if (!value) return null; // optional and blank — OK

  // Type-specific
  switch (field.type) {
    case 'number':
    case 'price': {
      const n = numOrUndef(value);
      if (n === undefined) return `${displayName(field)} must be a number`;
      if (field.type === 'price' && n < 0) return 'Price cannot be negative';
      if (field.min !== undefined && n < field.min) return `Minimum is ${field.min}`;
      if (field.max !== undefined && n > field.max) return `Maximum is ${field.max}`;
      break;
    }
    case 'url':
      if (!isValidUrl(value)) return 'Enter a valid URL';
      break;
    case 'phone':
      if (!isValidPhone(value)) return 'Enter a valid phone number';
      break;
    case 'select':
      if (field.options && !field.options.includes(value))
        return `Choose a valid option for ${displayName(field)}`;
      break;
    case 'multi-select':
      if (field.options) {
        const selected = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const invalid = selected.filter((s) => !field.options!.includes(s));
        if (invalid.length) return `Invalid option(s): ${invalid.join(', ')}`;
      }
      break;
  }

  // maxLength
  if (field.maxLength && value.length > field.maxLength)
    return `Maximum ${field.maxLength} characters`;

  return null;
}

// ─── Cross-field validation ──────────────────────────────────────────────────

function crossFieldChecks(
  fields: readonly TemplateField[],
  values: Record<string, string>,
  errors: Record<string, string>,
): void {
  // Original price ≥ sale price
  const priceF = fields.find((f) => f.mapsTo === 'price');
  const origF = fields.find((f) => f.mapsTo === 'originalPrice');
  if (priceF && origF && !errors[priceF.key] && !errors[origF.key]) {
    const price = numOrUndef(values[priceF.key] ?? '');
    const orig = numOrUndef(values[origF.key] ?? '');
    if (price !== undefined && orig !== undefined && orig > 0 && price > orig)
      errors[origF.key] = 'Original price should be higher than the sale price';
  }

  // Event/datetime end > start
  const startF = fields.find((f) => f.mapsTo === 'eventStart');
  const endF = fields.find((f) => f.mapsTo === 'eventEnd');
  if (startF && endF && !errors[startF.key] && !errors[endF.key]) {
    const sv = values[startF.key]?.trim();
    const ev = values[endF.key]?.trim();
    if (sv && ev) {
      const s = new Date(sv).getTime();
      const e = new Date(ev).getTime();
      if (!isNaN(s) && !isNaN(e) && e <= s) errors[endF.key] = 'End time must be after start time';
    }
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * Validates all template field values.
 * Runs per-field checks, then cross-field checks, then the template's own
 * `validate()` hook if present.
 */
export function validateTemplateValues(
  template: Pick<PostTemplateDefinition, 'fields' | 'validate'>,
  values: Record<string, string>,
): ValidationResult {
  const errors: Record<string, string> = {};

  // Per-field
  for (const field of template.fields) {
    const err = validateField(field, values[field.key] ?? '');
    if (err) errors[field.key] = err;
  }

  // Cross-field (built-in)
  crossFieldChecks(template.fields, values, errors);

  // Template-level custom validation
  if (template.validate) {
    const extra = template.validate(values);
    for (const [k, msg] of Object.entries(extra)) {
      if (!errors[k] && msg) errors[k] = msg;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
