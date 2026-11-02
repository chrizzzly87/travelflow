import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const authoringOnly = new Set([
    'services/aiService.ts', 'services/destinationService.ts',
    'services/countryAliasService.ts', 'services/tripGenerationRetryService.ts',
    'services/tripGenerationQueueService.ts', 'services/tripClaimConflictService.ts',
    'components/tripview/TripClaimConflictDialog.tsx',
]);
// Interaction-only code the first trip view render must not pull in: the
// agent's zod schemas (validated inside the lazy chat session) and the map
// customize panel (loaded on its first open).
const interactionOnly = new Set(['shared/tripAgent.ts', 'components/maps/MapCustomizeModal.tsx']);

/** Follow runtime declarations, excluding type-only and optional import() edges. */
function findAuthoringPaths(entry: string, forbidden: Set<string> = authoringOnly): string[][] {
    const visited = new Set<string>();
    const violations: string[][] = [];
    function visit(file: string, chain: string[]) {
        if (visited.has(file)) return;
        visited.add(file);
        const relative = path.relative(root, file);
        const next = [...chain, relative];
        if (forbidden.has(relative)) { violations.push(next); return; }
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false);
        for (const node of source.statements) {
            if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
            if ((ts.isExportDeclaration(node) && node.isTypeOnly) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
            if (ts.isImportDeclaration(node)) {
                const clause = node.importClause;
                if (clause?.isTypeOnly) continue;
                if (!clause?.name && clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
                    && clause.namedBindings.elements.every(specifier => specifier.isTypeOnly)) continue;
            }
            const specifier = node.moduleSpecifier.text;
            const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2))
                : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
            if (!base) continue;
            const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
                .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
            if (target && /\.tsx?$/.test(target)) visit(target, next);
        }
    }
    visit(path.join(root, entry), []);
    return violations;
}

describe('trip domain runtime ownership', () => {
    it('keeps optional generation and creation normalization outside ordinary viewing', () => {
        expect(findAuthoringPaths('components/TripView.tsx')).toEqual([]);
    });

    it('keeps the agent schemas and map customize panel out of the first trip view render', () => {
        expect(findAuthoringPaths('components/TripView.tsx', interactionOnly)).toEqual([]);
    });
});
