import type { IViewSettings } from '../../types';

export type ZoomChangeSource = 'manual' | 'auto' | null;

const VISUAL_PREFIX_PATTERN = /^Visual:\s*/i;
const VISUAL_CHANGE_SEPARATOR = ' · ';

const mergeVisualSegments = (existingLabel: string | null, nextSegments: string[]): string[] => {
    const merged: string[] = [];
    const seen = new Set<string>();
    const pushUnique = (value: string) => {
        const normalized = value.trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        merged.push(normalized);
    };

    if (existingLabel && VISUAL_PREFIX_PATTERN.test(existingLabel)) {
        existingLabel
            .replace(VISUAL_PREFIX_PATTERN, '')
            .split(VISUAL_CHANGE_SEPARATOR)
            .forEach(pushUnique);
    }

    nextSegments.forEach(pushUnique);
    return merged;
};

export const buildVisualHistoryLabel = (
    existingLabel: string | null,
    nextSegments: string[],
): string | null => {
    if (nextSegments.length === 0) return null;
    const merged = mergeVisualSegments(existingLabel, nextSegments);
    if (merged.length === 0) return null;
    return `Visual: ${merged.join(VISUAL_CHANGE_SEPARATOR)}`;
};

interface ResolveVisualDiffOptions {
    previous: IViewSettings;
    current: IViewSettings;
    zoomChangeSource: ZoomChangeSource;
    resolveMapDockModeLabel?: (from: 'docked' | 'floating', to: 'docked' | 'floating') => string;
}

interface ResolveVisualDiffResult {
    changes: string[];
    didZoomChange: boolean;
    isAutoZoomOnlyChange: boolean;
}

export const resolveVisualDiff = ({
    previous,
    current,
    zoomChangeSource,
    resolveMapDockModeLabel,
}: ResolveVisualDiffOptions): ResolveVisualDiffResult => {
    const changes: string[] = [];
    if (previous.mapStyle !== current.mapStyle) changes.push(`Map view: ${previous.mapStyle} → ${current.mapStyle}`);
    if (previous.routeMode !== current.routeMode) changes.push(`Route view: ${previous.routeMode} → ${current.routeMode}`);
    if (previous.showCityNames !== current.showCityNames) {
        changes.push(`City names: ${previous.showCityNames ? 'on' : 'off'} → ${current.showCityNames ? 'on' : 'off'}`);
    }
    if (previous.layoutMode !== current.layoutMode) changes.push(`Map layout: ${previous.layoutMode} → ${current.layoutMode}`);
    const previousMapDockMode = previous.mapDockMode ?? 'docked';
    const currentMapDockMode = current.mapDockMode ?? 'docked';
    if (previousMapDockMode !== currentMapDockMode) {
        changes.push(resolveMapDockModeLabel
            ? resolveMapDockModeLabel(previousMapDockMode, currentMapDockMode)
            : `Map preview: ${previousMapDockMode} → ${currentMapDockMode}`);
    }
    if ((previous.timelineMode || 'calendar') !== current.timelineMode) {
        changes.push(`Timeline mode: ${previous.timelineMode || 'calendar'} → ${current.timelineMode}`);
    }
    if (previous.timelineView !== current.timelineView) changes.push(`Timeline layout: ${previous.timelineView} → ${current.timelineView}`);

    const didZoomChange = previous.zoomLevel !== current.zoomLevel;
    if (didZoomChange && zoomChangeSource !== 'auto') {
        changes.push(current.zoomLevel > previous.zoomLevel ? 'Zoomed in' : 'Zoomed out');
    }

    return {
        changes,
        didZoomChange,
        isAutoZoomOnlyChange: didZoomChange && zoomChangeSource === 'auto' && changes.length === 0,
    };
};
