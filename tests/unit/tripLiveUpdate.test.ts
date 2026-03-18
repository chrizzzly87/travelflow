import { describe, expect, it } from 'vitest';

import type { ITrip, ITimelineItem, IViewSettings } from '../../types';
import { syncLiveTripState } from '../../components/tripview/useTripLiveUpdate';

const makeTrip = (overrides?: Partial<ITrip>): ITrip => ({
    id: overrides?.id ?? 'trip-1',
    title: overrides?.title ?? 'Trip',
    startDate: overrides?.startDate ?? '2026-01-01',
    items: overrides?.items ?? [],
    createdAt: overrides?.createdAt ?? 1,
    updatedAt: overrides?.updatedAt ?? 1,
    defaultView: overrides?.defaultView,
});

const makeView = (overrides?: Partial<IViewSettings>): IViewSettings => ({
    layoutMode: overrides?.layoutMode ?? 'horizontal',
    timelineView: overrides?.timelineView ?? 'horizontal',
    mapStyle: overrides?.mapStyle ?? 'standard',
    zoomLevel: overrides?.zoomLevel ?? 1,
    mapDockMode: overrides?.mapDockMode ?? 'docked',
    routeMode: overrides?.routeMode ?? 'simple',
    showCityNames: overrides?.showCityNames ?? true,
    sidebarWidth: overrides?.sidebarWidth ?? 420,
    detailsWidth: overrides?.detailsWidth ?? 440,
    timelineHeight: overrides?.timelineHeight ?? 340,
});

describe('components/tripview/useTripLiveUpdate', () => {
    it('keeps the live trip ref and pending commit snapshot aligned after local edits', () => {
        const initialTrip = makeTrip({ updatedAt: 1 });
        const updatedItem: ITimelineItem = {
            id: 'travel-1',
            type: 'travel',
            title: 'Train',
            startDateOffset: 0,
            duration: 0.25,
            color: '#2563eb',
            transportMode: 'train',
        };
        const updatedTrip = makeTrip({ updatedAt: 2, items: [updatedItem] });
        const tripRef = { current: initialTrip };
        const pendingCommitRef = {
            current: {
                trip: initialTrip,
                view: makeView(),
            },
        };

        syncLiveTripState({
            tripRef,
            pendingCommitRef,
            updatedTrip,
        });

        expect(tripRef.current).toBe(updatedTrip);
        expect(pendingCommitRef.current?.trip).toBe(updatedTrip);
    });

    it('leaves unrelated pending commit payloads untouched', () => {
        const tripRef = { current: makeTrip({ id: 'trip-1' }) };
        const pendingCommitRef = {
            current: {
                trip: makeTrip({ id: 'trip-2' }),
                view: makeView(),
                skipToast: true,
            },
        };
        const updatedTrip = makeTrip({ id: 'trip-1', updatedAt: 9 });

        syncLiveTripState({
            tripRef,
            pendingCommitRef,
            updatedTrip,
        });

        expect(tripRef.current).toBe(updatedTrip);
        expect(pendingCommitRef.current?.trip.id).toBe('trip-2');
        expect(pendingCommitRef.current?.skipToast).toBe(true);
    });
});
