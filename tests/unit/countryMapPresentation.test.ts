import { describe, expect, it } from 'vitest';

import {
  buildCountryMapNodes,
  listCountriesNeedingMarker,
  projectToMapPoint,
  resolveCountryMapTone,
  sortCountryCodesForKeyboardNavigation,
  type CountryMapProjection,
} from '../../services/countryMapPresentation';
import {
  applyCountryExplorerState,
  INITIAL_COUNTRY_EXPLORER_STATE,
  type CountryExplorerState,
} from '../../services/countryExplorerFilters';
import {
  listCountryExplorerEntries,
  type CountryExplorerEntry,
} from '../../services/countryExplorerService';
import countryMapGeometry from '../../data/countryMapGeometry.generated.json';

const entries = listCountryExplorerEntries();
const guidesByCountryCode = new Map(entries.map((entry) => [entry.countryCode, entry]));

const geometry = countryMapGeometry.countries as Array<{ countryCode: string; name: string; d: string }>;
const projection = countryMapGeometry.projection as CountryMapProjection;
const geometryCountryCodes = new Set(geometry.map((shape) => shape.countryCode));

const stateWith = (overrides: Partial<CountryExplorerState> = {}): CountryExplorerState => ({
  ...INITIAL_COUNTRY_EXPLORER_STATE,
  ...overrides,
});

const nodesForState = (state: CountryExplorerState) => {
  const visible = applyCountryExplorerState(entries, state);
  return buildCountryMapNodes({
    geometryCodes: geometry,
    guidesByCountryCode,
    visibleCountryCodes: new Set(visible.map((entry) => entry.countryCode)),
    month: state.month,
  });
};

const findEntry = (predicate: (entry: CountryExplorerEntry) => boolean): CountryExplorerEntry => {
  const entry = entries.find(predicate);
  if (!entry) throw new Error('fixture expectation not met: no matching guide entry');
  return entry;
};

