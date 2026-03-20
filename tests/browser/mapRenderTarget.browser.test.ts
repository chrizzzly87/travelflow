import { describe, expect, it } from 'vitest';

import { shouldHideGoogleMapCanvas } from '../../components/maps/mapRenderTarget';

describe('components/maps/mapRenderTarget', () => {
  it('keeps the Google canvas hidden for the full mixed-runtime Mapbox session', () => {
    expect(shouldHideGoogleMapCanvas({ isMapboxEnabled: true })).toBe(true);
    expect(shouldHideGoogleMapCanvas({ isMapboxEnabled: false })).toBe(false);
  });
});
