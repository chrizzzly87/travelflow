// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTripLayoutControlsState } from '../../../components/tripview/useTripLayoutControlsState';

describe('components/tripview/useTripLayoutControlsState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates layout controls from persisted storage keys', () => {
    window.localStorage.setItem('tf_map_style', 'dark');
    window.localStorage.setItem('tf_route_mode', 'realistic');
    window.localStorage.setItem('tf_city_names', 'false');
    window.localStorage.setItem('tf_layout_mode', 'vertical');
    window.localStorage.setItem('tf_timeline_mode', 'timeline');
    window.localStorage.setItem('tf_timeline_view', 'vertical');
    window.localStorage.setItem('tf_sidebar_width', '620');
    window.localStorage.setItem('tf_timeline_height', '460');
    window.localStorage.setItem('tf_details_width', '540');
    window.localStorage.setItem('tf_zoom_level', '2.25');

    const { result } = renderHook(() =>
      useTripLayoutControlsState({
        defaultDetailsWidth: 500,
      }),
    );

    expect(result.current.mapStyle).toBe('dark');
    expect(result.current.routeMode).toBe('realistic');
    expect(result.current.showCityNames).toBe(false);
    expect(result.current.layoutMode).toBe('vertical');
    expect(result.current.timelineMode).toBe('timeline');
    expect(result.current.timelineView).toBe('vertical');
    expect(result.current.sidebarWidth).toBe(620);
    expect(result.current.timelineHeight).toBe(460);
    expect(result.current.detailsWidth).toBe(540);
    expect(result.current.zoomLevel).toBe(2.25);
  });

  it('prefers initial view settings over persisted storage where available', () => {
    window.localStorage.setItem('tf_map_style', 'dark');
    window.localStorage.setItem('tf_route_mode', 'realistic');
    window.localStorage.setItem('tf_city_names', 'false');
    window.localStorage.setItem('tf_layout_mode', 'vertical');
    window.localStorage.setItem('tf_timeline_mode', 'timeline');
    window.localStorage.setItem('tf_timeline_view', 'vertical');
    window.localStorage.setItem('tf_sidebar_width', '620');
    window.localStorage.setItem('tf_timeline_height', '460');
    window.localStorage.setItem('tf_zoom_level', '2.25');

    const { result } = renderHook(() =>
      useTripLayoutControlsState({
        defaultDetailsWidth: 500,
        initialViewSettings: {
          mapStyle: 'clean',
          routeMode: 'simple',
          showCityNames: true,
          layoutMode: 'horizontal',
          timelineMode: 'calendar',
          timelineView: 'horizontal',
          zoomLevel: 1.5,
          sidebarWidth: 580,
          timelineHeight: 410,
        },
      }),
    );

    expect(result.current.mapStyle).toBe('clean');
    expect(result.current.routeMode).toBe('simple');
    expect(result.current.showCityNames).toBe(true);
    expect(result.current.layoutMode).toBe('horizontal');
    expect(result.current.timelineMode).toBe('calendar');
    expect(result.current.timelineView).toBe('horizontal');
    expect(result.current.sidebarWidth).toBe(580);
    expect(result.current.timelineHeight).toBe(410);
    expect(result.current.zoomLevel).toBe(1.5);
  });
});
