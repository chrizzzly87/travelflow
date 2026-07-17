import { describe, expect, it } from 'vitest';

import {
  MAP_PRESENTATION_VERSION,
  type MapPresentationModel,
} from '../../shared/mapPresentation';
import { buildMapPresentationScene } from '../../shared/mapPresentationScene';

const presentation: MapPresentationModel = {
  version: MAP_PRESENTATION_VERSION,
  markers: [
    {
      id: 'city:bangkok',
      kind: 'city',
      position: { lat: 13.7563, lng: 100.5018 },
      label: 'Bangkok',
      categoryKeys: ['food'],
      sourceItemId: 'bangkok',
      metadata: {},
    },
    {
      id: 'city:chiang-mai',
      kind: 'city',
      position: { lat: 18.7883, lng: 98.9853 },
      label: 'Chiang Mai',
      categoryKeys: ['culture'],
      sourceItemId: 'chiang-mai',
      metadata: {},
    },
  ],
  routeLegs: [
    {
      id: 'route:train-north',
      fromMarkerId: 'city:bangkok',
      toMarkerId: 'city:chiang-mai',
      mode: 'train',
      geometryStatus: 'computed',
      metadata: {},
    },
  ],
  selection: {
    markerId: 'city:chiang-mai',
    routeLegId: 'route:train-north',
  },
  viewport: {
    fitMarkerIds: ['city:bangkok', 'city:chiang-mai'],
    focusMarkerId: 'city:chiang-mai',
    padding: {
      blockStart: 24,
      inlineEnd: 36,
      blockEnd: 24,
      inlineStart: 36,
    },
  },
  context: {
    source: 'test_scene',
    datasetVersion: '2026.07.17-v5',
    metadata: {},
  },
};

describe('map presentation scene', () => {
  it('resolves normalized marker, route, selection, and viewport layers', () => {
    const scene = buildMapPresentationScene(presentation);

    expect(scene.markers).toEqual([
      expect.objectContaining({
        marker: presentation.markers[0],
        selected: false,
        focused: false,
        includedInFit: true,
      }),
      expect.objectContaining({
        marker: presentation.markers[1],
        selected: true,
        focused: true,
        includedInFit: true,
      }),
    ]);
    expect(scene.routeLegs[0]).toMatchObject({
      routeLeg: presentation.routeLegs[0],
      from: presentation.markers[0],
      to: presentation.markers[1],
      selected: true,
    });
    expect(scene.viewport.fitMarkers).toEqual(presentation.markers);
    expect(scene.viewport.focusMarker).toBe(presentation.markers[1]);
    expect(scene.context).toBe(presentation.context);
  });

  it('rejects invalid models before a provider can render them', () => {
    const invalid: MapPresentationModel = {
      ...presentation,
      routeLegs: [{ ...presentation.routeLegs[0]!, toMarkerId: 'city:missing' }],
    };

    expect(() => buildMapPresentationScene(invalid)).toThrow(
      'Route leg route:train-north references an unknown end marker.',
    );
  });
});
