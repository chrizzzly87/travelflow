import { describe, expect, it } from 'vitest';

import { buildTripMapCityMarkerHtml } from '../../components/maps/tripMapCityMarkerHtml';

const baseProfile = {
  shape: 'pin' as const,
  size: 30,
  selectedSize: 36,
  fontSize: 11,
  selectedFontSize: 12,
  showInnerDot: true,
  numberColor: '#0f172a',
};

describe('components/maps/tripMapCityMarkerHtml', () => {
  it('renders numbered pin markers by default', () => {
    const html = buildTripMapCityMarkerHtml({
      provider: 'google',
      index: 2,
      color: '#f97316',
      isSelected: false,
      profile: baseProfile,
      selectedOutlineColor: '#6366f1',
      selectedRingColor: '#c7d2fe',
    });

    expect(html).toContain('<img src="data:image/svg+xml');
    expect(html).toContain('>3<');
  });

  it('renders numbered circle markers when the profile uses the compact circle shape', () => {
    const html = buildTripMapCityMarkerHtml({
      provider: 'mapbox',
      index: 0,
      color: '#14b8a6',
      isSelected: true,
      profile: {
        ...baseProfile,
        shape: 'circle',
      },
      selectedOutlineColor: '#6366f1',
      selectedRingColor: '#c7d2fe',
    });

    expect(html).toContain('border-radius:9999px');
    expect(html).toContain('>1<');
  });

  it('supports future image-based city markers without changing the trip map call sites', () => {
    const html = buildTripMapCityMarkerHtml({
      provider: 'mapbox',
      index: 4,
      color: '#0ea5e9',
      isSelected: false,
      profile: {
        ...baseProfile,
        shape: 'circle',
      },
      selectedOutlineColor: '#6366f1',
      selectedRingColor: '#c7d2fe',
      imageUrl: 'https://example.com/city.jpg',
    });

    expect(html).toContain('object-fit:cover');
    expect(html).toContain('https://example.com/city.jpg');
    expect(html).toContain('>5<');
  });
});
