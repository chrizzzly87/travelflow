import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const ASTRO_DIST_DIR = path.join(ROOT, '.astro-marketing-dist');
const APP_SHELL_FILE = path.join(DIST_DIR, 'app.html');
const VITE_INDEX_FILE = path.join(DIST_DIR, 'index.html');

const copyRecursive = async (source, target) => {
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source);
    await Promise.all(entries.map((entry) => copyRecursive(path.join(source, entry), path.join(target, entry))));
    return;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
};

const main = async () => {
  await fs.access(DIST_DIR);
  await fs.access(ASTRO_DIST_DIR);

  const viteIndexHtml = await fs.readFile(VITE_INDEX_FILE, 'utf8');
  if (viteIndexHtml.includes('id="root"')) {
    await fs.copyFile(VITE_INDEX_FILE, APP_SHELL_FILE);
  } else {
    try {
      const existingAppShellHtml = await fs.readFile(APP_SHELL_FILE, 'utf8');
      if (!existingAppShellHtml.includes('id="root"')) {
        throw new Error('existing app shell is not a React document');
      }
    } catch (error) {
      throw new Error(
        '[astro-marketing] cannot preserve app shell because dist/index.html is already Astro. Run vite build before marketing:merge.'
      );
    }
  }

  await copyRecursive(ASTRO_DIST_DIR, DIST_DIR);

  const appShellHtml = await fs.readFile(APP_SHELL_FILE, 'utf8');
  if (!appShellHtml.includes('id="root"')) {
    throw new Error('[astro-marketing] app shell copy does not contain React root.');
  }

  const astroIndexHtml = await fs.readFile(VITE_INDEX_FILE, 'utf8');
  if (astroIndexHtml.includes('/assets/index-') || astroIndexHtml.includes('id="root"')) {
    throw new Error('[astro-marketing] Astro index did not replace the Vite index cleanly.');
  }

  console.log('[astro-marketing] merged static marketing output into dist and preserved dist/app.html fallback');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
