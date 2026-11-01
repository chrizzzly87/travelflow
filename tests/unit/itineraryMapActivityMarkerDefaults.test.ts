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
    // The map takes the setting from the customize sheet when it is given one
    // and otherwise keeps its own, so the default lives on the uncontrolled
    // state and the controlled value falls back to it.
    expect(source).toContain('const [uncontrolledActivityMarkersEnabled, setUncontrolledActivityMarkersEnabled] = useState(true)');
    expect(source).toContain('const activityMarkersEnabled = showActivityMarkers ?? uncontrolledActivityMarkersEnabled;');
    expect(source).not.toContain('useState(false);\n    const activityMarkersEnabled');
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

describe('components/ItineraryMap pure helper extraction guard', () => {
  // The pure helpers used to live both in `ItineraryMap.tsx` and in a
  // hand-maintained copy (`itineraryMapUtils.tsx`) that only the tests ran.
  // They now have one home under `components/maps/`; a local redefinition in
  // the component would bring the untested-copy problem back.
  it.each([
    'resolveSelectedMapFocusPosition',
    'resolveSelectionViewportActions',
    'shouldDisplayActivityMarkers',
    'resolveMarkerRenderTier',
    'buildRouteAttemptPolicy',
    'buildActivityMarkerHtml',
    'buildMapboxRouteLayerConfigs',
    'hydrateRouteCache',
  ])('does not redefine %s inside the component', (name) => {
    const component = readComponent('ItineraryMap.tsx');

    expect(component).not.toMatch(new RegExp(`^(?:export )?const ${name} = `, 'm'));
    expect(component).toMatch(new RegExp(`\\b${name}\\b`));
  });
});
