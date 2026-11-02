// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useTripViewModeState } from '../../../components/tripview/useTripViewModeState';

describe('components/tripview/useTripViewModeState', () => {
  it('defaults to planner mode when the route has no mode query', () => {
    const { result } = renderHook(() => useTripViewModeState());

    expect(result.current.viewMode).toBe('planner');
  });

  it('starts in print mode when the route search asks for it', () => {
    const { result } = renderHook(() => useTripViewModeState('print'));

    expect(result.current.viewMode).toBe('print');
  });

  it('ignores the browser URL, which the route search owns', () => {
    window.history.replaceState({}, '', '/trip/trip-1?mode=print');

    const { result } = renderHook(() => useTripViewModeState('planner'));

    expect(result.current.viewMode).toBe('planner');
    window.history.replaceState({}, '', '/');
  });
});
