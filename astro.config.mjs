import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: rootDir,
  srcDir: './marketing',
  publicDir: './public',
  outDir: './.astro-marketing-dist',
  trailingSlash: 'ignore',
  integrations: [preact()],
  build: {
    format: 'directory',
  },
  vite: {
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
  },
});
