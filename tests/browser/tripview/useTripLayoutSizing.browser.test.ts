// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDockedPaneRebalance,
  useTripLayoutSizing,
} from '../../../components/tripview/useTripLayoutSizing';
import { useTripResizeControls } from '../../../components/tripview/useTripResizeControls';
import {
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  RESIZER_WIDTH,
} from '../../../components/tripview/tripViewModel';

const setInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
};

describe('components/tripview/useTripLayoutSizing', () => {
  const renderSizing = (tripId = 'trip-1') => {
    const setZoomBehavior = vi.fn();
    const hook = renderHook(
      ({ id }: { id: string }) => useTripLayoutSizing({ tripId: id, setZoomBehavior }),
      { initialProps: { id: tripId } },
    );
    return { ...hook, setZoomBehavior };
  };

  it('clamps zoom levels to the supported range and maps non-finite values to 1', () => {
    const { result } = renderSizing();
    const { clampZoomLevel } = result.current;

    expect(clampZoomLevel(0.01)).toBe(MIN_ZOOM_LEVEL);
    expect(clampZoomLevel(99)).toBe(MAX_ZOOM_LEVEL);
    expect(clampZoomLevel(1.3)).toBe(1.3);
    expect(clampZoomLevel(Number.NaN)).toBe(1);
    expect(clampZoomLevel(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('steps zoom through the presets and stops at either end', () => {
    const { result } = renderSizing();
    const { resolveSteppedZoomLevel } = result.current;

    expect(resolveSteppedZoomLevel(1, 'in')).toBe(1.2);
    expect(resolveSteppedZoomLevel(1, 'out')).toBe(0.8);
    expect(resolveSteppedZoomLevel(1.1, 'in')).toBe(1.2);
    expect(resolveSteppedZoomLevel(1.1, 'out')).toBe(1);
    expect(resolveSteppedZoomLevel(MAX_ZOOM_LEVEL, 'in')).toBe(MAX_ZOOM_LEVEL);
    expect(resolveSteppedZoomLevel(MIN_ZOOM_LEVEL, 'out')).toBe(MIN_ZOOM_LEVEL);
  });

  it('marks a manual zoom as dirty and flags both persist refs', () => {
    const { result, setZoomBehavior } = renderSizing();
    expect(result.current.isZoomDirty).toBe(false);

    act(() => {
      result.current.markZoomDirty();
    });

    expect(result.current.isZoomDirty).toBe(true);
    expect(setZoomBehavior).toHaveBeenCalledWith('manual');
    expect(result.current.zoomChangeSourceRef.current).toBe('manual');
    expect(result.current.pendingManualViewSettingsPersistRef.current).toBe(true);
    expect(result.current.pendingManualVisualCommitRef.current).toBe(true);
  });

  it('records an auto zoom source without marking the zoom dirty or persisting', () => {
    const { result, setZoomBehavior } = renderSizing();

    act(() => {
      result.current.markZoomDirty('auto');
    });

    expect(result.current.isZoomDirty).toBe(false);
    expect(setZoomBehavior).not.toHaveBeenCalled();
    expect(result.current.zoomChangeSourceRef.current).toBe('auto');
    expect(result.current.pendingManualViewSettingsPersistRef.current).toBe(false);
    expect(result.current.pendingManualVisualCommitRef.current).toBe(false);
  });

  it('switches back to fit zoom on an auto-fit change', () => {
    const { result, setZoomBehavior } = renderSizing();

    act(() => {
      result.current.markAutoFitZoomChange();
    });

    expect(setZoomBehavior).toHaveBeenCalledWith('fit');
    expect(result.current.zoomChangeSourceRef.current).toBe('auto');
    expect(result.current.isZoomDirty).toBe(false);
  });

  it('flags both persist refs on a manual view change', () => {
    const { result } = renderSizing();

    result.current.markManualViewChange();

    expect(result.current.pendingManualViewSettingsPersistRef.current).toBe(true);
    expect(result.current.pendingManualVisualCommitRef.current).toBe(true);
  });

  it('resets zoom dirtiness and the persist refs when the trip changes', () => {
    const { result, rerender } = renderSizing('trip-1');
    act(() => {
      result.current.markZoomDirty();
    });
    result.current.paneLayoutCustomizedRef.current = true;

    rerender({ id: 'trip-2' });

    expect(result.current.isZoomDirty).toBe(false);
    expect(result.current.zoomChangeSourceRef.current).toBeNull();
    expect(result.current.pendingManualViewSettingsPersistRef.current).toBe(false);
    expect(result.current.pendingManualVisualCommitRef.current).toBe(false);
    // TripView never reset the pane flag on a trip change; that stays as it was.
    expect(result.current.paneLayoutCustomizedRef.current).toBe(true);
  });

  it('keeps zoom dirtiness and pending persists across renders of the same trip', () => {
    const { result, rerender } = renderSizing('trip-1');
    act(() => {
      result.current.markZoomDirty();
    });

    rerender({ id: 'trip-1' });

    expect(result.current.isZoomDirty).toBe(true);
    expect(result.current.pendingManualViewSettingsPersistRef.current).toBe(true);
    expect(result.current.pendingManualVisualCommitRef.current).toBe(true);
  });

  it('keeps every ref and callback identity stable across renders and trip changes', () => {
    const { result, rerender } = renderSizing('trip-1');
    const first = result.current;

    act(() => {
      result.current.markZoomDirty();
    });
    rerender({ id: 'trip-2' });

    expect(result.current.markManualViewChange).toBe(first.markManualViewChange);
    expect(result.current.markZoomDirty).toBe(first.markZoomDirty);
    expect(result.current.markAutoFitZoomChange).toBe(first.markAutoFitZoomChange);
    expect(result.current.clampZoomLevel).toBe(first.clampZoomLevel);
    expect(result.current.resolveSteppedZoomLevel).toBe(first.resolveSteppedZoomLevel);
    expect(result.current.pendingManualViewSettingsPersistRef).toBe(first.pendingManualViewSettingsPersistRef);
    expect(result.current.pendingManualVisualCommitRef).toBe(first.pendingManualVisualCommitRef);
    expect(result.current.paneLayoutCustomizedRef).toBe(first.paneLayoutCustomizedRef);
    expect(result.current.zoomChangeSourceRef).toBe(first.zoomChangeSourceRef);
  });
});

describe('components/tripview/useDockedPaneRebalance', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    setInnerWidth(1204);
  });

  afterEach(() => {
    setInnerWidth(originalInnerWidth);
  });

  type RebalanceProps = Parameters<typeof useDockedPaneRebalance>[0];

  const renderRebalance = (overrides: Partial<RebalanceProps> = {}) => {
    const paneLayoutCustomizedRef = { current: false };
    const props: RebalanceProps = {
      isMobile: false,
      effectiveLayoutMode: 'horizontal',
      effectiveMapDockMode: 'docked',
      detailsPanelVisible: true,
      paneLayoutCustomizedRef,
      clampDetailsWidth: vi.fn((width: number) => width),
      clampSidebarWidth: vi.fn((width: number) => width),
      setDetailsWidth: vi.fn(),
      setSidebarWidth: vi.fn(),
      ...overrides,
    };
    const hook = renderHook((current: RebalanceProps) => useDockedPaneRebalance(current), { initialProps: props });
    return { ...hook, props };
  };

  it('splits the window into three panes when the details panel is open', () => {
    const { props } = renderRebalance({
      clampDetailsWidth: vi.fn(() => 380),
    });
    const target = Math.floor((1204 - RESIZER_WIDTH * 2) / 3);

    expect(props.clampDetailsWidth).toHaveBeenCalledWith(target);
    expect(props.clampSidebarWidth).toHaveBeenCalledWith(target, 380);
    expect(props.setDetailsWidth).toHaveBeenCalledWith(380);
    expect(props.setSidebarWidth).toHaveBeenCalledWith(target);
  });

  it('splits the window into two panes when the details panel is closed', () => {
    const { props } = renderRebalance({ detailsPanelVisible: false });
    const target = Math.floor((1204 - RESIZER_WIDTH) / 2);

    expect(props.clampSidebarWidth).toHaveBeenCalledWith(target, 0);
    expect(props.setSidebarWidth).toHaveBeenCalledWith(target);
    expect(props.setDetailsWidth).not.toHaveBeenCalled();
  });

  it('applies the clamped widths, not the raw split', () => {
    const { props } = renderRebalance({
      clampDetailsWidth: vi.fn(() => 300),
      clampSidebarWidth: vi.fn(() => 420),
    });

    expect(props.setDetailsWidth).toHaveBeenCalledWith(300);
    expect(props.setSidebarWidth).toHaveBeenCalledWith(420);
  });

  it.each([
    ['on mobile', { isMobile: true }],
    ['in the vertical layout', { effectiveLayoutMode: 'vertical' as const }],
    ['with a floating map', { effectiveMapDockMode: 'floating' as const }],
  ])('leaves the panes alone %s', (_label, overrides) => {
    const { props } = renderRebalance(overrides);

    expect(props.setSidebarWidth).not.toHaveBeenCalled();
    expect(props.setDetailsWidth).not.toHaveBeenCalled();
  });

  it('leaves the panes alone once the traveller has resized one', () => {
    const paneLayoutCustomizedRef = { current: true };
    const { props } = renderRebalance({ paneLayoutCustomizedRef });

    expect(props.setSidebarWidth).not.toHaveBeenCalled();
    expect(props.setDetailsWidth).not.toHaveBeenCalled();
  });

  it('rebalances on window resize and stops listening after unmount', () => {
    const { props, unmount } = renderRebalance({ detailsPanelVisible: false });
    vi.mocked(props.setSidebarWidth).mockClear();

    setInnerWidth(1004);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(props.setSidebarWidth).toHaveBeenCalledWith(Math.floor((1004 - RESIZER_WIDTH) / 2));

    unmount();
    vi.mocked(props.setSidebarWidth).mockClear();
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(props.setSidebarWidth).not.toHaveBeenCalled();
  });

  it('keeps the rebalanced panes inside the resize-control clamps', () => {
    setInnerWidth(1000);
    const { result } = renderHook(() => {
      const [sidebarWidth, setSidebarWidth] = useState(550);
      const [detailsWidth, setDetailsWidth] = useState(480);
      const [timelineHeight, setTimelineHeight] = useState(400);
      const paneLayoutCustomizedRef = useRef(false);
      const { clampDetailsWidth, clampSidebarWidth } = useTripResizeControls({
        isMobile: false,
        layoutMode: 'horizontal',
        mapDockMode: 'docked',
        timelineMode: 'calendar',
        timelineView: 'horizontal',
        zoomLevel: 1,
        zoomBehavior: 'fit',
        isZoomDirty: false,
        clampZoomLevel: (value: number) => value,
        setZoomLevel: vi.fn(),
        sidebarWidth,
        setSidebarWidth,
        detailsWidth,
        setDetailsWidth,
        timelineHeight,
        setTimelineHeight,
        detailsPanelVisible: true,
        minSidebarWidth: 320,
        minTimelineHeight: 200,
        minBottomMapHeight: 200,
        minMapWidth: 360,
        minTimelineColumnWidth: 420,
        minDetailsWidth: 360,
        hardMinDetailsWidth: 300,
        resizerWidth: RESIZER_WIDTH,
        resizeKeyboardStep: 16,
        horizontalTimelineAutoFitPadding: 72,
        verticalTimelineAutoFitPadding: 56,
        zoomLevelPresets: [1],
      });
      useDockedPaneRebalance({
        isMobile: false,
        effectiveLayoutMode: 'horizontal',
        effectiveMapDockMode: 'docked',
        detailsPanelVisible: true,
        paneLayoutCustomizedRef,
        clampDetailsWidth,
        clampSidebarWidth,
        setDetailsWidth,
        setSidebarWidth,
      });
      return { sidebarWidth, detailsWidth };
    });

    // A 1000px window has no room for three 330px panes next to a 360px map,
    // so the details pane falls back to its hard minimum and the sidebar to
    // its own minimum.
    expect(result.current.detailsWidth).toBeGreaterThanOrEqual(300);
    expect(result.current.sidebarWidth).toBeGreaterThanOrEqual(320);
    expect(Number.isFinite(result.current.detailsWidth)).toBe(true);
    expect(Number.isFinite(result.current.sidebarWidth)).toBe(true);
  });
});
