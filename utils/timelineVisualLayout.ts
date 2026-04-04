import type { ITimelineItem } from '../types';

const TIMELINE_DAY_EPSILON = 1e-4;
const CITY_MIDDAY_OFFSET = 0.5;

export interface TimelineVisualSpan {
  startOffset: number;
  endOffset: number;
  duration: number;
}

export interface TimelineVisualRange {
  startOffset: number;
  endOffset: number;
}

export function getTimelineVisualSpan(
  item: Pick<ITimelineItem, 'type' | 'startDateOffset' | 'duration'>,
  options?: { vertical?: boolean },
): TimelineVisualSpan {
  const startOffset = Number.isFinite(item.startDateOffset) ? item.startDateOffset : 0;
  const duration = Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0;

  if (item.type === 'city') {
    return {
      startOffset: startOffset + CITY_MIDDAY_OFFSET,
      endOffset: startOffset + duration + CITY_MIDDAY_OFFSET,
      duration,
    };
  }

  if (options?.vertical || item.type !== 'activity') {
    return {
      startOffset,
      endOffset: startOffset + duration,
      duration,
    };
  }

  const dayStart = Math.floor(startOffset);
  const actualEnd = startOffset + Math.max(duration, TIMELINE_DAY_EPSILON);
  const dayEnd = Math.max(dayStart + 1, Math.ceil(actualEnd - TIMELINE_DAY_EPSILON));

  return {
    startOffset: dayStart,
    endOffset: dayEnd,
    duration: dayEnd - dayStart,
  };
}

export function getTimelineVisualRange(
  items: Array<Pick<ITimelineItem, 'type' | 'startDateOffset' | 'duration'>>,
  options?: { vertical?: boolean },
): TimelineVisualRange | null {
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;

  items.forEach((item) => {
    const span = getTimelineVisualSpan(item, options);
    if (!Number.isFinite(span.startOffset) || !Number.isFinite(span.endOffset)) return;
    minStart = Math.min(minStart, span.startOffset);
    maxEnd = Math.max(maxEnd, span.endOffset);
  });

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd < minStart) {
    return null;
  }

  return {
    startOffset: minStart,
    endOffset: maxEnd,
  };
}

export function getTimelineVisualCenter(
  item: Pick<ITimelineItem, 'type' | 'startDateOffset' | 'duration'>,
  options?: { vertical?: boolean },
): number {
  const span = getTimelineVisualSpan(item, options);
  return span.startOffset + (span.duration / 2);
}
