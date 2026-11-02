import React from 'react';

/**
 * Layout chrome inside a canvas group: comparison rows of equal-width slots.
 *
 * Elements marked `data-canvas-surface` are empty canvas: a drag that starts
 * on one pans the camera. Component previews and slot captions are not
 * surfaces, so clicks, text selection and native gestures on them stay theirs.
 */

export const CANVAS_SURFACE_ATTRIBUTE = 'data-canvas-surface';
const surface = { [CANVAS_SURFACE_ATTRIBUTE]: '' };

interface CanvasRowProps {
    /** What this row compares, e.g. "variant" or "size". */
    title: string;
    /** Narrowest a slot may get before the row wraps. */
    minSlotWidth?: number;
    children: React.ReactNode;
}

export const CanvasRow: React.FC<CanvasRowProps> = ({ title, minSlotWidth = 200, children }) => (
    <div {...surface} className="flex flex-col gap-5" data-canvas-row={title}>
        <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
        <div
            {...surface}
            className="grid gap-x-12 gap-y-10"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minSlotWidth}px), 1fr))` }}
        >
            {children}
        </div>
    </div>
);

interface CanvasSlotProps {
    /** The value under comparison, shown beneath the preview. */
    label: string;
    children: React.ReactNode;
}

export const CanvasSlot: React.FC<CanvasSlotProps> = ({ label, children }) => (
    <div {...surface} className="flex min-w-0 flex-col items-start gap-3" data-canvas-slot={label}>
        <div {...surface} className="flex w-full min-w-0 flex-wrap items-center gap-3">
            {children}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
    </div>
);

/** Vertical rhythm between the rows of one group. */
export const CanvasRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div {...surface} className="flex flex-col gap-14">{children}</div>
);
