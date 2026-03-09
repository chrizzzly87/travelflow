import React, { Suspense, lazy } from 'react';
import { ITrip, ITimelineItem, RouteStatus } from '../../types';
import { Timeline } from '../Timeline';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { TripTimelineListView } from './TripTimelineListView';

const VerticalTimeline = lazy(() =>
    loadLazyComponentWithRecovery('VerticalTimeline', () =>
        import('../VerticalTimeline').then((module) => ({ default: module.VerticalTimeline }))
    )
);

interface TripTimelineCanvasProps {
    timelineMode: 'calendar' | 'timeline';
    timelineView: 'vertical' | 'horizontal';
    trip: ITrip;
    onUpdateItems: (items: ITimelineItem[], options?: { deferCommit?: boolean }) => void;
    onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
    selectedItemId: string | null;
    selectedCityIds: string[];
    readOnly: boolean;
    onAddCity: () => void;
    onAddActivity: (dayOffset: number) => void;
    onForceFill: (id: string) => void;
    onSwapSelectedCities: () => void;
    routeStatusById: Record<string, RouteStatus>;
    pixelsPerDay: number;
    enableExampleSharedTransition: boolean;
}

export const TripTimelineCanvas: React.FC<TripTimelineCanvasProps> = ({
    timelineMode,
    timelineView,
    trip,
    onUpdateItems,
    onSelect,
    selectedItemId,
    selectedCityIds,
    readOnly,
    onAddCity,
    onAddActivity,
    onForceFill,
    onSwapSelectedCities,
    routeStatusById,
    pixelsPerDay,
    enableExampleSharedTransition,
}) => {
    if (timelineMode === 'timeline') {
        return (
            <TripTimelineListView
                trip={trip}
                selectedItemId={selectedItemId}
                onSelect={onSelect}
            />
        );
    }

    if (timelineView === 'vertical') {
        return (
            <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-xs text-gray-500">Loading timeline...</div>}>
                <VerticalTimeline
                    trip={trip}
                    onUpdateItems={onUpdateItems}
                    onSelect={onSelect}
                    selectedItemId={selectedItemId}
                    selectedCityIds={selectedCityIds}
                    readOnly={readOnly}
                    onAddCity={onAddCity}
                    onAddActivity={onAddActivity}
                    onForceFill={onForceFill}
                    onSwapSelectedCities={onSwapSelectedCities}
                    pixelsPerDay={pixelsPerDay}
                    enableExampleSharedTransition={enableExampleSharedTransition}
                />
            </Suspense>
        );
    }

    return (
        <Timeline
            trip={trip}
            onUpdateItems={onUpdateItems}
            onSelect={onSelect}
            selectedItemId={selectedItemId}
            selectedCityIds={selectedCityIds}
            readOnly={readOnly}
            onAddCity={onAddCity}
            onAddActivity={onAddActivity}
            onForceFill={onForceFill}
            onSwapSelectedCities={onSwapSelectedCities}
            routeStatusById={routeStatusById}
            pixelsPerDay={pixelsPerDay}
            enableExampleSharedTransition={enableExampleSharedTransition}
        />
    );
};
