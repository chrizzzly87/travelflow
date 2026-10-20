import { defineConfig, devices } from '@playwright/test';

const deployedURL = process.env.PRODUCTION_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['production-critical.spec.ts', 'marketing-notices.spec.ts'],
  fullyParallel: true,
  timeout: 45_000,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: deployedURL || 'http://127.0.0.1:4183', trace: 'on-first-retry', serviceWorkers: 'block' },
  projects: [
    { name: 'chromium-production', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-production', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: deployedURL ? undefined : {
    command: 'node scripts/serve-built-site.mjs',
    url: 'http://127.0.0.1:4183/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
