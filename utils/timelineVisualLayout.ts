import type { ITimelineItem } from '../types';

const TIMELINE_DAY_EPSILON = 1e-4;

export interface TimelineVisualSpan {
  startOffset: number;
  endOffset: number;
  duration: number;
}

export function getTimelineVisualSpan(
  item: Pick<ITimelineItem, 'type' | 'startDateOffset' | 'duration'>,
  options?: { vertical?: boolean },
): TimelineVisualSpan {
  const startOffset = Number.isFinite(item.startDateOffset) ? item.startDateOffset : 0;
  const duration = Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0;

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
