import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./test/setupTests.ts'],
        include: ['test/**/*.test.{ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
});
