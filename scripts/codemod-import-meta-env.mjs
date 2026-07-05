// One-shot codemod: import.meta.env.* -> process.env.* (Next.js convention).
// Kept in-repo for review; safe to delete after the Next.js migration lands.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const files = execSync(
    "grep -rl 'import\\.meta\\.env\\|import\\.meta as' --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v vite-env.d.ts | grep -v 'vitest.config\\|vite.config' | grep -v '^\\./scripts/'",
    { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

const DEV_EXPR = "(process.env.NODE_ENV !== 'production')";
const PROD_EXPR = "(process.env.NODE_ENV === 'production')";

for (const file of files) {
    let source = readFileSync(file, 'utf8');
    const before = source;

    source = source
        .replaceAll(/\(import\.meta as any\)\?\.env\?\.VITE_([A-Z0-9_]+)/g, 'process.env.NEXT_PUBLIC_$1')
        .replaceAll(/\(import\.meta as ImportMeta & \{ env\?: \{ DEV\?: boolean \} \}\)\.env\?\.DEV/g, DEV_EXPR)
        .replaceAll(/\(import\.meta as \{ env\?: Record<string, unknown> \}\)\.env\?\.VITE_([A-Z0-9_]+) as string \| undefined/g, 'process.env.NEXT_PUBLIC_$1')
        .replaceAll(/\(import\.meta as any\)\?\.env\?\.DEV/g, DEV_EXPR)
        .replaceAll(/\(import\.meta as any\)\?\.env\?\.PROD/g, PROD_EXPR)
        .replaceAll(/import\.meta\.env\?\.VITE_([A-Z0-9_]+)/g, 'process.env.NEXT_PUBLIC_$1')
        .replaceAll(/import\.meta\.env\.VITE_([A-Z0-9_]+)/g, 'process.env.NEXT_PUBLIC_$1')
        .replaceAll(/import\.meta\.env\.DEV/g, DEV_EXPR)
        .replaceAll(/import\.meta\.env\.PROD/g, PROD_EXPR);

    if (source !== before) {
        writeFileSync(file, source);
        console.log(`rewrote ${file}`);
    }
}
