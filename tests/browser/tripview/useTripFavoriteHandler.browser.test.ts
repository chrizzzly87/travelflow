// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTripFavoriteHandler } from '../../../components/tripview/useTripFavoriteHandler';
import { makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/useTripFavoriteHandler', () => {
  it('suppresses commit toast when favorite toggle already showed an action toast', () => {
    const trip = makeTrip({
      id: 'trip-1',
      isFavorite: false,
      updatedAt: 100,
    });

    const currentViewSettings = {
      layoutMode: 'vertical' as const,
      timelineView: 'vertical' as const,
      mapStyle: 'standard' as const,
      routeMode: 'driving' as const,
      showCityNames: true,
      zoomLevel: 1,
    };

    const markUserEdit = vi.fn();
    const setPendingLabel = vi.fn();
    const safeUpdateTrip = vi.fn();
    const scheduleCommit = vi.fn();
    const showToast = vi.fn();

    const { result } = renderHook(() => useTripFavoriteHandler({
      trip,
      currentViewSettings,
      requireEdit: () => true,
      markUserEdit,
      setPendingLabel,
      safeUpdateTrip,
      scheduleCommit,
      showToast,
    }));

    act(() => {
      result.current.handleToggleFavorite();
    });

    expect(markUserEdit).toHaveBeenCalledTimes(1);
    expect(setPendingLabel).toHaveBeenCalledWith('Data: Added to favorites');
    expect(safeUpdateTrip).toHaveBeenCalledWith(expect.objectContaining({
      id: 'trip-1',
      isFavorite: true,
    }), { persist: true });
    expect(scheduleCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'trip-1',
        isFavorite: true,
      }),
      currentViewSettings,
      { skipToast: true }
    );
    expect(showToast).toHaveBeenCalledWith('Trip added to favorites', {
      tone: 'add',
      title: 'Added',
    });
  });
});
