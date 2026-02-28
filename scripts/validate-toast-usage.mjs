import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ALLOWED_SONNER_IMPORT_FILES = new Set([
  path.resolve(ROOT, 'components/ui/appToast.tsx'),
  path.resolve(ROOT, 'components/ui/sonner.tsx'),
]);
const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'build',
  '.netlify',
  '.github',
  'docs',
  'content',
]);
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SONNER_IMPORT_REGEX = /from\s+['"]sonner['"]/;
const SONNER_TOAST_METHOD_REGEX = /\btoast\.(success|error|warning|info|loading)\s*\(/;

const failures = [];

const walk = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue;
    if (SKIP_DIR_NAMES.has(entry.name)) continue;

    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) continue;

    const normalizedPath = path.resolve(entryPath);
    const content = await fs.readFile(normalizedPath, 'utf8');

    if (SONNER_IMPORT_REGEX.test(content) && !ALLOWED_SONNER_IMPORT_FILES.has(normalizedPath)) {
      failures.push(
        `${path.relative(ROOT, normalizedPath)} imports sonner directly. Use components/ui/appToast.tsx instead.`
      );
    }

    if (SONNER_TOAST_METHOD_REGEX.test(content) && !ALLOWED_SONNER_IMPORT_FILES.has(normalizedPath)) {
      failures.push(
        `${path.relative(ROOT, normalizedPath)} calls toast.<method>(). Route notifications through showAppToast().`
      );
    }
  }
};

const main = async () => {
  await walk(ROOT);
  if (failures.length === 0) {
    console.log('[toasts:validate] toast usage validated');
    return;
  }

  console.error('[toasts:validate] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
