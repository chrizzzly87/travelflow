// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { IViewSettings } from '../../../types';
import { useTripViewSettingsSync } from '../../../components/tripview/useTripViewSettingsSync';

const BASE_VIEW_SETTINGS: IViewSettings = {
  layoutMode: 'horizontal',
  timelineView: 'horizontal',
  mapStyle: 'standard',
  routeMode: 'simple',
  showCityNames: true,
  zoomLevel: 1.25,
  sidebarWidth: 480,
  timelineHeight: 320,
};

const makeHookProps = (): Parameters<typeof useTripViewSettingsSync>[0] => ({
  layoutMode: 'horizontal',
  timelineView: 'horizontal',
  mapStyle: 'standard',
  routeMode: 'simple',
  showCityNames: true,
  zoomLevel: 1.25,
  sidebarWidth: 480,
  timelineHeight: 320,
  viewMode: 'planner',
  onViewSettingsChange: undefined,
  initialViewSettings: undefined,
  currentViewSettings: BASE_VIEW_SETTINGS,
  setMapStyle: vi.fn(),
  setRouteMode: vi.fn(),
  setLayoutMode: vi.fn(),
  setTimelineView: vi.fn(),
  setZoomLevel: vi.fn(),
  setSidebarWidth: vi.fn(),
  setTimelineHeight: vi.fn(),
  setShowCityNames: vi.fn(),
  suppressCommitRef: { current: false },
  skipViewDiffRef: { current: false },
  appliedViewKeyRef: { current: null },
  prevViewRef: { current: null },
});

describe('components/tripview/useTripViewSettingsSync', () => {
  it('persists settings and syncs URL params when callback is absent', () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/trip/trip-1?existing=1');

    const props = makeHookProps();
    props.viewMode = 'print';

    renderHook(() => useTripViewSettingsSync(props));

    expect(window.localStorage.getItem('tf_map_style')).toBe('standard');
    expect(window.localStorage.getItem('tf_route_mode')).toBe('simple');
    expect(window.localStorage.getItem('tf_layout_mode')).toBe('horizontal');
    expect(window.localStorage.getItem('tf_timeline_view')).toBe('horizontal');
    expect(window.localStorage.getItem('tf_city_names')).toBe('true');
    expect(window.localStorage.getItem('tf_zoom_level')).toBe('1.25');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get('layout')).toBe('horizontal');
    expect(params.get('timelineView')).toBe('horizontal');
    expect(params.get('mapStyle')).toBe('standard');
    expect(params.get('routeMode')).toBe('simple');
    expect(params.get('cityNames')).toBe('1');
    expect(params.get('zoom')).toBe('1.25');
    expect(params.get('sidebarWidth')).toBe('480');
    expect(params.get('timelineHeight')).toBe('320');
    expect(params.get('mode')).toBe('print');

    vi.useRealTimers();
  });

  it('uses callback path without mutating URL directly', () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/trip/trip-2');

    const props = makeHookProps();
    const onViewSettingsChange = vi.fn();
    props.onViewSettingsChange = onViewSettingsChange;

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    renderHook(() => useTripViewSettingsSync(props));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onViewSettingsChange).toHaveBeenCalledWith({
      layoutMode: 'horizontal',
      timelineView: 'horizontal',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1.25,
      sidebarWidth: 480,
      timelineHeight: 320,
    });
    expect(replaceStateSpy).not.toHaveBeenCalled();

    replaceStateSpy.mockRestore();
    vi.useRealTimers();
  });

  it('applies initial view settings once and marks refs to suppress diff commits', () => {
    const props = makeHookProps();
    props.initialViewSettings = {
      layoutMode: 'vertical',
      timelineView: 'vertical',
      mapStyle: 'dark',
      routeMode: 'realistic',
      zoomLevel: 2.5,
      sidebarWidth: 640,
      timelineHeight: 420,
    };
    props.currentViewSettings = BASE_VIEW_SETTINGS;

    const { rerender } = renderHook((hookProps: Parameters<typeof useTripViewSettingsSync>[0]) => {
      useTripViewSettingsSync(hookProps);
    }, { initialProps: props });

    expect(props.suppressCommitRef.current).toBe(true);
    expect(props.skipViewDiffRef.current).toBe(true);
    expect(props.appliedViewKeyRef.current).toBe(JSON.stringify(props.initialViewSettings));
    expect(props.prevViewRef.current).toEqual(props.initialViewSettings);

    expect(props.setMapStyle).toHaveBeenCalledWith('dark');
    expect(props.setRouteMode).toHaveBeenCalledWith('realistic');
    expect(props.setLayoutMode).toHaveBeenCalledWith('vertical');
    expect(props.setTimelineView).toHaveBeenCalledWith('vertical');
    expect(props.setZoomLevel).toHaveBeenCalledWith(2.5);
    expect(props.setSidebarWidth).toHaveBeenCalledWith(640);
    expect(props.setTimelineHeight).toHaveBeenCalledWith(420);
    expect(props.setShowCityNames).toHaveBeenCalledWith(true);

    const mapStyleCalls = props.setMapStyle.mock.calls.length;
    const routeModeCalls = props.setRouteMode.mock.calls.length;

    rerender(props);

    expect(props.setMapStyle.mock.calls.length).toBe(mapStyleCalls);
    expect(props.setRouteMode.mock.calls.length).toBe(routeModeCalls);
  });
});
