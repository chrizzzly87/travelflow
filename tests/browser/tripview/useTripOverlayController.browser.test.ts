// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTripOverlayController } from '../../../components/tripview/useTripOverlayController';

describe('useTripOverlayController', () => {
  it('resets trip-specific overlays when the active trip changes', () => {
    const { result, rerender } = renderHook(
      ({ tripId }) => useTripOverlayController({
        tripId,
        isMobileViewport: true,
      }),
      { initialProps: { tripId: 'trip-a' } },
    );

    act(() => {
      result.current.setIsHistoryOpen(true);
      result.current.setIsTripInfoOpen(true);
      result.current.setIsTripInfoHistoryExpanded(true);
      result.current.setIsMobileMapExpanded(true);
    });

    rerender({ tripId: 'trip-b' });

    expect(result.current.isHistoryOpen).toBe(true);
    expect(result.current.isTripInfoOpen).toBe(false);
    expect(result.current.isTripInfoHistoryExpanded).toBe(false);
    expect(result.current.isMobileMapExpanded).toBe(false);
  });

  it('closes the first visible overlay on Escape and preserves setter callbacks', () => {
    const prewarmTripInfoModal = vi.fn();
    const { result } = renderHook(() => useTripOverlayController({
      tripId: 'trip-a',
      isMobileViewport: true,
      prewarmTripInfoModal,
    }));

    act(() => {
      result.current.openTripInfoModal();
      result.current.setIsMobileMapExpanded((value) => !value);
      result.current.setIsHistoryOpen(true);
    });

    expect(prewarmTripInfoModal).toHaveBeenCalledTimes(1);
    expect(result.current.isHistoryOpen).toBe(true);
    expect(result.current.isTripInfoOpen).toBe(true);
    expect(result.current.isMobileMapExpanded).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.isHistoryOpen).toBe(false);
    expect(result.current.isTripInfoOpen).toBe(true);
    expect(result.current.isMobileMapExpanded).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.isTripInfoOpen).toBe(false);
    expect(result.current.isMobileMapExpanded).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.isMobileMapExpanded).toBe(false);
  });
});
