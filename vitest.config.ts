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
    setupFiles: ['tests/setup.ts', './test/setupTests.ts'],
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
