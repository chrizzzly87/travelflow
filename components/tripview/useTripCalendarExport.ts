import { useCallback } from 'react';

import type { ITrip } from '../../types';
import { trackEvent } from '../../services/analyticsService';
import {
    buildTripCalendarExport,
    downloadTripCalendarExport,
    type TripCalendarExportScope,
} from '../../services/tripCalendarExportService';
import { TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE } from './tripViewModel';

type TripCalendarExportListSource = 'trip_info_modal' | 'print_view';

interface UseTripCalendarExportOptions {
    /** The trip as shown, so the export matches what the traveller sees. */
    displayTrip: ITrip;
    tripId: string;
}

/**
 * The calendar (.ics) export actions of a trip. Holds no state and runs no
 * effects; each handler builds the bundle, downloads it and tracks the export.
 */
export const useTripCalendarExport = ({ displayTrip, tripId }: UseTripCalendarExportOptions) => {
    const handleTripCalendarExport = useCallback((
        scope: TripCalendarExportScope,
        source: 'details_panel' | TripCalendarExportListSource,
        activityId?: string,
    ) => {
        const bundle = buildTripCalendarExport({
            trip: displayTrip,
            scope,
            activityId,
        });
        if (!bundle) return;
        const downloaded = downloadTripCalendarExport(bundle);
        if (!downloaded) return;

        trackEvent(TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE[scope], {
            trip_id: tripId,
            source,
            event_count: bundle.eventCount,
            ...(activityId ? { item_id: activityId } : {}),
        });
    }, [displayTrip, tripId]);

    const handleExportSelectedActivityCalendar = useCallback((itemId: string) => {
        handleTripCalendarExport('activity', 'details_panel', itemId);
    }, [handleTripCalendarExport]);

    const handleExportActivitiesCalendar = useCallback((source: TripCalendarExportListSource) => {
        handleTripCalendarExport('activities', source);
    }, [handleTripCalendarExport]);

    const handleExportCitiesCalendar = useCallback((source: TripCalendarExportListSource) => {
        handleTripCalendarExport('cities', source);
    }, [handleTripCalendarExport]);

    const handleExportAllCalendar = useCallback((source: TripCalendarExportListSource) => {
        handleTripCalendarExport('all', source);
    }, [handleTripCalendarExport]);

    return {
        handleExportSelectedActivityCalendar,
        handleExportActivitiesCalendar,
        handleExportCitiesCalendar,
        handleExportAllCalendar,
    };
};
