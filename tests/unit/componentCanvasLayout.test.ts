import { describe, expect, it } from 'vitest';

import {
    DEFAULT_LAYOUT_OPTIONS,
    chooseColumnCount,
    layoutGroups,
    rectsOverlap,
} from '../../components/admin/componentCanvas/canvasLayout';

const options = { ...DEFAULT_LAYOUT_OPTIONS, columns: 3, columnWidth: 100, gapX: 20, gapY: 10 };
const sizes = [
    { id: 'a', width: 100, height: 300 },
    { id: 'b', width: 100, height: 100 },
    { id: 'c', width: 100, height: 100 },
    { id: 'd', width: 100, height: 50 },
    { id: 'e', width: 100, height: 400 },
];

const noOverlaps = (rects: ReturnType<typeof layoutGroups>['rects']) => {
    const list = Object.values(rects);
    for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
            if (rectsOverlap(list[i], list[j])) return false;
        }
    }
    return true;
};

describe('canvasLayout', () => {
    it('packs groups into the shortest column without overlaps', () => {
        const { rects, assignment } = layoutGroups(sizes, options);
        expect(assignment).toEqual({ a: 0, b: 1, c: 2, d: 1, e: 2 });
        expect(rects.d).toEqual({ x: 120, y: 110, width: 100, height: 50 });
        expect(noOverlaps(rects)).toBe(true);
    });

    it('keeps columns when a group grows, only pushing later groups down', () => {
        const first = layoutGroups(sizes, options);
        const grown = sizes.map((size) => (size.id === 'b' ? { ...size, height: 900 } : size));
        const second = layoutGroups(grown, options, first.assignment);
        expect(second.assignment).toEqual(first.assignment);
        expect(second.rects.a).toEqual(first.rects.a);
        expect(second.rects.d.x).toBe(first.rects.d.x);
        expect(second.rects.d.y).toBe(910);
        expect(noOverlaps(second.rects)).toBe(true);
    });

    it('places new groups and ignores out-of-range assignments', () => {
        const { assignment } = layoutGroups(sizes, options, { a: 7 });
        expect(assignment.a).toBe(0);
    });

    it('chooses a column count close to the target aspect', () => {
        const many = Array.from({ length: 24 }, (_, index) => ({ id: `g${index}`, width: 100, height: 100 }));
        // 24 squares of 100 with 20/10 gaps: 6 columns of 4 rows is 700 x 430.
        expect(chooseColumnCount(many, options, 16 / 10)).toBe(6);
        expect(chooseColumnCount(many.slice(0, 1), options)).toBe(1);
    });
});
