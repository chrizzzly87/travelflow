import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getTripMapProviderTuning } from '../../components/maps/tripMapProviderTuning';

const readComponent = (file: string): string => readFileSync(
  path.resolve(process.cwd(), 'components', file),
  'utf8'
);

describe('itinerary map activity markers', () => {
  it('shows activity markers by default', () => {
    const source = readComponent('ItineraryMap.tsx');
    expect(source).toContain('useState(true);');
    expect(source).not.toContain('const [activityMarkersEnabled, setActivityMarkersEnabled] = useState(false)');
    expect(source).toContain('const [activityMarkersEnabled, setActivityMarkersEnabled] = useState(true)');
  });

  it('keeps the marker zoom gate above a country-wide view but below city focus', () => {
    for (const provider of ['google', 'mapbox'] as const) {
      const tuning = getTripMapProviderTuning(provider);
      // A country fit lands in the low-zoom marker tiers; city focus is where
      // activity pins should already be on screen.
      expect(tuning.markers.activityMinZoom).toBeGreaterThan(tuning.markers.tier.lowZoom);
      expect(tuning.markers.activityMinZoom).toBeLessThanOrEqual(tuning.selection.cityFocusZoom);
      expect(tuning.selection.activityFocusZoom).toBeGreaterThan(tuning.markers.activityMinZoom);
    }
  });
});

describe('components/itineraryMapUtils duplication guard', () => {
  // `itineraryMapUtils.tsx` is a hand-maintained copy of helpers that also live
  // in `ItineraryMap.tsx`; only the copy is importable, so the tests exercise
  // the copy while the app runs the original. The two have already drifted in
  // places, so rather than compare whole files, pin the selection helpers that
  // drive map centring: if one side is edited alone, the tests would otherwise
  // keep passing against dead code.
  const extractFunction = (source: string, name: string): string => {
    const startPattern = new RegExp(`^(?:export )?const ${name} = \\(`, 'm');
    const match = startPattern.exec(source);
    expect(match, `${name} not found`).not.toBeNull();
    const start = (match as RegExpExecArray).index;
    const end = source.indexOf('\n};', start);
    expect(end, `${name} has no terminator`).toBeGreaterThan(start);
    return source
      .slice(start, end)
      .replace(/^export /, '');
  };

  it.each([
    'resolveSelectedMapFocusPosition',
    'resolveSelectionViewportActions',
    'shouldDisplayActivityMarkers',
  ])('keeps %s identical in both files', (name) => {
    const utils = readComponent('itineraryMapUtils.tsx');
    const component = readComponent('ItineraryMap.tsx');

    expect(extractFunction(utils, name)).toBe(extractFunction(component, name));
  });
});
