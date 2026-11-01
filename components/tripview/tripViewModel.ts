import type React from 'react';

import type { ITimelineItem, ITrip } from '../../types';
import type { TripCalendarExportScope } from '../../services/tripCalendarExportService';
import { DEFAULT_DISTANCE_UNIT, formatDistance, getTripDistanceKm } from '../../utils';
import { getTripSpan } from '../../shared/tripSpan';

// Pure constants and helpers for TripView. Nothing in this module may read
// React context or hold state: TripView renders its own providers, so anything
// context-aware has to stay inside the component tree.

export const TRIP_AGENT_PANEL_INSET_PX = 444;

export const MIN_SIDEBAR_WIDTH = 300;
export const MIN_TIMELINE_HEIGHT = 200;
export const MIN_BOTTOM_MAP_HEIGHT = 200;
export const MIN_MAP_WIDTH = 320;
export const MIN_TIMELINE_COLUMN_WIDTH = 420;
export const MIN_DETAILS_WIDTH = 400;
export const HARD_MIN_DETAILS_WIDTH = 300;
export const DEFAULT_DETAILS_WIDTH = 480;
export const RESIZE_KEYBOARD_STEP = 16;
export const RESIZER_WIDTH = 4;
export const MIN_ZOOM_LEVEL = 0.2;
export const MAX_ZOOM_LEVEL = 3;
export const HORIZONTAL_TIMELINE_AUTO_FIT_PADDING = 72;
export const VERTICAL_TIMELINE_AUTO_FIT_PADDING = 56;
export const TIMELINE_ZOOM_LEVEL_PRESETS = [
    0.2,
    0.4,
    0.6,
    0.8,
    1,
    1.2,
    1.4,
    1.6,
    1.8,
    2,
    2.2,
    2.4,
    2.6,
    2.8,
    3,
];
const NEGATIVE_OFFSET_EPSILON = 0.001;
export const MOBILE_VIEWPORT_MAX_WIDTH = 767;
export const VIEW_TRANSITION_DEBUG_EVENT = 'tf:view-transition-debug';
export const GENERATION_PROGRESS_MESSAGES = [
    'Analyzing your travel preferences...',
    'Scouting top-rated cities and stops...',
    'Calculating optimal travel routes...',
    'Structuring your daily timeline...',
    'Finalizing logistics and details...',
];
export const TRIP_GENERATION_POLL_INTERVAL_MS = 8_000;
export const TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS = 30_000;
export const TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE: Record<
    TripCalendarExportScope,
    'trip_view__calendar_export--activity' | 'trip_view__calendar_export--activities' | 'trip_view__calendar_export--cities' | 'trip_view__calendar_export--all'
> = {
    activity: 'trip_view__calendar_export--activity',
    activities: 'trip_view__calendar_export--activities',
    cities: 'trip_view__calendar_export--cities',
    all: 'trip_view__calendar_export--all',
};

export interface ViewTransitionDebugDetail {
    phase: string;
    templateId?: string;
    useExampleSharedTransition?: boolean;
    expectedCityLaneCount?: number;
    reason?: string;
}

export const isPlainLeftClick = (event: React.MouseEvent<HTMLAnchorElement>): boolean => (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
);

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void | Promise<void>) => unknown;
};

export const runWithOptionalViewTransition = (update: () => void): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        update();
        return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        update();
        return;
    }
    const transitionDocument = document as ViewTransitionDocument;
    if (typeof transitionDocument.startViewTransition !== 'function') {
        update();
        return;
    }
    transitionDocument.startViewTransition(() => {
        update();
    });
};

export const parseTripStartDate = (value: string): Date => {
    if (!value) return new Date();
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every(part => Number.isFinite(part))) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatTripDateValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const normalizeNegativeOffsetsForTrip = (
    items: ITimelineItem[],
    startDate: string
): { items: ITimelineItem[]; startDate: string; shiftedDays: number } => {
    let minStart = Number.POSITIVE_INFINITY;

    items.forEach(item => {
        if (!Number.isFinite(item.startDateOffset)) return;
        minStart = Math.min(minStart, item.startDateOffset);
    });

    if (!Number.isFinite(minStart) || minStart >= -NEGATIVE_OFFSET_EPSILON) {
        return { items, startDate, shiftedDays: 0 };
    }

    const shiftedDays = Math.ceil(-minStart);
    if (shiftedDays <= 0) {
        return { items, startDate, shiftedDays: 0 };
    }

    const shiftedItems = items.map(item => {
        if (!Number.isFinite(item.startDateOffset)) return item;
        return { ...item, startDateOffset: item.startDateOffset + shiftedDays };
    });

    const nextStartDate = parseTripStartDate(startDate);
    nextStartDate.setDate(nextStartDate.getDate() - shiftedDays);

    return {
        items: shiftedItems,
        startDate: formatTripDateValue(nextStartDate),
        shiftedDays,
    };
};

export interface TripMetaSummary {
    dateRange: string;
    days: number;
    nights: number;
    compactSpanLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

export interface TripTravelerWarningSummary {
    cityName: string;
    notes: string[];
}

export const buildTripMetaSummary = (trip: ITrip): TripMetaSummary => {
    const cityItems = trip.items
        .filter((item) => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);
    const cityCount = cityItems.length;
    const tripSpan = getTripSpan(trip);
    const days = tripSpan.days;
    const nights = tripSpan.nights;
    const startDate = tripSpan.startDate;
    const endDate = tripSpan.endDate;

    const formatDate = (value: Date) => value.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const dateRange = startDate.toDateString() === endDate.toDateString()
        ? formatDate(startDate)
        : `${formatDate(startDate)} – ${formatDate(endDate)}`;

    const citiesLabel = cityCount === 1 ? '1 city' : `${cityCount} cities`;
    const totalDistanceKm = getTripDistanceKm(trip.items);
    const distanceLabel = totalDistanceKm > 0
        ? formatDistance(totalDistanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 0 })
        : null;
    const distancePart = distanceLabel ? ` • ${distanceLabel}` : '';

    return {
        dateRange,
        days,
        nights,
        compactSpanLabel: tripSpan.compactLabel,
        cityCount,
        distanceLabel,
        summaryLine: `${dateRange} • ${tripSpan.compactLabel} • ${citiesLabel}${distancePart}`,
    };
};

const HEADS_UP_SECTION_REGEX = /### Heads Up\s*([\s\S]*?)(?=\n###\s|\s*$)/i;

export const extractTripTravelerWarnings = (items: ITimelineItem[]): TripTravelerWarningSummary[] => (
    items.reduce<TripTravelerWarningSummary[]>((warnings, item) => {
        if (item.type !== 'city') return warnings;
        const description = typeof item.description === 'string' ? item.description.trim() : '';
        if (!description) return warnings;

        const match = description.match(HEADS_UP_SECTION_REGEX);
        if (!match) return warnings;

        const notes: string[] = [];
        for (const rawLine of match[1].split('\n')) {
            const note = rawLine.trim().replace(/^- \[[ xX]\]\s*/, '').replace(/^-+\s*/, '').trim();
            if (note) {
                notes.push(note);
            }
        }
        if (notes.length === 0) return warnings;

        warnings.push({
            cityName: item.title || item.location || 'Stop',
            notes,
        });
        return warnings;
    }, [])
);
