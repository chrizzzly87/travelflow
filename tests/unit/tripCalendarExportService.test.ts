// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import { buildTripCalendarExport, resolvePublicSiteOrigin } from '../../services/tripCalendarExportService';

const baseTrip: ITrip = {
  id: 'trip-123',
  title: 'Japan Sprint',
  startDate: '2026-04-10',
  createdAt: 1,
  updatedAt: 1,
  items: [
    {
      id: 'city-tokyo',
      type: 'city',
      title: 'Tokyo',
      location: 'Tokyo, Japan',
      startDateOffset: 0,
      duration: 3,
      color: 'bg-blue-100 border-blue-300 text-blue-800',
      coordinates: { lat: 35.6762, lng: 139.6503 },
      hotels: [
        { id: 'hotel-1', name: 'Shibuya Stay', address: 'Shibuya-ku 1-2-3' },
      ],
      description: 'Pack light and use Suica for metro.',
    },
    {
      id: 'activity-museum',
      type: 'activity',
      title: 'Museum morning',
      location: 'Tokyo',
      startDateOffset: 0.5,
      duration: 0.25,
      color: 'bg-sky-100 border-sky-300 text-sky-800',
      activityType: ['culture'],
      description: 'Book timed entry in advance.',
    },
    {
      id: 'travel-train',
      type: 'travel',
      title: 'Bullet train to Kyoto',
      startDateOffset: 3,
      duration: 0.2,
      color: 'bg-stone-800 border-stone-600 text-stone-100',
      transportMode: 'train',
      departureTime: '09:30',
      description: 'Seat reservation recommended.',
    },
    {
      id: 'city-kyoto',
      type: 'city',
      title: 'Kyoto',
      location: 'Kyoto, Japan',
      startDateOffset: 3.3,
      duration: 2.7,
      color: 'bg-emerald-100 border-emerald-300 text-emerald-800',
      coordinates: { lat: 35.0116, lng: 135.7681 },
    },
    {
      id: 'activity-temple',
      type: 'activity',
      title: 'Temple walk',
      location: 'Kyoto',
      startDateOffset: 4.1,
      duration: 0.3,
      color: 'bg-amber-100 border-amber-300 text-amber-800',
      activityType: ['sightseeing'],
    },
  ],
};

describe('services/tripCalendarExportService', () => {
  it('falls back to a non-localhost public site origin', () => {
    expect(resolvePublicSiteOrigin()).toBe('https://travelflowapp.netlify.app');
  });

  it('builds single-activity export with app and trip references', () => {
    const bundle = buildTripCalendarExport({
      trip: baseTrip,
      scope: 'activity',
      activityId: 'activity-museum',
    });

    expect(bundle).toBeTruthy();
    expect(bundle?.eventCount).toBe(1);
    expect(bundle?.tripUrl).toBe('https://travelflowapp.netlify.app/trip/trip-123');
    expect(bundle?.ics).toContain('BEGIN:VCALENDAR');
    expect(bundle?.ics).toContain('SUMMARY:Museum morning');
    expect(bundle?.ics).toContain('Planned with TravelFlow.');
    expect(bundle?.ics).toContain('Open trip: https://travelflowapp.netlify.app/trip/trip-123');
  });

  it('builds city export with accommodation and notes in descriptions', () => {
    const bundle = buildTripCalendarExport({
      trip: baseTrip,
      scope: 'cities',
    });

    expect(bundle).toBeTruthy();
    expect(bundle?.eventCount).toBe(2);
    expect(bundle?.ics).toContain('SUMMARY:Stay in Tokyo');
    expect(bundle?.ics).toContain('Accommodations:\\n- Shibuya Stay (Shibuya-ku 1-2-3)');
    expect(bundle?.ics).toContain('Notes:\\nPack light and use Suica for metro.');
  });

  it('builds all-in-one export including travel legs', () => {
    const bundle = buildTripCalendarExport({
      trip: baseTrip,
      scope: 'all',
    });

    expect(bundle).toBeTruthy();
    expect(bundle?.eventCount).toBe(5);
    expect(bundle?.ics).toContain('SUMMARY:Train: Tokyo → Kyoto');
    expect(bundle?.ics).toContain('Departure: 09:30');
  });

  it('returns null for missing selected activity in activity scope', () => {
    const bundle = buildTripCalendarExport({
      trip: baseTrip,
      scope: 'activity',
      activityId: 'missing-activity',
    });

    expect(bundle).toBeNull();
  });
});
