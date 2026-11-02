import { describe, expect, it } from 'vitest';

import type { ITimelineItem } from '../../types';
import { buildUserLocationMarkerHtml, shouldOfferUserLocation } from '../../components/maps/userLocationMarker';

const city = (id: string, countryCode?: string): ITimelineItem => ({
  id,
  type: 'city',
  title: id,
  startDateOffset: 0,
  duration: 2,
  color: 'bg-sky-500',
  countryCode,
} as ITimelineItem);

const items = [city('taipei', 'TW'), city('tokyo', 'jp')];

describe('shouldOfferUserLocation', () => {
  it('offers the dot while the trip is running, wherever the visitor appears to be', () => {
    expect(shouldOfferUserLocation({ todayDayOffset: 0, items, visitorCountryCode: null })).toBe(true);
    expect(shouldOfferUserLocation({ todayDayOffset: 3, items, visitorCountryCode: 'DE' })).toBe(true);
  });

  it('offers the dot before or after the trip when the visitor is in one of its countries', () => {
    expect(shouldOfferUserLocation({ todayDayOffset: null, items, visitorCountryCode: 'tw' })).toBe(true);
    expect(shouldOfferUserLocation({ todayDayOffset: null, items, visitorCountryCode: 'JP' })).toBe(true);
  });

  it('hides it from everyone else', () => {
    expect(shouldOfferUserLocation({ todayDayOffset: null, items, visitorCountryCode: 'DE' })).toBe(false);
    expect(shouldOfferUserLocation({ todayDayOffset: null, items, visitorCountryCode: null })).toBe(false);
    expect(shouldOfferUserLocation({ todayDayOffset: undefined, items: [city('x')], visitorCountryCode: 'DE' })).toBe(false);
  });
});

describe('buildUserLocationMarkerHtml', () => {
  it('pulses only for a live fix and greys out a remembered one', () => {
    const live = buildUserLocationMarkerHtml({ isLive: true });
    const stale = buildUserLocationMarkerHtml({ isLive: false });
    expect(live).toContain('data-live="true"');
    expect(live).toContain('data-role="user-location-pulse"');
    expect(stale).toContain('data-live="false"');
    expect(stale).not.toContain('<span data-role="user-location-pulse"');
  });
});
