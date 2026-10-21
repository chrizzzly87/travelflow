import { describe, expect, it } from 'vitest';

import {
  buildMapDeepLinks,
  buildMapSearchQuery,
  canOpenInMaps,
} from '../../services/mapDeepLinkService';

describe('services/mapDeepLinkService', () => {
  it('points both apps at the exact position when coordinates are known', () => {
    const links = buildMapDeepLinks({
      title: 'Taipei 101',
      location: 'Xinyi District, Taipei',
      coordinates: { lat: 25.033964, lng: 121.564468 },
    });

    expect(links?.isPrecise).toBe(true);
    expect(links?.google).toBe(
      'https://www.google.com/maps/search/?api=1&query=25.033964%2C121.564468',
    );
    expect(links?.apple).toBe(
      'https://maps.apple.com/?q=Taipei+101&ll=25.033964%2C121.564468',
    );
  });

  it('pins the Google link to the exact listing when a place id is stored', () => {
    const links = buildMapDeepLinks({
      title: 'Louvre',
      coordinates: { lat: 48.860611, lng: 2.337644 },
      placeId: 'ChIJPQ',
    });

    expect(links?.google).toContain('query_place_id=ChIJPQ');
  });

  it('falls back to a name and location search when there are no coordinates', () => {
    const links = buildMapDeepLinks({ title: 'Louvre', location: 'Paris, France' });

    expect(links?.isPrecise).toBe(false);
    expect(links?.google).toBe(
      'https://www.google.com/maps/search/?api=1&query=Louvre%2C+Paris%2C+France',
    );
    expect(links?.apple).toBe('https://maps.apple.com/?q=Louvre%2C+Paris%2C+France');
    expect(links?.google).not.toContain('query_place_id');
  });

  it('ignores coordinates that are not finite numbers', () => {
    const links = buildMapDeepLinks({
      title: 'Somewhere',
      location: 'Nowhere',
      coordinates: { lat: Number.NaN, lng: 12 },
    });

    expect(links?.isPrecise).toBe(false);
  });

  it('does not repeat the title when the location already contains it', () => {
    expect(buildMapSearchQuery({ title: 'Louvre', location: 'Louvre, Paris' }))
      .toBe('Louvre, Paris');
  });

  it('reports nothing to open when there is neither a name nor a position', () => {
    expect(canOpenInMaps({ title: '  ', location: '' })).toBe(false);
    expect(buildMapDeepLinks({ title: '  ', location: '' })).toBeNull();
  });
});
