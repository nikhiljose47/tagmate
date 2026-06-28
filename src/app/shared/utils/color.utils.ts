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

export function avatarInitials(username: string): string {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.trim().slice(0, 2).toUpperCase() || '??';
}

function hashToItem<T>(input: string, items: readonly T[]): T {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  return items[Math.abs(hash) % items.length];
}
