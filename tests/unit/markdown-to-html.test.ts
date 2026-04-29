import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../../src/lib/server/markdown-to-html';

describe('markdownToHtml', () => {
  it('wraps body in markdown-body class', () => {
    const html = markdownToHtml('# hello');
    expect(html).toContain('<body class="markdown-body">');
  });

  it('inlines CSS from pdf.config.cjs into a <style> tag', () => {
    const html = markdownToHtml('# hello');
    expect(html).toMatch(/<style>[\s\S]*color:\s*#6d6e71/);
  });

  it('renders heading-only fixture deterministically', () => {
    expect(markdownToHtml('# Reddoor RFP Handbook')).toMatchSnapshot();
  });

  it('renders a table fixture deterministically', () => {
    const md = [
      '| col a | col b |',
      '| ----- | ----- |',
      '| one   | two   |'
    ].join('\n');
    expect(markdownToHtml(md)).toMatchSnapshot();
  });

  it('renders a link fixture deterministically', () => {
    expect(markdownToHtml('See [Reddoor](https://reddoor.com).')).toMatchSnapshot();
  });

  it('renders a fenced code block fixture deterministically', () => {
    const md = '```js\nconst x = 1;\n```\n';
    expect(markdownToHtml(md)).toMatchSnapshot();
  });
});
