import { describe, expect, it } from 'vitest';

import type { IViewSettings } from '../../types';
import { buildVisualHistoryLabel, resolveVisualDiff } from '../../components/tripview/viewChangeDiff';

const createViewSettings = (overrides: Partial<IViewSettings> = {}): IViewSettings => ({
  layoutMode: 'horizontal',
  timelineMode: 'calendar',
  timelineView: 'horizontal',
  mapDockMode: 'docked',
  mapStyle: 'standard',
  zoomLevel: 1,
  routeMode: 'simple',
  showCityNames: true,
  sidebarWidth: 520,
  timelineHeight: 320,
  ...overrides,
});

describe('components/tripview/viewChangeDiff', () => {
  it('treats auto-fit zoom-only updates as suppressible visual changes', () => {
    const previous = createViewSettings({ zoomLevel: 1 });
    const current = createViewSettings({ zoomLevel: 1.25 });

    const result = resolveVisualDiff({
      previous,
      current,
      zoomChangeSource: 'auto',
    });

    expect(result.didZoomChange).toBe(true);
    expect(result.changes).toEqual([]);
    expect(result.isAutoZoomOnlyChange).toBe(true);
  });

  it('keeps manual zoom labels visible for history and toast messaging', () => {
    const previous = createViewSettings({ zoomLevel: 1 });
    const current = createViewSettings({ zoomLevel: 1.25 });

    const result = resolveVisualDiff({
      previous,
      current,
      zoomChangeSource: 'manual',
    });

    expect(result.didZoomChange).toBe(true);
    expect(result.isAutoZoomOnlyChange).toBe(false);
    expect(result.changes).toEqual(['Zoomed in']);
  });

  it('merges visual labels across quick successive updates without duplicates', () => {
    const label = buildVisualHistoryLabel('Visual: Timeline layout: horizontal → vertical', [
      'Timeline layout: horizontal → vertical',
      'Map layout: horizontal → vertical',
    ]);

    expect(label).toBe('Visual: Timeline layout: horizontal → vertical · Map layout: horizontal → vertical');
  });

  it('adds localized map preview mode changes for dock/floating toggles', () => {
    const previous = createViewSettings({ mapDockMode: 'docked' });
    const current = createViewSettings({ mapDockMode: 'floating' });

    const result = resolveVisualDiff({
      previous,
      current,
      zoomChangeSource: null,
      resolveMapDockModeLabel: (from, to) => `Map mode: ${from} -> ${to}`,
    });

    expect(result.changes).toContain('Map mode: docked -> floating');
  });

  it('does not emit a map preview change when legacy snapshots omit dock mode', () => {
    const previous = createViewSettings({ mapDockMode: undefined });
    const current = createViewSettings({ mapDockMode: 'docked' });

    const result = resolveVisualDiff({
      previous,
      current,
      zoomChangeSource: null,
    });

    expect(result.changes).toEqual([]);
  });
});
