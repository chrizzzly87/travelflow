// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeaturesAirportBentoVisual } from '../../components/marketing/features/FeaturesAirportBentoVisual';

vi.mock('../../services/nearbyAirportsService', () => ({
  fetchNearbyAirports: vi.fn(async () => []),
}));

vi.mock('../../services/runtimeLocationService', () => ({
  ensureRuntimeLocationLoaded: vi.fn(async () => null),
}));

afterEach(() => {
  document.documentElement.dir = '';
});

/**
 * Regression: the route row inherited the document direction, so in ar/fa/ur the
 * split-flap cells rendered DXB as "BXD" and put the destination board ahead of
 * the origin, pointing the arrow the wrong way down the route.
 */
describe('components/marketing/features/FeaturesAirportBentoVisual direction', () => {
  it('pins the route row to ltr so IATA codes keep their character order in RTL', () => {
    document.documentElement.dir = 'rtl';

    const { container } = render(
      React.createElement(FeaturesAirportBentoVisual, { shouldPrefetch: false, isActive: false }),
    );

    const route = container.querySelector('[data-testid="features-airport-route"]');
    expect(route?.getAttribute('dir')).toBe('ltr');
  });

  it('pins the route row to ltr in LTR documents too, so both render identically', () => {
    document.documentElement.dir = 'ltr';

    const { container } = render(
      React.createElement(FeaturesAirportBentoVisual, { shouldPrefetch: false, isActive: false }),
    );

    expect(container.querySelector('[data-testid="features-airport-route"]')?.getAttribute('dir')).toBe('ltr');
  });
});
