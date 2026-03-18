import { describe, expect, it } from 'vitest';

import type { ITrip, IViewSettings } from '../../types';
import { resolveDeferredTripCommitSnapshot } from '../../services/tripCommitSnapshotService';

const makeTrip = (overrides?: Partial<ITrip>): ITrip => ({
    id: 'trip-1',
    title: 'Trip',
    startDate: '2026-03-01',
    endDate: '2026-03-05',
    items: [],
    createdAt: 1,
    updatedAt: 2,
    sourceKind: 'created',
    ...overrides,
});

const makeView = (overrides?: Partial<IViewSettings>): IViewSettings => ({
    layoutMode: 'horizontal',
    timelineMode: 'calendar',
    timelineView: 'horizontal',
    mapDockMode: 'docked',
    mapStyle: 'standard',
    routeMode: 'simple',
    showCityNames: true,
    zoomLevel: 1,
    sidebarWidth: 560,
    timelineHeight: 340,
    ...overrides,
});

describe('services/tripCommitSnapshotService', () => {
    it('prefers the latest live trip snapshot for the same trip id while keeping the latest live view settings', () => {
        const pendingTrip = makeTrip({ updatedAt: 100, items: [{ id: 'city-1', type: 'city', title: 'Paris', startDateOffset: 0, duration: 2 } as any] });
        const liveTrip = makeTrip({
            updatedAt: 140,
            items: [
                { id: 'city-1', type: 'city', title: 'Paris', startDateOffset: 0, duration: 2 } as any,
                { id: 'city-2', type: 'city', title: 'Berlin', startDateOffset: 2, duration: 2 } as any,
            ],
        });
        const pendingView = makeView({ mapStyle: 'standard' });
        const liveView = makeView({ mapStyle: 'satellite', mapDockMode: 'floating' });

        expect(resolveDeferredTripCommitSnapshot({
            pendingTrip,
            liveTrip,
            pendingView,
            liveView,
        })).toEqual({
            trip: liveTrip,
            view: liveView,
        });
    });

    it('keeps the pending trip snapshot when the live trip is older or belongs to another trip', () => {
        const pendingTrip = makeTrip({ updatedAt: 200 });
        const olderLiveTrip = makeTrip({ updatedAt: 120 });
        const otherTrip = makeTrip({ id: 'trip-2', updatedAt: 400 });
        const pendingView = makeView({ mapStyle: 'dark' });

        expect(resolveDeferredTripCommitSnapshot({
            pendingTrip,
            liveTrip: olderLiveTrip,
            pendingView,
            liveView: undefined,
        })).toEqual({
            trip: pendingTrip,
            view: pendingView,
        });

        expect(resolveDeferredTripCommitSnapshot({
            pendingTrip,
            liveTrip: otherTrip,
            pendingView,
            liveView: undefined,
        })).toEqual({
            trip: pendingTrip,
            view: pendingView,
        });
    });
});
