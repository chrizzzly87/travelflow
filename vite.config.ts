import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 5173,
            strictPort: false,
            host: '0.0.0.0',
            proxy: {
                '/api/internal/admin/iam': {
                    target: 'http://localhost:8888',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        plugins: [react(), tailwindcss()],
        envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
        build: {
            sourcemap: mode !== 'production',
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
            alias: {
                '@': path.resolve(__dirname, '.'),
            },
        },
    };
});
