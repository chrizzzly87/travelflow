import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: rootDir,
  srcDir: './marketing',
  publicDir: './public',
  outDir: './.astro-marketing-dist',
  trailingSlash: 'ignore',
  integrations: [react()],
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: [
        'react-router',
        'react-router-dom',
        '@phosphor-icons/react',
        'react-i18next',
      ],
    },
    resolve: {
      alias: [{ find: '@', replacement: rootDir }],
    },
  },
});
