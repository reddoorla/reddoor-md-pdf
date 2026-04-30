import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('generates a PDF from pasted markdown', async ({ page }) => {
  await page.goto('/');

  await page.locator('textarea').fill('# Playwright Smoke\n\nHello PDF.');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /generate pdf/i }).click();
  const download = await downloadPromise;

  const tmp = await download.path();
  expect(tmp).toBeTruthy();
  const bytes = readFileSync(tmp!);
  expect(bytes.length).toBeGreaterThan(1024);
  expect(bytes.slice(0, 5).toString('utf-8')).toBe('%PDF-');
});
