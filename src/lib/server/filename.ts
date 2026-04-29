const MAX_DERIVED_LENGTH = 80;

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeUserFilename(name: string): string {
  const stripped = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim();
  if (!stripped) return '';
  return stripped.toLowerCase().endsWith('.pdf') ? stripped : `${stripped}.pdf`;
}

function firstH1(markdown: string): string | null {
  const match = markdown.match(/^\s*#\s+(.+?)\s*$/m);
  return match ? match[1] : null;
}

export function deriveFilename(userInput: string | undefined, markdown: string): string {
  if (userInput && userInput.trim()) {
    const sanitized = sanitizeUserFilename(userInput);
    if (sanitized) return sanitized;
  }

  const heading = firstH1(markdown);
  if (heading) {
    const slug = slugify(heading).slice(0, MAX_DERIVED_LENGTH);
    if (slug) return `${slug}.pdf`;
  }

  return 'document.pdf';
}
