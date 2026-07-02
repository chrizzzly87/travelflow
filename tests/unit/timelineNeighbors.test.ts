import { describe, expect, it } from 'vitest';

import { findPreviousCity, type TimelineNeighborCandidate } from '../../utils/timelineNeighbors';

const city = (
  id: string,
  startDateOffset: number,
  duration: number,
  type: TimelineNeighborCandidate['type'] = 'city',
): TimelineNeighborCandidate => ({ id, type, startDateOffset, duration });

describe('findPreviousCity', () => {
  // Trip layout: A(0-3), B(3-6), C(6-9)
  const cityA = city('a', 0, 3);
  const cityB = city('b', 3, 3);
  const cityC = city('c', 6, 3);
  const items = [cityA, cityB, cityC];

  it('returns the adjacent previous city, not the first earlier city in array order', () => {
    expect(findPreviousCity(items, cityC.id, cityC.startDateOffset)).toBe(cityB);
  });

  it('regression: pre-fix lookup picked city A, allowing C to overlap B', () => {
    // The old Timeline resize-left handler used Array.prototype.find, which
    // returns the FIRST city with a smaller startDateOffset in array order.
    const buggyPrev = items.find(
      i => i.type === 'city' && i.startDateOffset < cityC.startDateOffset && i.id !== cityC.id,
    );
    expect(buggyPrev).toBe(cityA);

    // Clamping against A's end (3) would let C's left edge move to e.g. 4,
    // overlapping B (3-6). Clamping against the fixed neighbor's end (6) cannot.
    const buggyClampFloor = buggyPrev!.startDateOffset + buggyPrev!.duration;
    const draggedStart = 4; // user drags C's left edge into B's stay
    expect(Math.max(draggedStart, buggyClampFloor)).toBe(4); // pre-fix: overlap allowed

    const fixedPrev = findPreviousCity(items, cityC.id, cityC.startDateOffset)!;
    const fixedClampFloor = fixedPrev.startDateOffset + fixedPrev.duration;
    expect(Math.max(draggedStart, fixedClampFloor)).toBe(6); // post-fix: clamped to B's end
  });

  it('is independent of array order', () => {
    const shuffled = [cityC, cityB, cityA];
    expect(findPreviousCity(shuffled, cityC.id, cityC.startDateOffset)).toBe(cityB);
  });

  it('picks the earlier city with the latest end when earlier stays overlap', () => {
    const longA = city('a', 0, 5); // ends at 5, later than B's end at 4
    const shortB = city('b', 2, 2);
    expect(findPreviousCity([shortB, longA], 'c', 6)).toBe(longA);
  });

  it('ignores non-city items and the item being resized', () => {
    const travel = city('t', 5, 0.5, 'travel');
    const activity = city('x', 5.5, 0.2, 'activity');
    expect(findPreviousCity([cityA, travel, activity, cityC], cityC.id, cityC.startDateOffset)).toBe(cityA);
  });

  it('returns null when there is no earlier city', () => {
    expect(findPreviousCity(items, cityA.id, cityA.startDateOffset)).toBeNull();
    expect(findPreviousCity([], 'a', 0)).toBeNull();
  });
});
