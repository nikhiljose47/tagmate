import { APP_CONSTANTS } from '../../core/constants/app.constants';
import { TAG_COLORS, TAG_EMOJIS, TagCategory } from '../../core/enums/tag-category.enum';

export function tagGradient(tag: string): string {
  const colors = TAG_COLORS[tag as TagCategory] ?? ['#6366f1', '#4f46e5'];
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
}

export function tagEmoji(tag: string): string {
  return TAG_EMOJIS[tag as TagCategory] ?? '📌';
}

export function avatarBg(username: string): string {
  return hashToItem(username, APP_CONSTANTS.AVATAR_COLORS);
}

export function coverGradient(username: string): string {
  return hashToItem(username, APP_CONSTANTS.COVER_GRADIENTS);
}

/**
 * Picks a readable text color (dark or light) for a given hex background,
 * so text stays legible on both light and dark background swatches.
 * Returns null when no background is set, so callers can fall back to the
 * theme's default text color.
 */
export function readableTextColor(bg: string | null | undefined): string | null {
  if (!bg) return null;
  const hex = bg.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  // Perceived brightness (YIQ) — a light swatch gets dark text, a dark swatch gets light text.
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 150 ? '#1f2937' : '#ffffff';
}

export function avatarInitials(username: string): string {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return username.trim().slice(0, 2).toUpperCase() || '??';
}

function hashToItem<T>(input: string, items: readonly T[]): T {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  return items[Math.abs(hash) % items.length]!;
}
