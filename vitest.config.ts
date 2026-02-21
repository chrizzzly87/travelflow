import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [['tests/browser/**/*.test.ts', 'jsdom']],
    setupFiles: ['tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
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
        'services/tripPrefillDecoder.ts',
        'services/releaseNotesService.ts',
        'services/blogService.ts',
        'data/countryTravelData.ts',
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
