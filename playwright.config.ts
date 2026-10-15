import { defineConfig } from '@playwright/test';

process.env.TEMP = 'D:\\tmp\\anvil-v3-stage-b\\browser';
process.env.TMP = process.env.TEMP;
export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'D:/tmp/anvil-v3-stage-b/browser/results',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 15000,
  reporter: 'line',
  use: {
    baseURL: 'https://localhost:3830',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    ignoreHTTPSErrors: false,
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
});
