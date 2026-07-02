import type { ITimelineItem } from '../types';

export type TimelineNeighborCandidate = Pick<
  ITimelineItem,
  'id' | 'type' | 'startDateOffset' | 'duration'
>;

/**
 * Finds the city that directly precedes the given start offset on the timeline.
 *
 * Among all cities that start before `currentStartOffset`, the adjacent
 * neighbor is the one whose stay ends latest (max `startDateOffset + duration`).
 * Clamping a left-edge resize against that end guarantees the resized city
 * cannot overlap ANY earlier city, even if earlier stays already overlap each
 * other. Picking the first match in array order (the previous behavior) or the
 * max `startDateOffset` alone would clamp against the wrong stay whenever the
 * array is not sorted or durations differ.
 */
export function findPreviousCity<T extends TimelineNeighborCandidate>(
  items: readonly T[],
  currentId: string,
  currentStartOffset: number,
): T | null {
  let neighbor: T | null = null;
  let neighborEnd = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    if (item.type !== 'city' || item.id === currentId) continue;
    if (!(item.startDateOffset < currentStartOffset)) continue;

    const end = item.startDateOffset + item.duration;
    if (end > neighborEnd) {
      neighborEnd = end;
      neighbor = item;
    }
  }

  return neighbor;
}
