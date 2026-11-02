import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'test-results', 'tmp', '.claude', '.netlify']);

const listCssFiles = (dir: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listCssFiles(full));
    else if (entry.endsWith('.css')) files.push(full);
  }
  return files;
};

// A second Tailwind entry ships its utilities in a separate block of the same
// bundle. A base utility from one block then overrides a responsive variant
// generated only in the other (`.flex-col` beating `xl:flex-row`), which left
// admin layouts stuck in their mobile arrangement.
describe('Tailwind entry', () => {
  it('has exactly one stylesheet importing tailwindcss', () => {
    const entries = listCssFiles(ROOT).filter((file) => /@import\s+["']tailwindcss["']/.test(readFileSync(file, 'utf8')));
    expect(entries.map((file) => path.relative(ROOT, file))).toEqual(['index.css']);
  });

  it('scans the admin and deferred routes from index.css', () => {
    const css = readFileSync(path.join(ROOT, 'index.css'), 'utf8');
    expect(css).toContain('@source "./**/*.{ts,tsx}";');
    expect(css).not.toMatch(/@source not "\.\/(pages\/Admin|components\/admin)/);
  });
});
