// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyUserSettingsToLocalStorage } from '../../services/dbService';

describe('services/dbService applyUserSettingsToLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists planner view settings through registry-backed storage helpers', () => {
    applyUserSettingsToLocalStorage({
      mapStyle: 'clean',
      routeMode: 'realistic',
      layoutMode: 'vertical',
      timelineView: 'vertical',
      showCityNames: false,
      zoomLevel: 2.5,
      sidebarWidth: 640,
      timelineHeight: 420,
    });

    expect(window.localStorage.getItem('tf_map_style')).toBe('clean');
    expect(window.localStorage.getItem('tf_route_mode')).toBe('realistic');
    expect(window.localStorage.getItem('tf_layout_mode')).toBe('vertical');
    expect(window.localStorage.getItem('tf_timeline_view')).toBe('vertical');
    expect(window.localStorage.getItem('tf_city_names')).toBe('false');
    expect(window.localStorage.getItem('tf_zoom_level')).toBe('2.50');
    expect(window.localStorage.getItem('tf_sidebar_width')).toBe('640');
    expect(window.localStorage.getItem('tf_timeline_height')).toBe('420');
  });

  it('skips writes when settings payload is null', () => {
    window.localStorage.setItem('tf_map_style', 'dark');
    applyUserSettingsToLocalStorage(null);
    expect(window.localStorage.getItem('tf_map_style')).toBe('dark');
  });
});
