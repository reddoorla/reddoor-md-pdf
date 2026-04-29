import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deriveFilename } from '$lib/server/filename';
import { exceedsMarkdownLimit } from '$lib/server/size-limit';
import { DEFAULT_RATE_LIMIT, createRateLimiter } from '$lib/server/rate-limit';
import {
  RendererError,
  RendererTimeoutError,
  renderMarkdownToPdf
} from '$lib/server/renderer';

const limiter = createRateLimiter(DEFAULT_RATE_LIMIT);

function clientIp(request: Request, getClientAddress: () => string): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  try {
    return getClientAddress();
  } catch {
    return 'unknown';
  }
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as Record<string, unknown>).markdown !== 'string'
  ) {
    return json({ error: 'Field "markdown" must be a string.' }, { status: 400 });
  }

  const { markdown, filename } = body as { markdown: string; filename?: string };

  if (exceedsMarkdownLimit(markdown)) {
    return json({ error: 'Markdown too large.' }, { status: 413 });
  }

  const ip = clientIp(request, getClientAddress);
  const limit = limiter.take(ip);
  if (!limit.allowed) {
    const retrySec = Math.ceil(limit.retryAfterMs / 1000);
    return json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retrySec) } }
    );
  }

  try {
    const pdf = await renderMarkdownToPdf(markdown);
    const out = deriveFilename(filename, markdown);
    const body: ArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${out}"`,
        'Content-Length': String(pdf.byteLength)
      }
    });
  } catch (err) {
    if (err instanceof RendererTimeoutError) {
      return json({ error: 'Render timed out.' }, { status: 504 });
    }
    if (err instanceof RendererError) {
      return json({ error: 'Renderer error.' }, { status: 502 });
    }
    throw error(500, 'Unexpected error.');
  }
};
