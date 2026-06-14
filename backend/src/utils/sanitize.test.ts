import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeSearchQuery, sanitizeUsername } from './sanitize';

describe('sanitize', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('sanitizes usernames', () => {
    expect(sanitizeUsername('Admin_User!')).toBe('admin_user');
  });

  it('limits search query length', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeSearchQuery(long).length).toBeLessThanOrEqual(200);
  });
});
