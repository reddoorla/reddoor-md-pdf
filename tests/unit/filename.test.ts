import { describe, expect, it } from 'vitest';
import { deriveFilename } from '../../src/lib/server/filename';

describe('deriveFilename', () => {
  it('returns sanitized user input with .pdf appended when caller provides a filename', () => {
    expect(deriveFilename('My Doc', '# Ignored')).toBe('My Doc.pdf');
  });

  it('preserves a user-supplied .pdf extension', () => {
    expect(deriveFilename('report.pdf', '# Ignored')).toBe('report.pdf');
  });

  it('strips path separators and Windows-illegal chars but keeps spaces', () => {
    expect(deriveFilename('a/b\\c:d*e?f"g<h>i|j', '# Ignored')).toBe('abcdefghij.pdf');
  });

  it('preserves spaces inside user-supplied filenames', () => {
    expect(deriveFilename('Quarterly  Report', '# Ignored')).toBe('Quarterly  Report.pdf');
  });

  it('falls back to the first H1 slugified when no filename supplied', () => {
    expect(deriveFilename(undefined, '# Reddoor RFP Handbook\n\ncontent')).toBe(
      'reddoor-rfp-handbook.pdf'
    );
  });

  it('lowercases and ASCII-normalises unicode in the H1', () => {
    expect(deriveFilename(undefined, '# Café Résumé — V2')).toBe('cafe-resume-v2.pdf');
  });

  it('truncates derived names to 80 chars before the extension', () => {
    const longTitle = 'a '.repeat(100).trim();
    const out = deriveFilename(undefined, `# ${longTitle}`);
    expect(out.endsWith('.pdf')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(84); // 80 + '.pdf'
  });

  it('falls back to document.pdf when there is no H1', () => {
    expect(deriveFilename(undefined, 'no heading here')).toBe('document.pdf');
  });

  it('falls back to document.pdf when the H1 slugifies to empty', () => {
    expect(deriveFilename(undefined, '# !!!')).toBe('document.pdf');
  });

  it('treats an empty user filename string as "not provided"', () => {
    expect(deriveFilename('', '# Hello World')).toBe('hello-world.pdf');
  });
});
