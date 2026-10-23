import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  outputDir: './logs/ui-review/results-vben',
  workers: 1,
  timeout: 150_000,
  use: {
    baseURL: 'http://127.0.0.1:5777',
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'pnpm admin:dev', url: 'http://127.0.0.1:5777/admin/', reuseExistingServer: true, timeout: 120_000 },
  ],
});
