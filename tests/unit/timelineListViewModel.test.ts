import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import { buildTimelineListModel } from '../../components/tripview/timelineListViewModel';

const makeTrip = (overrides: Partial<ITrip> = {}): ITrip => ({
  id: 'trip-1',
  title: 'Iberia Sprint',
  startDate: '2026-04-01',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  items: [
    {
      id: 'city-a',
      type: 'city',
      title: 'Lisbon',
      startDateOffset: 0,
      duration: 3,
      color: 'bg-blue-500',
    },
    {
      id: 'travel-a-b',
      type: 'travel',
      title: 'Morning express',
      description: 'High-speed rail transfer',
      transportMode: 'train',
      startDateOffset: 3.05,
      duration: 0.2,
      color: 'bg-stone-700',
    },
    {
      id: 'city-b',
      type: 'city',
      title: 'Madrid',
      startDateOffset: 3.25,
      duration: 3,
      color: 'bg-emerald-500',
    },
    {
      id: 'activity-a-1',
      type: 'activity',
      title: 'Belém walk',
      startDateOffset: 0.5,
      duration: 0.4,
      color: 'bg-amber-500',
    },
    {
      id: 'activity-b-2',
      type: 'activity',
      title: 'Evening tapas',
      startDateOffset: 4.2,
      duration: 0.3,
      color: 'bg-amber-500',
    },
    {
      id: 'activity-b-1',
      type: 'activity',
      title: 'Check in',
      startDateOffset: 3.5,
      duration: 0.3,
      color: 'bg-amber-500',
    },
  ],
  ...overrides,
});

describe('timelineListViewModel', () => {
  it('builds city sections with arrival context and activity order', () => {
    const model = buildTimelineListModel(makeTrip(), {
      today: new Date('2026-04-05T10:00:00Z'),
    });

    expect(model.sections).toHaveLength(2);
    expect(model.sections[0].arrivalTitle).toBe('Trip start');
    expect(model.sections[1].arrivalTitle).toContain('From Lisbon');
    expect(model.sections[1].arrivalTitle).toContain('Train');

    const secondSectionActivityIds = model.sections[1].activities.map((entry) => entry.item.id);
    expect(secondSectionActivityIds).toEqual(['activity-b-1', 'activity-b-2']);
    expect(model.sections[1].hasToday).toBe(true);
    expect(model.todayMarkerId).toBe('activity-activity-b-2');
  });

  it('falls back to city marker when today has no activity row', () => {
    const trip = makeTrip({
      items: [
        {
          id: 'city-only',
          type: 'city',
          title: 'Porto',
          startDateOffset: 0,
          duration: 5,
          color: 'bg-sky-500',
        },
      ],
    });

    const model = buildTimelineListModel(trip, {
      today: new Date('2026-04-03T09:30:00Z'),
    });

    expect(model.sections).toHaveLength(1);
    expect(model.sections[0].hasToday).toBe(true);
    expect(model.todayMarkerId).toBe('city-city-only');
  });
});
