// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerationProgressMessage } from '../../../components/tripview/useGenerationProgressMessage';

describe('useGenerationProgressMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rotates active progress messages on the configured interval', () => {
    const messages = ['Planning route', 'Checking stays', 'Building timeline'];
    const { result } = renderHook(() => useGenerationProgressMessage({
      isActive: true,
      messages,
      intervalMs: 1000,
    }));

    expect(result.current).toBe('Planning route');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('Checking stays');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('Building timeline');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('Planning route');
  });

  it('resets to the first message when generation becomes inactive', () => {
    const messages = ['Planning route', 'Checking stays'];
    const { result, rerender } = renderHook(
      ({ isActive }) => useGenerationProgressMessage({
        isActive,
        messages,
        intervalMs: 1000,
      }),
      { initialProps: { isActive: true } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('Checking stays');

    rerender({ isActive: false });

    expect(result.current).toBe('Planning route');
  });
});
