import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RendererTimeoutError,
  renderMarkdownToPdf
} from '../../src/lib/server/renderer';

const chromiumPath =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : null) ??
  (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : null);

const skipIfNoChromium = chromiumPath ? describe : describe.skip;

skipIfNoChromium('renderMarkdownToPdf', () => {
  it('returns a buffer that begins with %PDF- and is > 1 KB', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath!;
    const buf = await renderMarkdownToPdf('# Hello\n\nSome body text.');
    expect(buf.length).toBeGreaterThan(1024);
    expect(buf.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  }, 30_000);

  it('rejects with RendererTimeoutError when the deadline is exceeded', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath!;
    await expect(
      renderMarkdownToPdf('# tiny doc', { timeoutMs: 1 })
    ).rejects.toBeInstanceOf(RendererTimeoutError);
  }, 10_000);
});
