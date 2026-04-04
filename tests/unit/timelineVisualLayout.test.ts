import { describe, expect, it } from 'vitest';

import { getTimelineBounds } from '../../utils';
import { getTimelineVisualSpan } from '../../utils/timelineVisualLayout';

describe('getTimelineVisualSpan', () => {
  it('renders city stays from midday to midday', () => {
    expect(
      getTimelineVisualSpan({
        type: 'city',
        startDateOffset: 2,
        duration: 2,
      }),
    ).toEqual({
      startOffset: 2.5,
      endOffset: 4.5,
      duration: 2,
    });
  });

  it('expands horizontal activity items to the full touched-day span', () => {
    expect(
      getTimelineVisualSpan({
        type: 'activity',
        startDateOffset: 3.4,
        duration: 0.2,
      }),
    ).toEqual({
      startOffset: 3,
      endOffset: 4,
      duration: 1,
    });

    expect(
      getTimelineVisualSpan({
        type: 'activity',
        startDateOffset: 3.6,
        duration: 1.2,
      }),
    ).toEqual({
      startOffset: 3,
      endOffset: 5,
      duration: 2,
    });
  });

  it('preserves the original activity span in vertical mode', () => {
    expect(
      getTimelineVisualSpan(
        {
          type: 'activity',
          startDateOffset: 3.4,
          duration: 0.2,
        },
        { vertical: true },
      ),
    ).toEqual({
      startOffset: 3.4,
      endOffset: 3.6,
      duration: 0.2,
    });
  });

  it('expands timeline bounds to the touched calendar days for city stays', () => {
    expect(
      getTimelineBounds([
        {
          id: 'city-1',
          type: 'city',
          title: 'Tokyo',
          startDateOffset: 0,
          duration: 2,
          color: 'border',
          description: '',
        },
      ]),
    ).toEqual({
      startOffset: 0,
      endOffset: 3,
      dayCount: 3,
    });

    expect(
      getTimelineBounds([
        {
          id: 'city-2',
          type: 'city',
          title: 'Osaka',
          startDateOffset: 1,
          duration: 1.5,
          color: 'border',
          description: '',
        },
      ]),
    ).toEqual({
      startOffset: 1,
      endOffset: 3,
      dayCount: 2,
    });
  });
});
