import { defineConfig } from '@playwright/test';

/**
 * Offline/PWA end-to-end suite.
 *
 * Separate from `playwright.config.ts` because the service worker only exists
 * in a production build: `registerServiceWorker` no-ops under `vite dev`, and
 * `dist/sw.js` is written by `scripts/build-service-worker.mjs` at the very end
 * of the build. Run `pnpm build` (or `pnpm build:netlify`) first.
 */
export default defineConfig({
    testDir: './e2e/pwa',
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4174',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npx vite preview --host 127.0.0.1 --port 4174 --strictPort',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: false,
        timeout: 60_000,
    },
});
