// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { parseRouteSearch, stringifyRouteSearch } from '../../../app/routing/search';
import { tripRouteSearchSchema } from '../../../features/trips/tripRouteSearch';
import { tripLoaderDeps } from '../../../features/trips/routeData';

import type { IViewSettings } from '../../../types';
import { useTripViewSettingsSync } from '../../../components/tripview/useTripViewSettingsSync';

const BASE_VIEW_SETTINGS: IViewSettings = {
  layoutMode: 'horizontal',
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  mapDockMode: 'docked',
  mapStyle: 'standard',
  routeMode: 'simple',
  showCityNames: true,
  zoomLevel: 1.25,
  zoomBehavior: 'fit',
  sidebarWidth: 480,
  detailsWidth: 420,
  timelineHeight: 320,
};

const makeHookProps = (): Parameters<typeof useTripViewSettingsSync>[0] => ({
  layoutMode: 'horizontal',
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  mapDockMode: 'docked',
  mapStyle: 'standard',
  routeMode: 'simple',
  showCityNames: true,
  zoomLevel: 1.25,
  zoomBehavior: 'fit',
  sidebarWidth: 480,
  detailsWidth: 420,
  timelineHeight: 320,
  viewMode: 'planner',
  onViewSettingsChange: undefined,
  initialViewSettings: undefined,
  currentViewSettings: BASE_VIEW_SETTINGS,
  setMapStyle: vi.fn(),
  setRouteMode: vi.fn(),
  setLayoutMode: vi.fn(),
  setTimelineMode: vi.fn(),
  setTimelineView: vi.fn(),
  setMapDockMode: vi.fn(),
  setZoomLevel: vi.fn(),
  setZoomBehavior: vi.fn(),
  setSidebarWidth: vi.fn(),
  setDetailsWidth: vi.fn(),
  setTimelineHeight: vi.fn(),
  setShowCityNames: vi.fn(),
  suppressCommitRef: { current: false },
  pendingManualViewSettingsPersistRef: { current: false },
  skipViewDiffRef: { current: false },
  appliedViewKeyRef: { current: null },
  prevViewRef: { current: null },
});


type HookProps = Parameters<typeof useTripViewSettingsSync>[0];

