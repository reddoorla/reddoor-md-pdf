import { marked } from 'marked';
import pdfConfig from './pdf-config';

export function markdownToHtml(markdown: string): string {
  const body = marked.parse(markdown, { async: false }) as string;
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<style>${pdfConfig.css}</style>`,
    '</head>',
    '<body class="markdown-body">',
    body,
    '</body>',
    '</html>'
  ].join('\n');
}
