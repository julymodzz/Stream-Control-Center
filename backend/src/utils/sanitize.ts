const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function sanitizeString(input: string, maxLength = 500): string {
  return escapeHtml(input.trim().slice(0, maxLength));
}

export function sanitizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
}

export function sanitizeSearchQuery(input: string): string {
  return input.replace(/[^\w\säöüÄÖÜß.-]/g, '').slice(0, 200);
}
