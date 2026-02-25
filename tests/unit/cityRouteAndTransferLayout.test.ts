import { describe, expect, it } from 'vitest';
import type { ITimelineItem } from '../../types';
import { buildApprovedCityRoute, buildHorizontalTransferLaneLayout } from '../../utils';

const createCity = (
  id: string,
  startDateOffset: number,
  duration: number,
  overrides: Partial<ITimelineItem> = {}
): ITimelineItem => ({
  id,
  type: 'city',
  title: id,
  startDateOffset,
  duration,
  color: '#2563eb',
  ...overrides,
});

describe('buildApprovedCityRoute', () => {
  it('routes through an approved lower-lane option instead of an unapproved top option', () => {
    const route = buildApprovedCityRoute([
      createCity('barcelona', 0, 3, { cityPlanStatus: 'confirmed' }),
      createCity('valencia-option', 3, 2, {
        cityPlanStatus: 'uncertain',
        cityPlanGroupId: 'middle-leg',
        cityPlanOptionIndex: 0,
        isApproved: false,
      }),
      createCity('palma-option', 3, 2, {
        cityPlanStatus: 'confirmed',
        cityPlanGroupId: 'middle-leg',
        cityPlanOptionIndex: 1,
        isApproved: true,
      }),
      createCity('rome', 5, 2, { cityPlanStatus: 'confirmed' }),
    ]);

    expect(route.map((city) => city.id)).toEqual(['barcelona', 'palma-option', 'rome']);
  });

  it('prefers explicit approval when legacy overlap data still contains implicit approved items', () => {
    const route = buildApprovedCityRoute([
      createCity('default-option', 3, 2, { cityPlanStatus: 'confirmed' }),
      createCity('explicit-option', 3, 2, {
        cityPlanStatus: 'confirmed',
        cityPlanGroupId: 'slot-1',
        cityPlanOptionIndex: 1,
        isApproved: true,
      }),
      createCity('next-city', 5, 2, { cityPlanStatus: 'confirmed' }),
    ]);

    expect(route.map((city) => city.id)).toEqual(['explicit-option', 'next-city']);
  });

  it('skips fully unapproved tentative slots', () => {
    const route = buildApprovedCityRoute([
      createCity('start', 0, 2, { cityPlanStatus: 'confirmed' }),
      createCity('option-a', 2, 2, {
        cityPlanStatus: 'uncertain',
        cityPlanGroupId: 'slot-2',
        cityPlanOptionIndex: 0,
        isApproved: false,
      }),
      createCity('option-b', 2, 2, {
        cityPlanStatus: 'uncertain',
        cityPlanGroupId: 'slot-2',
        cityPlanOptionIndex: 1,
        isApproved: false,
      }),
      createCity('end', 4, 2, { cityPlanStatus: 'confirmed' }),
    ]);

    expect(route.map((city) => city.id)).toEqual(['start', 'end']);
  });
});

describe('buildHorizontalTransferLaneLayout', () => {
  it('keeps a readable minimum chip width while packing dense transfers into multiple lanes', () => {
    const layout = buildHorizontalTransferLaneLayout(
      [
        { id: 'a', centerX: 120, preferredWidth: 108, minWidth: 72, maxWidth: 130 },
        { id: 'b', centerX: 154, preferredWidth: 108, minWidth: 72, maxWidth: 130 },
        { id: 'c', centerX: 188, preferredWidth: 108, minWidth: 72, maxWidth: 130 },
      ],
      { laneCollisionGap: 8 }
    );

    expect(layout.length).toBe(3);
    expect(layout.every((entry) => entry.chipWidth >= 72)).toBe(true);
    expect(Math.max(...layout.map((entry) => entry.laneCount))).toBeGreaterThan(1);

    const byLane = new Map<number, Array<{ left: number; right: number }>>();
    layout.forEach((entry) => {
      const laneItems = byLane.get(entry.laneIndex) || [];
      laneItems.push({ left: entry.chipLeft, right: entry.chipLeft + entry.chipWidth });
      byLane.set(entry.laneIndex, laneItems);
    });

    byLane.forEach((laneItems) => {
      const sorted = [...laneItems].sort((a, b) => a.left - b.left);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i].left).toBeGreaterThanOrEqual(sorted[i - 1].right + 8);
      }
    });
  });
});
