/**
 * Group placement for the component canvas.
 *
 * Groups are measured, not hard-coded: each one reports its real size (title,
 * border and padding included) and is stacked into a column. A group's column
 * is chosen once, the first time every group has a size, and kept from then
 * on. Later growth (an accordion opening, a font loading) only pushes the
 * groups below it down the same column, so nothing jumps sideways and two
 * groups can never overlap.
 */
import type { CanvasRect } from './canvasCamera';

export interface GroupSize {
    id: string;
    width: number;
    height: number;
}

export interface CanvasLayoutOptions {
    columns: number;
    columnWidth: number;
    gapX: number;
    gapY: number;
}

export interface CanvasLayoutResult {
    rects: Record<string, CanvasRect>;
    /** Column per group id, to feed back in so later passes keep it. */
    assignment: Record<string, number>;
}

export const DEFAULT_LAYOUT_OPTIONS: CanvasLayoutOptions = {
    columns: 3,
    columnWidth: 1040,
    gapX: 160,
    gapY: 136,
};

/**
 * `sizes` is in display order. Groups missing from `previousAssignment` go to
 * whichever column is currently shortest.
 */
export const layoutGroups = (
    sizes: GroupSize[],
    options: CanvasLayoutOptions = DEFAULT_LAYOUT_OPTIONS,
    previousAssignment: Record<string, number> = {},
): CanvasLayoutResult => {
    const columns = Math.max(1, Math.floor(options.columns));
    const columnHeights = new Array<number>(columns).fill(0);
    const rects: Record<string, CanvasRect> = {};
    const assignment: Record<string, number> = {};

    for (const size of sizes) {
        const kept = previousAssignment[size.id];
        const column = kept !== undefined && kept >= 0 && kept < columns
            ? kept
            : columnHeights.indexOf(Math.min(...columnHeights));
        const y = columnHeights[column];
        const height = Math.max(0, size.height);
        rects[size.id] = {
            x: column * (options.columnWidth + options.gapX),
            y,
            width: Math.max(0, size.width),
            height,
        };
        assignment[size.id] = column;
        columnHeights[column] = y + height + options.gapY;
    }

    return { rects, assignment };
};

/**
 * The column count whose packed layout comes closest to `targetAspect`
 * (width / height). Called once, with the first complete set of sizes; the
 * count is then kept so later growth never reshuffles the groups.
 */
export const chooseColumnCount = (
    sizes: GroupSize[],
    options: Omit<CanvasLayoutOptions, 'columns'>,
    targetAspect = 16 / 10,
    maxColumns = 8,
): number => {
    let best = 1;
    let bestScore = Infinity;
    for (let columns = 1; columns <= Math.max(1, Math.min(maxColumns, sizes.length)); columns += 1) {
        const { rects } = layoutGroups(sizes, { ...options, columns });
        const height = Math.max(...Object.values(rects).map((rect) => rect.y + rect.height), 1);
        const width = columns * options.columnWidth + (columns - 1) * options.gapX;
        const score = Math.abs(Math.log((width / height) / targetAspect));
        if (score < bestScore) {
            best = columns;
            bestScore = score;
        }
    }
    return best;
};

export const rectsOverlap =(a: CanvasRect, b: CanvasRect): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
