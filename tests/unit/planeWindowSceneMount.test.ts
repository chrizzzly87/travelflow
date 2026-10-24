import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
    path.join(process.cwd(), 'components/marketing/PlaneWindow/PlaneWindow.tsx'),
    'utf8',
);

// Static SSR output and theme behavior are covered in windowShade.browser.test.tsx.
// Keep the optional WebGL host dependency regression isolated from GPU availability.
describe('PlaneWindow cloud scene mount', () => {
    it('drives the scene effect off the host node, not render ordering', () => {
        const effectStart = source.indexOf("void import('./cloudScene')");
        expect(effectStart, 'cloud scene import not found').toBeGreaterThan(-1);

        // The dependency array that closes the effect containing that import.
        const deps = source.slice(effectStart).match(/\n\s*\}, \[([^\]]*)\]\);/);
        expect(deps, 'could not find the scene effect dependency array').not.toBeNull();
        expect(
            deps?.[1],
            'the scene effect must depend on the host node, or it runs once while the host does not exist yet and the clouds never appear',
        ).toContain('hostNode');
    });
});
