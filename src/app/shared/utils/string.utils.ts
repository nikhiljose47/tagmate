/**
 * Safely escapes HTML special characters to prevent XSS.
 * Removes null bytes and handles unicode characters correctly.
 * Safe to run in SSR environments since it does not depend on browser DOM (document).
 */
export function escapeHtml(value: string): string {
  if (!value) return '';
  // Strip null bytes to prevent injection attacks
  const sanitized = value.replace(/\0/g, '');
  // Escape HTML characters
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
