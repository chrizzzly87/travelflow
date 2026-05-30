import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 5173,
            strictPort: false,
            host: '0.0.0.0',
            proxy: {
                '/api/internal/ai/generation-worker': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/internal/admin/iam': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/internal/admin/audit/replay-export': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/billing/paddle/checkout': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/billing/paddle/webhook': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/trip-map-preview': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        plugins: [preact(), tailwindcss()],
        build: {
            sourcemap: mode !== 'production',
            // Keep global dependency preloading off: targeted warmups are the intended
            // fast path here, and broad modulepreload fanout regressed first-load cost.
            modulePreload: false,
            assetsInlineLimit: 0,
            minify: mode === 'production' ? 'terser' : 'esbuild',
            terserOptions: mode === 'production'
                ? {
                    compress: {
                        pure_funcs: ['console.log', 'console.info', 'console.debug'],
                    },
                }
                : undefined,
            esbuild: {
                pure: mode === 'production'
                    ? ['console.log', 'console.info', 'console.debug']
                    : [],
            },
        },
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        },
        resolve: {
            alias: [
                { find: '@', replacement: path.resolve(__dirname, '.') },
                { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
                { find: /^react-dom\/server$/, replacement: 'preact/compat/server' },
                { find: /^react-dom\/test-utils$/, replacement: 'preact/test-utils' },
                { find: /^react-dom$/, replacement: 'preact/compat' },
                { find: /^react\/jsx-runtime$/, replacement: 'preact/compat/jsx-runtime' },
                { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/compat/jsx-dev-runtime' },
                { find: /^react$/, replacement: 'preact/compat' },
            ],
        },
    };
});
