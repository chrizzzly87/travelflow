import {
    readLocalStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
} from '../services/browserStorageService';
import {
    MAP_RUNTIME_SUBSYSTEMS,
    getSelectionForMapRuntimePreset,
    isMapImplementation,
    isMapRuntimePreset,
    type MapRuntimeOverride,
    type MapRuntimePreset,
    type MapRuntimeResolution,
    type MapRuntimeSelection,
} from '../shared/mapRuntime';

export const readStoredDebuggerBoolean = (storageKey: string, fallbackValue: boolean): boolean => {
    try {
        const raw = readLocalStorageItem(storageKey);
        if (raw === '1') return true;
        if (raw === '0') return false;
        return fallbackValue;
    } catch {
        return fallbackValue;
    }
};

export const persistStoredDebuggerBoolean = (storageKey: string, value: boolean, fallbackValue: boolean): void => {
    try {
        if (value === fallbackValue) {
            removeLocalStorageItem(storageKey);
            return;
        }
        writeLocalStorageItem(storageKey, value ? '1' : '0');
    } catch {
        // Ignore storage access issues.
    }
};

export const readStoredDebuggerString = <T extends string>(
    storageKey: string,
    allowedValues: readonly T[],
    fallbackValue: T,
): T => {
    try {
        const raw = readLocalStorageItem(storageKey);
        return allowedValues.includes(raw as T) ? (raw as T) : fallbackValue;
    } catch {
        return fallbackValue;
    }
};

export const persistStoredDebuggerString = <T extends string>(
    storageKey: string,
    value: T,
    fallbackValue: T,
): void => {
    try {
        if (value === fallbackValue) {
            removeLocalStorageItem(storageKey);
            return;
        }
        writeLocalStorageItem(storageKey, value);
    } catch {
        // Ignore storage access issues.
    }
};

const normalizeMapRuntimeDebugPreset = (
    value: unknown,
): MapRuntimePreset | 'default' | null => {
    if (value === 'default') return 'default';
    if (value === 'google') return 'google_all';
    if (value === 'mapbox_visuals') return 'mapbox_visual_google_services';
    return isMapRuntimePreset(value) ? value : null;
};

const compactMapRuntimeSelectionOverride = (
    selection: MapRuntimeSelection,
    baseSelection: MapRuntimeSelection,
): Partial<MapRuntimeSelection> => {
    const override: Partial<MapRuntimeSelection> = {};

    MAP_RUNTIME_SUBSYSTEMS.forEach((subsystem) => {
        if (selection[subsystem] !== baseSelection[subsystem]) {
            override[subsystem] = selection[subsystem];
        }
    });

    return override;
};

export const buildMapRuntimeDebugOverride = (
    command: {
        preset?: unknown;
        renderer?: unknown;
        routes?: unknown;
        locationSearch?: unknown;
        staticMaps?: unknown;
    },
    runtime: Pick<MapRuntimeResolution, 'defaultPreset' | 'requestedSelection' | 'override'>,
): MapRuntimeOverride | null => {
    const requestedPreset = normalizeMapRuntimeDebugPreset(command.preset);
    const activeOverridePreset = isMapRuntimePreset(runtime.override?.preset)
        ? runtime.override.preset
        : null;
    const basePreset = requestedPreset && requestedPreset !== 'default'
        ? requestedPreset
        : activeOverridePreset || runtime.defaultPreset;
    const baseSelection = getSelectionForMapRuntimePreset(basePreset);
    const nextRequestedSelection = requestedPreset
        ? { ...baseSelection }
        : { ...runtime.requestedSelection };

    if (isMapImplementation(command.renderer)) {
        nextRequestedSelection.renderer = command.renderer;
    }
    if (isMapImplementation(command.routes)) {
        nextRequestedSelection.routes = command.routes;
    }
    if (isMapImplementation(command.locationSearch)) {
        nextRequestedSelection.locationSearch = command.locationSearch;
    }
    if (isMapImplementation(command.staticMaps)) {
        nextRequestedSelection.staticMaps = command.staticMaps;
    }

    const selectionOverride = compactMapRuntimeSelectionOverride(nextRequestedSelection, baseSelection);
    const overridePreset = requestedPreset === null
        ? activeOverridePreset
        : requestedPreset === 'default'
            ? null
            : requestedPreset;

    if (!overridePreset && Object.keys(selectionOverride).length === 0) {
        return null;
    }

    return {
        ...(overridePreset ? { preset: overridePreset } : {}),
        ...(Object.keys(selectionOverride).length > 0 ? { selection: selectionOverride } : {}),
    };
};
