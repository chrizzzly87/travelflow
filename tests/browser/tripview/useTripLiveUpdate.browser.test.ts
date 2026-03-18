// @vitest-environment jsdom
import { useCallback, useRef, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTripItemUpdateHandlers } from '../../../components/tripview/useTripItemUpdateHandlers';
import { useTripLiveUpdate } from '../../../components/tripview/useTripLiveUpdate';
import { useTripRouteStatusState } from '../../../components/tripview/useTripRouteStatusState';
import { useTripUpdateItemsHandler } from '../../../components/tripview/useTripUpdateItemsHandler';
import type { ITrip, IViewSettings } from '../../../types';
import { buildRouteCacheKey } from '../../../utils';
import { makeCityItem, makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

const VIEW_SETTINGS: IViewSettings = {
  layoutMode: 'horizontal',
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  mapStyle: 'standard',
  zoomLevel: 1,
  zoomBehavior: 'fit',
  mapDockMode: 'docked',
};

const buildTrip = (): ITrip => {
  const fromCity = makeCityItem({
    id: 'city-a',
    title: 'Berlin',
    startDateOffset: 0,
    duration: 2,
    coordinates: { lat: 52.52, lng: 13.405 },
  });
  const travel = {
    ...makeTravelItem('travel-1', 2, 'Berlin to Munich'),
    transportMode: 'train' as const,
    routeDistanceKm: 505,
    routeDurationHours: 4,
  };
  const toCity = makeCityItem({
    id: 'city-b',
    title: 'Munich',
    startDateOffset: 2.2,
    duration: 2,
    coordinates: { lat: 48.137, lng: 11.575 },
  });

  return makeTrip({
    id: 'trip-live-update',
    startDate: '2026-03-01',
    items: [fromCity, travel, toCity],
  });
};

const useTransportRaceHarness = (initialTrip: ITrip) => {
  const [trip, setTrip] = useState(initialTrip);
  const tripRef = useRef(trip);
  const pendingCommitRef = useRef<{ trip: ITrip; view: IViewSettings; skipToast?: boolean } | null>({
    trip,
    view: VIEW_SETTINGS,
  });
  const pendingHistoryLabelRef = useRef<string | null>(null);
  tripRef.current = trip;

  const markUserEdit = useCallback(() => {}, []);
  const setPendingLabel = useCallback((label: string) => {
    pendingHistoryLabelRef.current = label;
  }, []);

  const { safeUpdateTrip } = useTripLiveUpdate({
    tripRef,
    pendingCommitRef,
    requireEdit: () => true,
    onUpdateTrip: (updatedTrip) => {
      setTrip(updatedTrip);
    },
  });

  const scheduleCommit = useCallback((nextTrip?: ITrip, nextView?: IViewSettings) => {
    pendingCommitRef.current = {
      trip: nextTrip ?? tripRef.current,
      view: nextView ?? VIEW_SETTINGS,
    };
  }, []);

  const handleUpdateItems = useTripUpdateItemsHandler({
    trip,
    currentViewSettings: VIEW_SETTINGS,
    markUserEdit,
    safeUpdateTrip,
    setPendingLabel,
    pendingHistoryLabelRef,
    scheduleCommit,
    normalizeOffsetsForTrip: (items, startDate) => ({
      items,
      startDate,
      shiftedDays: 0,
    }),
  });

  const {
    clearRouteStatusForItem,
    handleRouteMetrics,
  } = useTripRouteStatusState({
    tripRef,
    pendingCommitRef,
    onUpdateTrip: (updatedTrip) => {
      setTrip(updatedTrip);
    },
  });

  const { handleUpdateItem } = useTripItemUpdateHandlers({
    trip,
    cityColorPaletteId: 'default',
    mapColorMode: 'trip',
    currentViewSettings: VIEW_SETTINGS,
    requireEdit: () => true,
    markUserEdit,
    setPendingLabel,
    handleUpdateItems,
    clearRouteStatusForItem,
    safeUpdateTrip,
    scheduleCommit,
  });

  return {
    trip,
    pendingCommitRef,
    handleUpdateItem,
    handleRouteMetrics,
  };
};

describe('components/tripview/useTripLiveUpdate', () => {
  it('keeps a transport mode change when stale route metrics arrive before React rerenders', () => {
    const trip = buildTrip();
    const trainRouteKey = buildRouteCacheKey(
      { lat: 52.52, lng: 13.405 },
      { lat: 48.137, lng: 11.575 },
      'train',
    );

    const { result } = renderHook(() => useTransportRaceHarness(trip));

    act(() => {
      result.current.handleUpdateItem('travel-1', { transportMode: 'bus' });
      result.current.handleRouteMetrics('travel-1', {
        mode: 'train',
        routeKey: trainRouteKey,
        routeDistanceKm: 999,
        routeDurationHours: 12,
      });
    });

    const updatedTravelItem = result.current.trip.items.find((item) => item.id === 'travel-1');
    const pendingTravelItem = result.current.pendingCommitRef.current?.trip.items.find((item) => item.id === 'travel-1');

    expect(updatedTravelItem).toMatchObject({
      id: 'travel-1',
      transportMode: 'bus',
      routeDistanceKm: undefined,
      routeDurationHours: undefined,
    });
    expect(pendingTravelItem).toMatchObject({
      id: 'travel-1',
      transportMode: 'bus',
      routeDistanceKm: undefined,
      routeDurationHours: undefined,
    });
  });
});
