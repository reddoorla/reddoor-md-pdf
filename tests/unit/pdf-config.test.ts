import { describe, expect, it } from 'vitest';
import pdfConfig from '../../src/lib/server/pdf-config';

/** Grab the declaration body of a base element rule (e.g. `h1 { ... }`),
 *  without matching pseudo-class variants like `h1:first-child`. */
function ruleBody(css: string, selector: string): string {
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${selector}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

describe('pdf-config page-break policy', () => {
  const css = pdfConfig.css;

  it('forces page breaks before top-level (h1) sections', () => {
    expect(ruleBody(css, 'h1')).toMatch(/break-before:\s*page/);
  });

  it('does NOT force a page break before h2 (the bug that fragmented docs into near-empty pages)', () => {
    expect(ruleBody(css, 'h2')).not.toMatch(/break-before:\s*page/);
  });

  it('guards the first heading so the document does not open on a blank page', () => {
    expect(css).toMatch(/h1:first-child\s*\{[^}]*break-before:\s*avoid/);
  });

  it('keeps headings attached to the content that follows them', () => {
    expect(ruleBody(css, 'h2')).toMatch(/break-after:\s*avoid/);
    expect(ruleBody(css, 'h3')).toMatch(/break-after:\s*avoid/);
  });
});
