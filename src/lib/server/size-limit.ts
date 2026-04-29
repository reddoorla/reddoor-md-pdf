export const MAX_MARKDOWN_BYTES = 1024 * 1024;

export function exceedsMarkdownLimit(markdown: string): boolean {
  return Buffer.byteLength(markdown, 'utf-8') > MAX_MARKDOWN_BYTES;
}
