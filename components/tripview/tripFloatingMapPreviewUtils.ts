import { type FloatingMapSizePreset } from './floatingMapPreviewState';

const FLOATING_MAP_MIN_WIDTH = 180;
const FLOATING_MAP_MAX_WIDTH = 420;
const FLOATING_MAP_SMALL_SIZE_RATIO = 0.62;
const FLOATING_MAP_MIN_SIZE_DELTA = 90;

const clampValue = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const resolveFloatingMapPresetWidths = (baseWidth: number): Record<FloatingMapSizePreset, number> => {
    const clampedBase = clampValue(baseWidth, FLOATING_MAP_MIN_WIDTH, FLOATING_MAP_MAX_WIDTH);
    const largeWidth = Math.round(clampedBase);
    const compactMaxWidth = Math.max(
        FLOATING_MAP_MIN_WIDTH,
        largeWidth - FLOATING_MAP_MIN_SIZE_DELTA,
    );
    const compactWidth = Math.round(clampValue(
        largeWidth * FLOATING_MAP_SMALL_SIZE_RATIO,
        FLOATING_MAP_MIN_WIDTH,
        compactMaxWidth,
    ));
    const middleWidth = Math.round((compactWidth + largeWidth) / 2);

    return {
        sm: compactWidth,
        md: middleWidth,
        lg: largeWidth,
    };
};