describe('generated map geometry', () => {
  it('is a plate-carrée window with drawable paths for every country', () => {
    expect(countryMapGeometry.projection.kind).toBe('equirectangular');
    expect(geometry.length).toBeGreaterThan(150);
    geometry.forEach((shape) => {
      expect(shape.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(shape.d.startsWith('M')).toBe(true);
    });
  });

  it('has no duplicate country codes, so no country is painted twice', () => {
    expect(geometryCountryCodes.size).toBe(geometry.length);
  });
});

describe('resolveCountryMapTone', () => {
  const entry = entries[0];

  it('paints a country with no guide as plain land', () => {
    expect(resolveCountryMapTone(undefined, true, null)).toBe('land');
    expect(resolveCountryMapTone(undefined, false, 6)).toBe('land');
  });

  it('mutes a guide country that the filters removed, whatever the month says', () => {
    expect(resolveCountryMapTone(entry, false, null)).toBe('muted');
    expect(resolveCountryMapTone(entry, false, entry.idealMonths[0] ?? 1)).toBe('muted');
  });

  it('uses the curated seasonality band once a month is chosen', () => {
    const seasonal = findEntry((candidate) => candidate.idealMonths.length > 0);
    const idealMonth = seasonal.idealMonths[0];
    expect(resolveCountryMapTone(seasonal, true, null)).toBe('match');
    expect(resolveCountryMapTone(seasonal, true, idealMonth)).toBe('ideal');
  });
});

describe('map and grid stay in sync', () => {
  it('marks exactly the filtered-in countries as in-results', () => {
    const state = stateWith({ regions: ['Europe'] });
    const visible = applyCountryExplorerState(entries, state);
    const visibleCodes = new Set(visible.map((entry) => entry.countryCode));
    const nodes = nodesForState(state);

    const inResults = nodes.filter((node) => node.inResults).map((node) => node.countryCode);
    // Every in-results node is in the grid, and every grid country that the atlas can draw is a
    // node — the map may only ever *omit* undrawable countries, never invent or keep extra ones.
    inResults.forEach((countryCode) => expect(visibleCodes.has(countryCode)).toBe(true));
    visible
      .filter((entry) => geometryCountryCodes.has(entry.countryCode))
      .forEach((entry) => expect(inResults).toContain(entry.countryCode));
  });

  it('recedes a guide country to muted as soon as a filter excludes it', () => {
    const europeanEntry = findEntry(
      (entry) => entry.region === 'Europe' && geometryCountryCodes.has(entry.countryCode),
    );
    const nonEuropean = findEntry(
      (entry) => entry.region !== 'Europe' && geometryCountryCodes.has(entry.countryCode),
    );

    const nodes = nodesForState(stateWith({ regions: ['Europe'] }));
    const byCode = new Map(nodes.map((node) => [node.countryCode, node]));

    expect(byCode.get(europeanEntry.countryCode)?.tone).toBe('match');
    expect(byCode.get(europeanEntry.countryCode)?.inResults).toBe(true);
    expect(byCode.get(nonEuropean.countryCode)?.tone).toBe('muted');
    expect(byCode.get(nonEuropean.countryCode)?.inResults).toBe(false);
  });

  it('empties the map of matches when the search matches nothing, without dropping the atlas', () => {
    const nodes = nodesForState(stateWith({ query: 'zzzzzznowhere' }));
    expect(nodes.length).toBe(geometry.length);
    expect(nodes.some((node) => node.inResults)).toBe(false);
    expect(nodes.every((node) => node.tone === 'muted' || node.tone === 'land')).toBe(true);
  });

  it('never claims a guide for a country that has none', () => {
    const nodes = nodesForState(stateWith());
    nodes.forEach((node) => {
      expect(node.hasGuide).toBe(guidesByCountryCode.has(node.countryCode));
      if (!node.hasGuide) expect(node.inResults).toBe(false);
    });
  });

  it('falls back to the atlas name for countries we have no guide for', () => {
    const nodes = nodesForState(stateWith());
    const withoutGuide = nodes.find((node) => !node.hasGuide);
    expect(withoutGuide?.name.length).toBeGreaterThan(0);
  });
});

describe('listCountriesNeedingMarker', () => {
  it('returns the guide countries the atlas cannot draw, so none go missing', () => {
    const missing = listCountriesNeedingMarker(guidesByCountryCode, geometryCountryCodes);
    missing.forEach((countryCode) => {
      expect(guidesByCountryCode.has(countryCode)).toBe(true);
      expect(geometryCountryCodes.has(countryCode)).toBe(false);
    });
    // Sorted, so the marker layer renders in a stable order between filter changes.
    expect(missing).toEqual([...missing].sort());
  });

  it('every drawn or marked country together covers the whole guide corpus', () => {
    const missing = new Set(listCountriesNeedingMarker(guidesByCountryCode, geometryCountryCodes));
    guidesByCountryCode.forEach((_entry, countryCode) => {
      expect(geometryCountryCodes.has(countryCode) || missing.has(countryCode)).toBe(true);
    });
  });
});

describe('projectToMapPoint', () => {
  it('puts the prime meridian in the middle and the antimeridian at the edges', () => {
    expect(projectToMapPoint(0, 0, projection)?.x).toBeCloseTo(projection.width / 2, 6);
    expect(projectToMapPoint(0, -180, projection)?.x).toBeCloseTo(0, 6);
    expect(projectToMapPoint(0, 180, projection)?.x).toBeCloseTo(projection.width, 6);
  });

  it('puts the northern edge at the top and the southern edge at the bottom', () => {
    expect(projectToMapPoint(projection.maxLatitude, 0, projection)?.y).toBeCloseTo(0, 6);
    expect(projectToMapPoint(projection.minLatitude, 0, projection)?.y)
      .toBeCloseTo(projection.height, 6);
  });

  it('refuses to pin a point the rendered window does not cover', () => {
    expect(projectToMapPoint(projection.maxLatitude + 1, 0, projection)).toBeNull();
    expect(projectToMapPoint(projection.minLatitude - 1, 0, projection)).toBeNull();
    expect(projectToMapPoint(0, 181, projection)).toBeNull();
    expect(projectToMapPoint(Number.NaN, 0, projection)).toBeNull();
  });
});

describe('sortCountryCodesForKeyboardNavigation', () => {
  it('walks west to east, then north to south', () => {
    const points = new Map([
      ['C', { x: 30, y: 10 }],
      ['A', { x: 10, y: 50 }],
      ['B', { x: 20, y: 10 }],
    ]);
    expect(sortCountryCodesForKeyboardNavigation(['A', 'B', 'C'], points)).toEqual(['A', 'B', 'C']);
  });

  it('breaks an exact tie deterministically so focus never jumps', () => {
    const points = new Map([
      ['ZW', { x: 10, y: 10 }],
      ['AL', { x: 10, y: 10 }],
    ]);
    expect(sortCountryCodesForKeyboardNavigation(['ZW', 'AL'], points)).toEqual(['AL', 'ZW']);
  });

  it('sinks countries with no projected point to the end', () => {
    const points = new Map([['B', { x: 99, y: 0 }]]);
    expect(sortCountryCodesForKeyboardNavigation(['A', 'B'], points)).toEqual(['B', 'A']);
  });
});
