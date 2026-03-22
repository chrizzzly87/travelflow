import React from 'react';

import type { ITrip, TripWorkspaceContextSelection } from '../../../types';
import {
    buildTripWorkspaceDemoDataset,
    normalizeTripWorkspaceContextSelection,
    resolveTripWorkspaceCityStops,
    resolveTripWorkspaceDefaultContextSelection,
    type TripWorkspaceDemoDataset,
} from './tripWorkspaceDemoData';

export interface TripWorkspacePageTripMeta {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface UseTripWorkspacePageContextOptions {
    trip: ITrip;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
}

const formatTripDate = (value: string): string => {
    const [year, month, day] = value.split('-').map(Number);
    const date = [year, month, day].every((part) => Number.isFinite(part))
        ? new Date(year, month - 1, day, 12, 0, 0, 0)
        : new Date(value);

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
};

export const resolveTripWorkspaceFallbackTripMeta = (trip: ITrip): TripWorkspacePageTripMeta => {
    const cityStops = resolveTripWorkspaceCityStops(trip.items);
    const totalDays = cityStops.reduce((sum, item) => sum + Math.max(item.duration ?? 0, 0), 0);
    const cityCount = cityStops.length;
    const start = formatTripDate(trip.startDate);
    const endDate = new Date(trip.startDate);
    endDate.setDate(endDate.getDate() + Math.max(totalDays - 1, 0));
    const end = formatTripDate(endDate.toISOString().slice(0, 10));
    const totalDaysLabel = `${Math.max(totalDays, 1)}`;
    const cityLabel = cityCount === 1 ? '1 city' : `${cityCount} cities`;
    const dateRange = start === end ? start : `${start} – ${end}`;

    return {
        dateRange,
        totalDaysLabel,
        cityCount,
        distanceLabel: null,
        summaryLine: `${dateRange} • ${totalDaysLabel} days • ${cityLabel}`,
    };
};

export const useTripWorkspacePageContext = ({
    trip,
    dataset,
    contextSelection,
    onContextSelectionChange,
}: UseTripWorkspacePageContextOptions) => {
    const resolvedDataset = React.useMemo(
        () => dataset ?? buildTripWorkspaceDemoDataset(trip),
        [dataset, trip],
    );

    const normalizedContextSelection = React.useMemo(() => {
        const defaultSelection = resolveTripWorkspaceDefaultContextSelection(trip, resolvedDataset);
        return normalizeTripWorkspaceContextSelection(resolvedDataset, contextSelection ?? defaultSelection);
    }, [contextSelection, resolvedDataset, trip]);

    const [localContextSelection, setLocalContextSelection] = React.useState<TripWorkspaceContextSelection>(normalizedContextSelection);

    React.useEffect(() => {
        if (onContextSelectionChange) return;
        setLocalContextSelection(normalizedContextSelection);
    }, [normalizedContextSelection, onContextSelectionChange]);

    const handleContextSelectionChange = React.useCallback((next: TripWorkspaceContextSelection) => {
        const normalizedNext = normalizeTripWorkspaceContextSelection(resolvedDataset, next);

        if (onContextSelectionChange) {
            onContextSelectionChange(normalizedNext);
            return;
        }

        setLocalContextSelection(normalizedNext);
    }, [onContextSelectionChange, resolvedDataset]);

    const resolvedContextSelection = onContextSelectionChange
        ? normalizedContextSelection
        : localContextSelection;

    return {
        dataset: resolvedDataset,
        contextSelection: resolvedContextSelection,
        onContextSelectionChange: handleContextSelectionChange,
    };
};
