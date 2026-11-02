// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ITimelineItem } from '../../../types';
import { useTripSelection } from '../../../components/tripview/useTripSelection';
import { makeActivityItem, makeCityItem, makeTravelItem } from '../../helpers/tripFixtures';

const berlin = makeCityItem({ id: 'city-berlin', title: 'Berlin', startDateOffset: 0, duration: 2 });
const prague = makeCityItem({ id: 'city-prague', title: 'Prague', startDateOffset: 2, duration: 2 });
const vienna = makeCityItem({ id: 'city-vienna', title: 'Vienna', startDateOffset: 4, duration: 2 });
const train = makeTravelItem('travel-1', 2, 'Berlin to Prague');
const museum = makeActivityItem('activity-museum', 'Berlin', 0.5);

const renderSelection = (items: ITimelineItem[]) => renderHook(
  ({ tripItems }: { tripItems: ITimelineItem[] }) => useTripSelection({ tripItems }),
  { initialProps: { tripItems: items } },
);

describe('components/tripview/useTripSelection', () => {
  it('starts with nothing selected', () => {
    const { result } = renderSelection([berlin, prague]);

    expect(result.current.selectedItemId).toBeNull();
    expect(result.current.selectedCityIds).toEqual([]);
  });

  it('keeps an activity and a city selection while their items stay in the trip', () => {
    const items = [berlin, prague, vienna, train, museum];
    const { result, rerender } = renderSelection(items);

    act(() => {
      result.current.setSelectedItemId(museum.id);
      result.current.setSelectedCityIds([berlin.id, prague.id]);
    });
    const selectedCityIds = result.current.selectedCityIds;

    rerender({ tripItems: [...items] });

    expect(result.current.selectedItemId).toBe(museum.id);
    expect(result.current.selectedCityIds).toBe(selectedCityIds);
  });

  it('drops the selected activity when it is removed from the trip', () => {
    const { result, rerender } = renderSelection([berlin, museum]);
    act(() => {
      result.current.setSelectedItemId(museum.id);
    });

    rerender({ tripItems: [berlin] });

    expect(result.current.selectedItemId).toBeNull();
  });

  it('drops only the removed cities from a multi-city selection', () => {
    const { result, rerender } = renderSelection([berlin, prague, vienna]);
    act(() => {
      result.current.setSelectedCityIds([berlin.id, prague.id, vienna.id]);
    });

    rerender({ tripItems: [berlin, vienna] });

    expect(result.current.selectedCityIds).toEqual([berlin.id, vienna.id]);
  });

  it('moves from one selected city to another without pruning', () => {
    const { result } = renderSelection([berlin, prague]);

    act(() => {
      result.current.setSelectedItemId(berlin.id);
      result.current.setSelectedCityIds([berlin.id]);
    });
    act(() => {
      result.current.setSelectedItemId(prague.id);
      result.current.setSelectedCityIds([prague.id]);
    });

    expect(result.current.selectedItemId).toBe(prague.id);
    expect(result.current.selectedCityIds).toEqual([prague.id]);
  });

  it('prunes selected city ids that point at items that are not cities', () => {
    const { result } = renderSelection([berlin, train]);

    act(() => {
      result.current.setSelectedCityIds([berlin.id, train.id]);
    });

    expect(result.current.selectedCityIds).toEqual([berlin.id]);
  });

  it('prunes a selected item id that is unknown to the trip right away', () => {
    const { result } = renderSelection([berlin]);

    act(() => {
      result.current.setSelectedItemId('missing-item');
    });

    expect(result.current.selectedItemId).toBeNull();
  });

  it('clears everything when a trip without those items replaces the current one', () => {
    const { result, rerender } = renderSelection([berlin, prague, museum]);
    act(() => {
      result.current.setSelectedItemId(museum.id);
      result.current.setSelectedCityIds([berlin.id, prague.id]);
    });

    rerender({ tripItems: [vienna] });

    expect(result.current.selectedItemId).toBeNull();
    expect(result.current.selectedCityIds).toEqual([]);
  });

  it('keeps the setter identities stable', () => {
    const { result, rerender } = renderSelection([berlin]);
    const { setSelectedItemId, setSelectedCityIds } = result.current;

    rerender({ tripItems: [berlin, prague] });

    expect(result.current.setSelectedItemId).toBe(setSelectedItemId);
    expect(result.current.setSelectedCityIds).toBe(setSelectedCityIds);
  });
});
