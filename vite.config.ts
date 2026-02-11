import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const normalizeModuleId = (id: string): string => id.split(path.sep).join('/');

const getManualChunk = (id: string): string | undefined => {
    if (!id.includes('node_modules')) return undefined;
    const normalized = normalizeModuleId(id);

    if (
        normalized.includes('/node_modules/react-markdown/') ||
        normalized.includes('/node_modules/remark-gfm/') ||
        normalized.includes('/node_modules/remark-') ||
        normalized.includes('/node_modules/rehype-') ||
        normalized.includes('/node_modules/micromark') ||
        normalized.includes('/node_modules/unified/') ||
        normalized.includes('/node_modules/vfile') ||
        normalized.includes('/node_modules/unist-') ||
        normalized.includes('/node_modules/mdast-') ||
        normalized.includes('/node_modules/hast-')
    ) {
        return 'vendor-markdown';
    }

    if (
        normalized.includes('/node_modules/@phosphor-icons/') ||
        normalized.includes('/node_modules/lucide-react/')
    ) {
        return 'vendor-icons';
    }

    if (normalized.includes('/node_modules/@supabase/')) {
        return 'vendor-supabase';
    }

    if (normalized.includes('/node_modules/@google/genai/')) {
        return 'vendor-genai';
    }

    if (
        normalized.includes('/node_modules/@radix-ui/') ||
        normalized.includes('/node_modules/vaul/')
    ) {
        return 'vendor-ui';
    }

    if (normalized.includes('/node_modules/three/')) {
        return 'vendor-three';
    }

    return 'vendor';
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        strictPort: false,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      build: {
        rollupOptions: {
          output: {
            manualChunks: getManualChunk,
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
