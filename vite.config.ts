import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import netlify from '@netlify/vite-plugin-tanstack-start';
import tailwindcss from '@tailwindcss/vite';
import { publicPrerenderPaths } from './app/routing/publicPrerender';

export default defineConfig(({ mode }) => {
    return {
        server: {
            port: Number(process.env.PORT) || 5173,
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
        plugins: [
            tanstackStart({
                router: {
                    virtualRouteConfig: './src/virtualRoutes.ts',
                    codeSplittingOptions: { defaultBehavior: [['loader'], ['component'], ['pendingComponent'], ['errorComponent'], ['notFoundComponent']] },
                },
                spa: { enabled: true, maskPath: '/__offline-shell', prerender: { outputPath: '/spa' } },
                // Flat documents preserve the router's slashless canonical URLs on Netlify.
                // Root index.html and the explicitly masked offline shell stay native.
                prerender: { enabled: true, autoSubfolderIndex: false, autoStaticPathsDiscovery: false, crawlLinks: false, concurrency: 4 },
                pages: publicPrerenderPaths.map(path => ({ path, prerender: { enabled: true } })),
            }),
            netlify({ dev: { edgeFunctions: { enabled: process.env.NETLIFY_DEV_EDGE === 'true' } } }),
            react(),
            tailwindcss(),
        ],
        build: {
            sourcemap: mode !== 'production',
            assetsInlineLimit: 0,
            // Vite 8's native minifier and Start's matched-route preload manifest
            // own this build; no global manual chunk warmup or preload suppression.
        },
        resolve: {
            alias: [
                { find: '@', replacement: path.resolve(import.meta.dirname, '.') },
            ],
        },
    };
});
