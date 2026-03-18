// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  buildTripMapCityLabelHtml,
  resolveTripMapCityLabelPlacement,
  resolveTripMapCityLabelTheme,
} from '../../components/maps/tripMapCityLabelHtml';

describe('components/maps/tripMapCityLabelHtml', () => {
  it('builds provider-aware label markup with provider-specific max widths', () => {
    const googleHtml = buildTripMapCityLabelHtml({
      provider: 'google',
      name: 'Bangkok',
      subLabel: 'START',
      anchor: 'above',
      style: 'standard',
      offsetPx: 24,
    });
    const mapboxHtml = buildTripMapCityLabelHtml({
      provider: 'mapbox',
      name: 'Bangkok',
      subLabel: 'START',
      anchor: 'above',
      style: 'standard',
      offsetPx: 24,
    });

    expect(googleHtml).toContain('max-width:180px');
    expect(mapboxHtml).toContain('max-width:196px');
    expect(mapboxHtml).toContain('START');
  });

  it('keeps dark-mode city labels readable with the accent text color', () => {
    document.documentElement.style.setProperty('--tf-accent-200', '#abcdef');

    expect(resolveTripMapCityLabelTheme('dark')).toMatchObject({
      textColor: '#f8fafc',
      subTextColor: '#abcdef',
    });
  });

  it('centers labels above the marker when using the shared above placement', () => {
    expect(resolveTripMapCityLabelPlacement('above', 20)).toEqual({
      transform: 'translate(-50%, calc(-100% - 20px))',
      textAlign: 'center',
    });
  });
});
