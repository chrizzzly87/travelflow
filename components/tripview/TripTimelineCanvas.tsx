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
    isMobile: boolean;
    onUpdateItems: (items: ITimelineItem[], options?: { deferCommit?: boolean }) => void;
    onToggleTaskCheckbox?: (itemId: string, taskLineNumber: number, checked: boolean) => void;
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
    selectionVisibilityKey: string;
    isDetailsPanelVisible: boolean;
    onNavigatePreviousCity: () => void;
    onNavigateNextCity: () => void;
    onToggleDetailsPanel: () => void;
}

export const TripTimelineCanvas: React.FC<TripTimelineCanvasProps> = ({
    timelineMode,
    timelineView,
    trip,
    isMobile,
    onUpdateItems,
    onToggleTaskCheckbox,
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
    selectionVisibilityKey,
    isDetailsPanelVisible,
    onNavigatePreviousCity,
    onNavigateNextCity,
    onToggleDetailsPanel,
}) => {
    if (timelineMode === 'timeline') {
        return (
            <TripTimelineListView
                trip={trip}
                selectedItemId={selectedItemId}
                onToggleTaskCheckbox={onToggleTaskCheckbox}
                onSelect={onSelect}
                selectionVisibilityKey={selectionVisibilityKey}
                enableScrollActiveCitySelection={!isMobile}
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
                    selectionVisibilityKey={selectionVisibilityKey}
                    isDetailsPanelVisible={isDetailsPanelVisible}
                    onNavigatePreviousCity={onNavigatePreviousCity}
                    onNavigateNextCity={onNavigateNextCity}
                    onToggleDetailsPanel={onToggleDetailsPanel}
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
            selectionVisibilityKey={selectionVisibilityKey}
            isDetailsPanelVisible={isDetailsPanelVisible}
            onNavigatePreviousCity={onNavigatePreviousCity}
            onNavigateNextCity={onNavigateNextCity}
            onToggleDetailsPanel={onToggleDetailsPanel}
        />
    );
};
