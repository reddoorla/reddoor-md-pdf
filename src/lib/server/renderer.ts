import { mdToPdf } from 'md-to-pdf';
import pdfConfig from '../../../pdf.config.cjs';

export class RendererTimeoutError extends Error {
  constructor(message = 'Render timed out.') {
    super(message);
    this.name = 'RendererTimeoutError';
  }
}

export class RendererError extends Error {
  constructor(message = 'Renderer error.', readonly cause?: unknown) {
    super(message);
    this.name = 'RendererError';
  }
}

export type RenderOptions = { timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CHROMIUM = '/usr/bin/chromium';

export async function renderMarkdownToPdf(
  markdown: string,
  opts: RenderOptions = {}
): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? DEFAULT_CHROMIUM;

  const renderPromise = (async () => {
    try {
      const result = await mdToPdf(
        { content: markdown },
        {
          ...pdfConfig,
          launch_options: {
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        } as never
      );
      if (!result || !result.content) {
        throw new RendererError('Renderer produced no output.');
      }
      return Buffer.from(result.content);
    } catch (err) {
      if (err instanceof RendererError) throw err;
      throw new RendererError('Renderer error.', err);
    }
  })();

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RendererTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([renderPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
