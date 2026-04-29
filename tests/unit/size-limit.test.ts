import { describe, expect, it } from 'vitest';
import { MAX_MARKDOWN_BYTES, exceedsMarkdownLimit } from '../../src/lib/server/size-limit';

describe('size-limit', () => {
  it('exposes a 1 MB cap', () => {
    expect(MAX_MARKDOWN_BYTES).toBe(1024 * 1024);
  });

  it('returns false for a small ASCII string', () => {
    expect(exceedsMarkdownLimit('hello')).toBe(false);
  });

  it('returns false at exactly the limit', () => {
    const atLimit = 'a'.repeat(MAX_MARKDOWN_BYTES);
    expect(exceedsMarkdownLimit(atLimit)).toBe(false);
  });

  it('returns true at limit + 1 byte', () => {
    const overLimit = 'a'.repeat(MAX_MARKDOWN_BYTES + 1);
    expect(exceedsMarkdownLimit(overLimit)).toBe(true);
  });

  it('measures bytes (UTF-8), not characters', () => {
    // '🔴' = 4 UTF-8 bytes; 300_000 of them = 1_200_000 bytes > 1 MB
    const heavy = '🔴'.repeat(300_000);
    expect(exceedsMarkdownLimit(heavy)).toBe(true);
  });
});
