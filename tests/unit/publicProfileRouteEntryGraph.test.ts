import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The public profile route's `head` is not code-split, so everything it imports
 * statically ships in the entry bundle. Country data (and the trip view's
 * optional `countryAliasService` chunk) must stay out of that graph.
 */
const ROOT = process.cwd();
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

const resolveImport = (fromFile: string, specifier: string): string | null => {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), specifier);
    for (const candidate of [base, ...EXTENSIONS.map(extension => base + extension)]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
};

/** Static `import ... from` / `export ... from` edges only; `import()` stays lazy. */
const staticImports = (file: string): string[] => {
    const source = fs.readFileSync(file, 'utf8');
    const specifiers = [...source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map(match => match[1]!);
    return specifiers.map(specifier => resolveImport(file, specifier)).filter((resolved): resolved is string => Boolean(resolved));
};

const staticGraph = (entry: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [path.resolve(ROOT, entry)];
    while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        queue.push(...staticImports(file));
    }
    return seen;
};

describe('public profile route entry graph', () => {
    it.each([
        'features/profile/publicProfileDocument.ts',
        'shared/publicProfile.ts',
        'src/server/publicProfile.ts',
    ])('%s does not statically reach country data', entry => {
        const graph = [...staticGraph(entry)].map(file => path.relative(ROOT, file));
        expect(graph).not.toContain('services/profileCountryService.ts');
        expect(graph).not.toContain('services/countryAliasService.ts');
        expect(graph).not.toContain('shared/publicProfileRows.ts');
    });
});
