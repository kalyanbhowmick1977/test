import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: process.env.PB_TEST_URL || 'http://127.0.0.1:5080', headless: true, viewport: { width: 1500, height: 1000 }, launchOptions: process.env.PB_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PB_CHROMIUM_EXECUTABLE } : {} },
});
