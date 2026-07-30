import { describe, expect, it } from 'vitest';

import { buildTripScheduleModel } from '../../components/tripview/scheduleViewModel';
import type { ITimelineItem, ITrip } from '../../types';

const item = (overrides: Partial<ITimelineItem> & Pick<ITimelineItem, 'id' | 'type'>): ITimelineItem => ({
  id: overrides.id,
  type: overrides.type,
  title: overrides.title || overrides.id,
  startDateOffset: overrides.startDateOffset ?? 0,
  duration: overrides.duration ?? 1,
  color: overrides.color || '#64748b',
  ...overrides,
});

const trip = (items: ITimelineItem[], startDate = '2026-05-04'): ITrip => ({
  id: 'trip-schedule',
  title: 'Schedule trip',
  startDate,
  items,
  createdAt: 1,
  updatedAt: 1,
});

describe('buildTripScheduleModel', () => {
  it('projects city spans and day-starting entries without inventing hours', () => {
    const model = buildTripScheduleModel(trip([
      item({ id: 'city-a', type: 'city', startDateOffset: 0, duration: 2.5 }),
      item({ id: 'transfer', type: 'travel', startDateOffset: 1.1, duration: 0.2 }),
      item({ id: 'activity-late', type: 'activity', startDateOffset: 1.75 }),
      item({ id: 'activity-early', type: 'activity', startDateOffset: 1.25 }),
    ]));

    expect(model.totalDays).toBe(3);
    expect(model.weeks).toHaveLength(1);
    expect(model.weeks[0].days.map((day) => day.dateIso)).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
    ]);
    expect(model.weeks[0].days[1].cities[0]).toMatchObject({
      item: { id: 'city-a' },
      continuesFromPreviousDay: true,
      continuesIntoNextDay: true,
    });
    expect(model.weeks[0].days[1].entries.map((entry) => entry.item.id)).toEqual([
      'transfer',
      'activity-early',
      'activity-late',
    ]);
  });

  it('supports negative offsets and invalid start dates safely', () => {
    const model = buildTripScheduleModel(trip([
      item({ id: 'arrival', type: 'travel', startDateOffset: -0.25, duration: 0.1 }),
      item({ id: 'city', type: 'city', startDateOffset: 0, duration: 1 }),
    ], 'not-a-date'));

    expect(model.totalDays).toBe(2);
    expect(model.weeks[0].days.map((day) => day.dayOffset)).toEqual([-1, 0]);
    expect(model.weeks[0].days.every((day) => day.dateIso === null)).toBe(true);
    expect(model.weeks[0].days[0].entries[0].item.id).toBe('arrival');
  });

  it('creates a stable one-day schedule for an empty trip', () => {
    const model = buildTripScheduleModel(trip([]));

    expect(model.totalDays).toBe(1);
    expect(model.isTruncated).toBe(false);
    expect(model.weeks[0].days[0]).toMatchObject({
      dayOffset: 0,
      dateIso: '2026-05-04',
      cities: [],
      entries: [],
    });
  });

  it('bounds malformed extremely long schedules', () => {
    const model = buildTripScheduleModel(trip([
      item({ id: 'long-city', type: 'city', duration: 500 }),
    ]));

    expect(model.totalDays).toBe(500);
    expect(model.isTruncated).toBe(true);
    expect(model.weeks.flatMap((week) => week.days)).toHaveLength(370);
  });
});
