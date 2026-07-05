import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    timeout: 30_000,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'on-first-retry',
    },
    // Chromium AND WebKit: rule #1 from the 2026-07 hydration postmortem —
    // WebKit-only rendering regressions must fail the suite.
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
    webServer: {
        command: 'NEXT_PUBLIC_E2E_AUTH_SANDBOX=true pnpm exec next dev -p 4173 --hostname 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
