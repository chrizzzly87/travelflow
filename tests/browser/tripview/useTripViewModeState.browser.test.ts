// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useTripViewModeState } from '../../../components/tripview/useTripViewModeState';

describe('components/tripview/useTripViewModeState', () => {
  it('defaults to planner mode when no mode query exists', () => {
    window.history.replaceState({}, '', '/trip/trip-1');

    const { result } = renderHook(() => useTripViewModeState());

    expect(result.current.viewMode).toBe('planner');
  });

  it('hydrates print mode from URL query', () => {
    window.history.replaceState({}, '', '/trip/trip-1?mode=print');

    const { result } = renderHook(() => useTripViewModeState());

    expect(result.current.viewMode).toBe('print');
  });
});
