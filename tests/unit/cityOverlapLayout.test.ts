import { describe, expect, it } from 'vitest';
import type { ITimelineItem } from '../../types';
import { buildCityOverlapLayout } from '../../utils';

const createCity = (
  id: string,
  startDateOffset: number,
  duration: number
): ITimelineItem => ({
  id,
  type: 'city',
  title: id,
  startDateOffset,
  duration,
  color: '#2563eb',
});

describe('buildCityOverlapLayout', () => {
  it('keeps sequential city stays in one lane', () => {
    const layout = buildCityOverlapLayout([
      createCity('a', 0, 2),
      createCity('b', 2, 2),
      createCity('c', 4, 1.5),
    ]);

    expect(layout.get('a')).toEqual({ stackIndex: 0, stackCount: 1 });
    expect(layout.get('b')).toEqual({ stackIndex: 0, stackCount: 1 });
    expect(layout.get('c')).toEqual({ stackIndex: 0, stackCount: 1 });
  });

  it('assigns separate vertical slots for overlapping city stays', () => {
    const layout = buildCityOverlapLayout([
      createCity('a', 0, 3),
      createCity('b', 0.5, 2),
      createCity('c', 3.2, 1.2),
    ]);

    expect(layout.get('a')).toEqual({ stackIndex: 0, stackCount: 2 });
    expect(layout.get('b')).toEqual({ stackIndex: 1, stackCount: 2 });
    expect(layout.get('c')).toEqual({ stackIndex: 0, stackCount: 1 });
  });

  it('reuses lanes inside the same overlap group when possible', () => {
    const layout = buildCityOverlapLayout([
      createCity('a', 0, 2.6),
      createCity('b', 0.5, 1.2),
      createCity('c', 1.8, 1.2),
    ]);

    expect(layout.get('a')).toEqual({ stackIndex: 0, stackCount: 2 });
    expect(layout.get('b')).toEqual({ stackIndex: 1, stackCount: 2 });
    expect(layout.get('c')).toEqual({ stackIndex: 1, stackCount: 2 });
  });
});
