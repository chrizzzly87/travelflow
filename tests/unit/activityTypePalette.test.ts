import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { ACTIVITY_TYPE_COLORS } from '../../shared/activityTypes';

const indexCss = fs.readFileSync(path.join(process.cwd(), 'index.css'), 'utf8');

/** Everything between `selector {` and its closing brace. */
const blockFor = (selector: string): string => {
    const start = indexCss.indexOf(`${selector} {`);
    expect(start, `${selector} block not found in index.css`).toBeGreaterThan(-1);
    return indexCss.slice(start, indexCss.indexOf('\n}', start));
};

describe('activity type palette', () => {
    const types = Object.keys(ACTIVITY_TYPE_COLORS) as Array<keyof typeof ACTIVITY_TYPE_COLORS>;

    it('uses named tokens rather than hue/step utilities chosen at the call site', () => {
        for (const type of types) {
            expect(ACTIVITY_TYPE_COLORS[type]).toBe(
                `bg-activity-${type}-bg border-activity-${type}-border text-activity-${type}-text`,
            );
        }
    });

    it('defines every token in both themes and maps it into the Tailwind theme', () => {
        const root = blockFor(':root');
        const dark = blockFor('.dark');
        const theme = blockFor('@theme inline');

        for (const type of types) {
            for (const part of ['bg', 'border', 'text'] as const) {
                expect(root, `:root is missing --tf-activity-${type}-${part}`)
                    .toContain(`--tf-activity-${type}-${part}:`);
                expect(dark, `.dark is missing --tf-activity-${type}-${part}`)
                    .toContain(`--tf-activity-${type}-${part}:`);
                // Without the @theme mapping Tailwind never generates the
                // utility, and the class silently does nothing.
                expect(theme, `@theme is missing --color-activity-${type}-${part}`)
                    .toContain(`--color-activity-${type}-${part}:`);
            }
        }
    });

    it('keeps every value solid, because these badges overlap', () => {
        // Activity pills stack with a negative margin on a timeline entry. Any
        // alpha in the fill darkens where they overlap, which reads as a
        // rendering bug rather than a design.
        const values = [blockFor(':root'), blockFor('.dark')]
            .flatMap((block) => block.split('\n'))
            .filter((line) => line.includes('--tf-activity-'));

        expect(values.length).toBeGreaterThan(0);
        for (const line of values) {
            const value = line.split(':')[1]?.trim().replace(/;$/, '') ?? '';
            expect(value, `${line.trim()} is not a solid colour`).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
    });
});
