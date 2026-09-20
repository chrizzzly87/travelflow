import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
    path.join(process.cwd(), 'components/marketing/PlaneWindow/PlaneWindow.tsx'),
    'utf8',
);

/**
 * A structural test, deliberately.
 *
 * The bug: PlaneWindow renders `null` until it has mounted, so it can never be
 * captured into prerendered HTML. That means on the first pass there is no host
 * element, and the effect that creates the cloud scene bails. With an empty
 * dependency array it then never ran again, so the scene never mounted at all
 * and the window kept its static fallback forever — shipped and live before it
 * was noticed.
 *
 * This cannot be covered behaviourally here: the effect also requires a WebGL
 * context, and jsdom has none, so a rendering test would bail for the same
 * reason whether or not the bug is present and would pass either way. Asserting
 * the dependency directly is the honest way to pin it.
 */
describe('PlaneWindow cloud scene mount', () => {
    it('renders nothing until mounted, so it cannot reach prerendered HTML', () => {
        expect(source).toContain('if (!mounted || !isHomePathname()) return null;');
    });

    it('re-runs the scene effect once the host element exists', () => {
        const effectStart = source.indexOf("void import('./cloudScene')");
        expect(effectStart, 'cloud scene import not found').toBeGreaterThan(-1);

        // The dependency array that closes the effect containing that import.
        const deps = source.slice(effectStart).match(/\n\s*\}, \[([^\]]*)\]\);/);
        expect(deps, 'could not find the scene effect dependency array').not.toBeNull();
        expect(
            deps?.[1],
            'the scene effect must depend on `mounted`, or it runs once while the host is still null and the clouds never appear',
        ).toContain('mounted');
    });
});
