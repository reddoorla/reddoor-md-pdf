import { json } from '@sveltejs/kit';
import puppeteer from 'puppeteer-core';
import type { RequestHandler } from './$types';

const DEFAULT_CHROMIUM = '/usr/bin/chromium';

export const GET: RequestHandler = async () => {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? DEFAULT_CHROMIUM;
  try {
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    await browser.close();
    return json({ status: 'ok' });
  } catch (err) {
    return json(
      { status: 'unavailable', detail: (err as Error).message },
      { status: 503 }
    );
  }
};
