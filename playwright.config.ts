import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/integration',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
