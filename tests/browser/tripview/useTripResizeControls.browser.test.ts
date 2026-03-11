// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripResizeControls } from '../../../components/tripview/useTripResizeControls';

const DEFAULT_ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

const makeHookOptions = (
  overrides: Partial<Parameters<typeof useTripResizeControls>[0]> = {},
): Parameters<typeof useTripResizeControls>[0] => ({
  isMobile: false,
  layoutMode: 'horizontal',
  mapDockMode: 'docked',
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  horizontalTimelineDayCount: 10,
  zoomLevel: 1,
  isZoomDirty: false,
  clampZoomLevel: (value: number) => Math.max(0.25, Math.min(3, value)),
  setZoomLevel: vi.fn(),
  sidebarWidth: 640,
  setSidebarWidth: vi.fn(),
  detailsWidth: 333.8,
  setDetailsWidth: vi.fn(),
  timelineHeight: 420,
  setTimelineHeight: vi.fn(),
  detailsPanelVisible: true,
  minSidebarWidth: 320,
  minTimelineHeight: 240,
  minBottomMapHeight: 200,
  minMapWidth: 420,
  minTimelineColumnWidth: 320,
  minDetailsWidth: 280,
  hardMinDetailsWidth: 220,
  resizerWidth: 6,
  resizeKeyboardStep: 16,
  horizontalTimelineAutoFitPadding: 64,
  verticalTimelineAutoFitPadding: 56,
  zoomLevelPresets: DEFAULT_ZOOM_PRESETS,
  basePixelsPerDay: 40,
  ...overrides,
});

