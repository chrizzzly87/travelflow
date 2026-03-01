import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

export type FloatingMapSizePreset = 'sm' | 'md' | 'lg';

export interface FloatingMapPreviewState {
    mode?: 'docked' | 'floating';
    position?: { x: number; y: number };
    sizePreset?: FloatingMapSizePreset;
}

export const FLOATING_MAP_PREVIEW_STORAGE_KEY = 'tf_map_preview_state_v1';

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isValidDockMode = (value: unknown): value is 'docked' | 'floating' =>
    value === 'docked' || value === 'floating';

const isValidSizePreset = (value: unknown): value is FloatingMapSizePreset =>
    value === 'sm' || value === 'md' || value === 'lg';

export const readFloatingMapPreviewState = (): FloatingMapPreviewState => {
    try {
        const raw = readLocalStorageItem(FLOATING_MAP_PREVIEW_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const nextState: FloatingMapPreviewState = {};

        if (isValidDockMode(parsed.mode)) {
            nextState.mode = parsed.mode;
        }
        if (isValidSizePreset(parsed.sizePreset)) {
            nextState.sizePreset = parsed.sizePreset;
        }

        const position = parsed.position as Record<string, unknown> | null | undefined;
        if (position && isFiniteNumber(position.x) && isFiniteNumber(position.y)) {
            nextState.position = { x: position.x, y: position.y };
        }
        return nextState;
    } catch {
        return {};
    }
};

export const writeFloatingMapPreviewState = (partial: FloatingMapPreviewState): boolean => {
    const nextState: FloatingMapPreviewState = {
        ...readFloatingMapPreviewState(),
        ...partial,
    };
    if (partial.position) {
        nextState.position = partial.position;
    }
    try {
        return writeLocalStorageItem(FLOATING_MAP_PREVIEW_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
        return false;
    }
};
