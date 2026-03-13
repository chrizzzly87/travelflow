import { describe, expect, it } from 'vitest';

import { getTimelineVisualSpan } from '../../utils/timelineVisualLayout';

describe('getTimelineVisualSpan', () => {
  it('keeps non-activity items on their original offsets', () => {
    expect(
      getTimelineVisualSpan({
        type: 'city',
        startDateOffset: 2.25,
        duration: 1.5,
      }),
    ).toEqual({
      startOffset: 2.25,
      endOffset: 3.75,
      duration: 1.5,
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
});