/** Mount the hook inside a real trip route so URL writes go through the router. */
const renderSyncHook = async (initialProps: HookProps, initialEntry = '/trip/trip-1') => {
  const HookHost = React.createContext<React.ReactNode>(null);
  const Host = () => React.createElement(React.Fragment, null, React.useContext(HookHost));
  const root = createRootRoute({ component: Outlet });
  const trips = createRoute({ getParentRoute: () => root, id: '_trips', validateSearch: tripRouteSearchSchema, component: Outlet });
  const trip = createRoute({ getParentRoute: () => trips, path: '/trip/$tripId', loaderDeps: tripLoaderDeps, loader: () => null, staleTime: 0, component: Host });
  const router: AnyRouter = createRouter({
    routeTree: root.addChildren([trips.addChildren([trip])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    parseSearch: parseRouteSearch,
    stringifySearch: stringifyRouteSearch,
  });
  let mounted = false;
  const rendered = renderHook((hookProps: HookProps) => { mounted = true; useTripViewSettingsSync(hookProps); }, {
    initialProps,
    wrapper: ({ children }) => React.createElement(HookHost.Provider, { value: children }, React.createElement(RouterProvider, { router })),
  });
  await waitFor(() => expect(mounted).toBe(true));
  return { ...rendered, router };
};

describe('components/tripview/useTripViewSettingsSync', () => {
  it('persists settings and writes URL params through the router when callback is absent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const props = makeHookProps();
    props.viewMode = 'print';
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { router } = await renderSyncHook(props, '/trip/trip-1?existing=1#notes');
    const navigateSpy = vi.spyOn(router, 'navigate');
    const historyLength = router.history.length;

    expect(window.localStorage.getItem('tf_map_style')).toBe('standard');
    expect(window.localStorage.getItem('tf_route_mode')).toBe('simple');
    expect(window.localStorage.getItem('tf_layout_mode')).toBe('horizontal');
    expect(window.localStorage.getItem('tf_timeline_mode')).toBe('calendar');
    expect(window.localStorage.getItem('tf_timeline_view')).toBe('horizontal');
    expect(window.localStorage.getItem('tf_city_names')).toBe('true');
    expect(window.localStorage.getItem('tf_zoom_level')).toBe('1.25');

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => expect(router.state.location.searchStr).toContain('mode=print'));
    expect(navigateSpy).toHaveBeenCalledWith(expect.objectContaining({ replace: true, resetScroll: false }));
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(router.history.length).toBe(historyLength);
    expect(router.state.location.pathname).toBe('/trip/trip-1');
    expect(router.state.location.hash).toBe('notes');
    const params = new URLSearchParams(router.state.location.searchStr);
    expect(params.get('existing')).toBe('1');
    expect(params.get('layout')).toBe('horizontal');
    expect(params.get('timelineMode')).toBe('calendar');
    expect(params.get('timelineView')).toBe('horizontal');
    expect(params.get('mapStyle')).toBe('standard');
    expect(params.get('routeMode')).toBe('simple');
    expect(params.get('cityNames')).toBe('1');
    expect(params.get('zoom')).toBe('1.25');
    expect(params.get('sidebarWidth')).toBe('480');
    expect(params.get('detailsWidth')).toBe('420');
    expect(params.get('timelineHeight')).toBe('320');
    expect(params.get('mode')).toBe('print');

    replaceStateSpy.mockRestore();
    vi.useRealTimers();
  });

  it('uses callback path without mutating URL directly', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const props = makeHookProps();
    const onViewSettingsChange = vi.fn();
    props.onViewSettingsChange = onViewSettingsChange;
    props.pendingManualViewSettingsPersistRef.current = true;

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { router } = await renderSyncHook(props, '/trip/trip-2');
    const navigateSpy = vi.spyOn(router, 'navigate');

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onViewSettingsChange).toHaveBeenCalledWith({
      layoutMode: 'horizontal',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      mapDockMode: 'docked',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1.25,
      zoomBehavior: 'fit',
      sidebarWidth: 480,
      detailsWidth: 420,
      timelineHeight: 320,
    });
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(router.state.location.href).toBe('/trip/trip-2');

    replaceStateSpy.mockRestore();
    vi.useRealTimers();
  });

  it('does not emit callback updates until a manual view change is marked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const props = makeHookProps();
    const onViewSettingsChange = vi.fn();
    props.onViewSettingsChange = onViewSettingsChange;

    const { rerender } = await renderSyncHook(props);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onViewSettingsChange).not.toHaveBeenCalled();

    const manualProps = {
      ...props,
      pendingManualViewSettingsPersistRef: { current: true },
      zoomLevel: 1.5,
      currentViewSettings: {
        ...BASE_VIEW_SETTINGS,
        zoomLevel: 1.5,
      },
    };

    rerender(manualProps);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onViewSettingsChange).toHaveBeenCalledTimes(1);
    expect(onViewSettingsChange).toHaveBeenCalledWith({
      ...BASE_VIEW_SETTINGS,
      zoomLevel: 1.5,
    });
    expect(manualProps.pendingManualViewSettingsPersistRef.current).toBe(false);

    vi.useRealTimers();
  });

  it('applies initial view settings once and marks refs to suppress diff commits', async () => {
    const props = makeHookProps();
    props.initialViewSettings = {
      layoutMode: 'vertical',
      timelineMode: 'timeline',
      timelineView: 'vertical',
      mapDockMode: 'floating',
      mapStyle: 'dark',
      routeMode: 'realistic',
      zoomLevel: 2.5,
      zoomBehavior: 'manual',
      sidebarWidth: 640,
      detailsWidth: 520,
      timelineHeight: 420,
    };
    props.currentViewSettings = BASE_VIEW_SETTINGS;

    const { rerender } = await renderSyncHook(props);

    expect(props.suppressCommitRef.current).toBe(true);
    expect(props.skipViewDiffRef.current).toBe(true);
    expect(props.appliedViewKeyRef.current).toBe(JSON.stringify(props.initialViewSettings));
    expect(props.prevViewRef.current).toEqual(props.initialViewSettings);

    expect(props.setMapStyle).toHaveBeenCalledWith('dark');
    expect(props.setRouteMode).toHaveBeenCalledWith('realistic');
    expect(props.setLayoutMode).toHaveBeenCalledWith('vertical');
    expect(props.setTimelineMode).toHaveBeenCalledWith('timeline');
    expect(props.setTimelineView).toHaveBeenCalledWith('vertical');
    expect(props.setMapDockMode).toHaveBeenCalledWith('floating');
    expect(props.setZoomLevel).toHaveBeenCalledWith(2.5);
    expect(props.setZoomBehavior).toHaveBeenCalledWith('manual');
    expect(props.setSidebarWidth).toHaveBeenCalledWith(640);
    expect(props.setDetailsWidth).toHaveBeenCalledWith(520);
    expect(props.setTimelineHeight).toHaveBeenCalledWith(420);
    expect(props.setShowCityNames).toHaveBeenCalledWith(true);

    const mapStyleCalls = vi.mocked(props.setMapStyle).mock.calls.length;
    const routeModeCalls = vi.mocked(props.setRouteMode).mock.calls.length;

    rerender(props);

    expect(vi.mocked(props.setMapStyle).mock.calls.length).toBe(mapStyleCalls);
    expect(vi.mocked(props.setRouteMode).mock.calls.length).toBe(routeModeCalls);
  });

  it('does not re-emit unchanged settings when callback identity changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const props = makeHookProps();
    props.onViewSettingsChange = firstCallback;
    props.pendingManualViewSettingsPersistRef.current = true;

    const { rerender } = await renderSyncHook(props);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(firstCallback).toHaveBeenCalledTimes(1);

    rerender({
      ...props,
      pendingManualViewSettingsPersistRef: { current: true },
      onViewSettingsChange: secondCallback,
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(secondCallback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
