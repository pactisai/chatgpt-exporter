import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  use: { baseURL: 'http://localhost:3001', headless: true },
  webServer: { command: 'node server/index.js', port: 3001, timeout: 30000, reuseExistingServer: false },
});
