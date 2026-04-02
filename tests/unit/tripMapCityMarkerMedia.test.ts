import { describe, expect, it } from 'vitest';

import { resolveTripMapCityMarkerImageUrl } from '../../components/maps/tripMapCityMarkerMedia';

describe('components/maps/tripMapCityMarkerMedia', () => {
  it('returns a trimmed image url when a city provides one', () => {
    expect(resolveTripMapCityMarkerImageUrl({
      imageUrl: ' https://example.com/bangkok.jpg ',
    } as any)).toBe('https://example.com/bangkok.jpg');
  });

  it('returns null when the image url is missing or blank', () => {
    expect(resolveTripMapCityMarkerImageUrl({ imageUrl: '' } as any)).toBeNull();
    expect(resolveTripMapCityMarkerImageUrl({} as any)).toBeNull();
  });
});
