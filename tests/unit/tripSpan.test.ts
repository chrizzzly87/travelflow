import { describe, expect, it } from 'vitest';

import { getExactTripDateSpan, getTripSpan, getTripSpanFromOffsets } from '../../shared/tripSpan';

describe('shared/tripSpan', () => {
  it('treats exact dates as touched days plus overnight span', () => {
    const span = getExactTripDateSpan('2026-04-01', '2026-04-03');

    expect(span).not.toBeNull();
    expect(span).toMatchObject({
      days: 3,
      nights: 2,
      compactLabel: '3D/2N',
      longLabel: '3 days / 2 nights',
    });
  });

  it('keeps same-day exact ranges at one touched day and zero nights', () => {
    const span = getExactTripDateSpan('2026-04-01', '2026-04-01');

    expect(span).not.toBeNull();
    expect(span).toMatchObject({
      days: 1,
      nights: 0,
      compactLabel: '1D/0N',
    });
  });

  it('maps fractional city stays to the correct touched calendar days', () => {
    const span = getTripSpan({
      id: 'trip-1',
      title: 'Sample Trip',
      startDate: '2026-04-01',
      items: [
        {
          id: 'city-1',
          type: 'city',
          startDateOffset: 1.25,
          duration: 1.5,
          title: 'Lisbon',
          location: 'Lisbon',
        },
      ],
    } as any);

    expect(span).toMatchObject({
      days: 3,
      nights: 2,
      compactLabel: '3D/2N',
    });
    expect([span.startDate.getFullYear(), span.startDate.getMonth(), span.startDate.getDate()]).toEqual([2026, 3, 2]);
    expect([span.endDate.getFullYear(), span.endDate.getMonth(), span.endDate.getDate()]).toEqual([2026, 3, 4]);
  });

  it('uses floor and ceil offsets when deriving touched days directly', () => {
    const span = getTripSpanFromOffsets('2026-04-01', {
      startOffset: 0.5,
      endOffset: 2,
    });

    expect(span).toMatchObject({
      days: 3,
      nights: 2,
      compactLabel: '3D/2N',
    });
    expect([span.startDate.getFullYear(), span.startDate.getMonth(), span.startDate.getDate()]).toEqual([2026, 3, 1]);
    expect([span.endDate.getFullYear(), span.endDate.getMonth(), span.endDate.getDate()]).toEqual([2026, 3, 3]);
  });
});