describe('components/tripview/useTripResizeControls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const attachTimelineViewport = (
    result: { current: ReturnType<typeof useTripResizeControls> },
    dimensions: { width: number; height: number },
  ) => {
    const viewport = document.createElement('div');
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: dimensions.width });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: dimensions.height });
    act(() => {
      result.current.verticalLayoutTimelineRef.current = viewport;
    });
  };

  it('persists sidebar width when sidebar resizing ends', () => {
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({ sidebarWidth: 610 })));

    act(() => {
      result.current.startResizing('sidebar');
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(window.localStorage.getItem('tf_sidebar_width')).toBe('610');
  });

  it('persists details width when details resizing ends', () => {
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({ detailsWidth: 333.8 })));

    act(() => {
      result.current.startResizing('details', 100);
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(window.localStorage.getItem('tf_details_width')).toBe('334');
  });

  it('persists timeline height when timeline resizing ends', () => {
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({ timelineHeight: 455 })));

    act(() => {
      result.current.startResizing('timeline-h');
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(window.localStorage.getItem('tf_timeline_height')).toBe('455');
  });

  it('auto-fits vertical timeline zoom to the largest preset that still fits on timeline-view toggle', () => {
    const setZoomLevel = vi.fn();
    const onAutoFitZoomApplied = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      onAutoFitZoomApplied,
      timelineView: 'horizontal',
      layoutMode: 'horizontal',
      horizontalTimelineDayCount: 10,
      zoomLevel: 1,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1000, height: 640 });
    setZoomLevel.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        timelineView: 'vertical',
      });
    });

    expect(setZoomLevel).toHaveBeenCalledTimes(1);
    expect(onAutoFitZoomApplied).toHaveBeenCalledTimes(1);
    const zoomUpdater = setZoomLevel.mock.calls[0][0] as (value: number) => number;
    expect(zoomUpdater(1)).toBe(1.25);
  });

  it('does not emit auto-fit zoom callback when computed zoom equals current zoom', () => {
    const setZoomLevel = vi.fn();
    const onAutoFitZoomApplied = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      onAutoFitZoomApplied,
      timelineView: 'horizontal',
      layoutMode: 'horizontal',
      horizontalTimelineDayCount: 10,
      zoomLevel: 1.25,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1000, height: 640 });
    setZoomLevel.mockClear();
    onAutoFitZoomApplied.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        timelineView: 'vertical',
      });
    });

    expect(setZoomLevel).not.toHaveBeenCalled();
    expect(onAutoFitZoomApplied).not.toHaveBeenCalled();
  });

  it('auto-fits horizontal timeline to the largest preset that fits the viewport width', () => {
    const setZoomLevel = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      timelineView: 'vertical',
      layoutMode: 'horizontal',
      horizontalTimelineDayCount: 5,
      zoomLevel: 1,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1200, height: 700 });
    setZoomLevel.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        timelineView: 'horizontal',
      });
    });

    expect(setZoomLevel).toHaveBeenCalledTimes(1);
    const zoomUpdater = setZoomLevel.mock.calls[0][0] as (value: number) => number;
    expect(zoomUpdater(1)).toBe(3);
  });

  it('does not auto-fit timeline zoom once user zoom is marked dirty', () => {
    const setZoomLevel = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      timelineView: 'horizontal',
      layoutMode: 'horizontal',
      isZoomDirty: true,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1100, height: 620 });
    setZoomLevel.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        timelineView: 'vertical',
      });
    });

    expect(setZoomLevel).not.toHaveBeenCalled();
  });

  it('does not auto-fit timeline zoom in timeline list mode', () => {
    const setZoomLevel = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      timelineMode: 'timeline',
      timelineView: 'horizontal',
      layoutMode: 'horizontal',
      isZoomDirty: false,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1100, height: 620 });
    setZoomLevel.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        timelineView: 'vertical',
      });
    });

    expect(setZoomLevel).not.toHaveBeenCalled();
  });

  it('allows manual fit even when zoom is marked dirty', () => {
    const setZoomLevel = vi.fn();
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({
      setZoomLevel,
      isZoomDirty: true,
      timelineView: 'horizontal',
      horizontalTimelineDayCount: 5,
      zoomLevel: 1,
    })));

    attachTimelineViewport(result, { width: 1200, height: 640 });
    setZoomLevel.mockClear();

    act(() => {
      result.current.fitTimelineZoom(undefined, { force: true });
    });

    expect(setZoomLevel).toHaveBeenCalledTimes(1);
  });

  it('fits back down from larger zoom levels when the current timeline is overflowing', () => {
    const setZoomLevel = vi.fn();
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({
      setZoomLevel,
      isZoomDirty: true,
      timelineView: 'horizontal',
      horizontalTimelineDayCount: 12,
      zoomLevel: 2,
    })));

    attachTimelineViewport(result, { width: 960, height: 640 });
    setZoomLevel.mockClear();

    act(() => {
      result.current.fitTimelineZoom(undefined, { force: true });
    });

    expect(setZoomLevel).toHaveBeenCalledTimes(1);
    const zoomUpdater = setZoomLevel.mock.calls[0][0] as (value: number) => number;
    expect(zoomUpdater(2)).toBe(1.75);
  });

  it('clamps sidebar width on resize so the docked map keeps its minimum width', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    const setSidebarWidth = vi.fn();
    renderHook(() => useTripResizeControls(makeHookOptions({
      sidebarWidth: 900,
      detailsWidth: 400,
      setSidebarWidth,
      layoutMode: 'horizontal',
      mapDockMode: 'docked',
      detailsPanelVisible: true,
      minMapWidth: 420,
      minSidebarWidth: 320,
    })));

    expect(setSidebarWidth).toHaveBeenCalled();
    const updater = setSidebarWidth.mock.calls[0][0] as (value: number) => number;
    expect(updater(900)).toBe(368);
  });

  it('allows the floating-mode details pane to grow until only the minimum timeline width remains', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1400,
    });
    const setDetailsWidth = vi.fn();
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({
      detailsWidth: 400,
      setDetailsWidth,
      layoutMode: 'horizontal',
      mapDockMode: 'floating',
      detailsPanelVisible: true,
      minTimelineColumnWidth: 420,
      minDetailsWidth: 280,
      hardMinDetailsWidth: 220,
    })));

    setDetailsWidth.mockClear();

    act(() => {
      result.current.startResizing('details', 900);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
    });

    expect(setDetailsWidth).toHaveBeenCalledTimes(1);
    expect(setDetailsWidth).toHaveBeenCalledWith(800);
  });

  it('auto-fits timeline zoom when map dock mode changes', () => {
    const setZoomLevel = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      timelineView: 'horizontal',
      timelineMode: 'calendar',
      mapDockMode: 'docked',
      isZoomDirty: false,
      horizontalTimelineDayCount: 8,
      zoomLevel: 1,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1120, height: 620 });
    setZoomLevel.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        mapDockMode: 'floating',
      });
    });

    expect(setZoomLevel).toHaveBeenCalledTimes(1);
  });

  it('does not auto-fit timeline zoom when only map layout direction changes', () => {
    const setZoomLevel = vi.fn();
    const initialProps = makeHookOptions({
      setZoomLevel,
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      layoutMode: 'horizontal',
      mapDockMode: 'docked',
      isZoomDirty: false,
      horizontalTimelineDayCount: 8,
      zoomLevel: 1,
    });
    const { result, rerender } = renderHook((props: Parameters<typeof useTripResizeControls>[0]) => useTripResizeControls(props), {
      initialProps,
    });

    attachTimelineViewport(result, { width: 1120, height: 620 });
    setZoomLevel.mockClear();

    act(() => {
      rerender({
        ...initialProps,
        layoutMode: 'vertical',
      });
    });

    expect(setZoomLevel).not.toHaveBeenCalled();
  });
});
