import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'test/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    setupFiles: ['tests/setup.ts', './test/setupTests.ts'],
    // The default `forks` pool gives every test file its own process, so the
    // whole module graph is re-imported per file — `import` was 226s of a 273s
    // run. Worker threads share a module registry, which is where the time goes.
    pool: 'threads',
    // Threads share one process, so a test file can no longer pick its own
    // timezone: `process.env.TZ = ...` at the top of a file worked under
    // `forks` only because that file owned the process. Node reads TZ once at
    // startup, so it is set on the vitest scripts in package.json instead —
    // setting it here, or via `test.env`, or inside a worker, is already too
    // late. Europe/Berlin and not UTC on purpose: tests like
    // tests/unit/defaultTripDates.test.ts exist to catch local-midnight-vs-UTC
    // bugs, and under UTC that scenario cannot be reproduced at all.
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      all: true,
      include: [
        'shared/transportModes.ts',
        'config/routes.ts',
        'config/locales.ts',
        'config/productLimits.ts',
        'config/paywall.ts',
        'utils/flagUtils.ts',
        'services/destinationService.ts',
        'services/festivalDateService.ts',
        'services/festivalFilters.ts',
        'services/festivalCatalogService.ts',
        'services/tripPrefillDecoder.ts',
        'services/releaseNotesService.ts',
        'services/releaseNotesFormat.ts',
        'services/latestInAppRelease.ts',
        'services/blogService.ts',
        'data/countryTravelData.ts',
        'data/countryLocalizedNames.ts',
        'data/countrySearchMetadata.ts',
        'data/countryMonthLabels.ts',
        'services/storageService.ts',
        'services/historyService.ts',
        'services/authNavigationService.ts',
        'services/authUiPreferencesService.ts',
        'services/consentService.ts',
        'services/appRuntimeUtils.ts',
        'services/simulatedLoginService.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 80,
      },
    },
  },
});
