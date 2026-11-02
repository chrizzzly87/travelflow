// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useReleaseNoticeReady } from '../../../components/tripview/useReleaseNoticeReady';

describe('components/tripview/useReleaseNoticeReady', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no requestIdleCallback; keep the timeout path as the only
    // non-interaction trigger so the assertions below stay deterministic.
    delete (window as Partial<Window> & { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays closed while a pointer is still down', () => {
    const { result } = renderHook(() => useReleaseNoticeReady({ suppressReleaseNotice: false }));

    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
      vi.advanceTimersByTime(1);
    });

    // Regression: arming on pointerdown dropped a `fixed inset-0` backdrop under
    // the cursor mid-click, so the visitor's click landed on the dialog instead
    // of the control they pressed and appeared to do nothing.
    expect(result.current).toBe(false);
  });

  it('opens only after the interaction that armed it has finished', () => {
    const { result } = renderHook(() => useReleaseNoticeReady({ suppressReleaseNotice: false }));

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('opens on its own after the idle timeout without any interaction', () => {
    const { result } = renderHook(() => useReleaseNoticeReady({ suppressReleaseNotice: false }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe(true);
  });

  it('never opens while the notice is suppressed', () => {
    const { result } = renderHook(() => useReleaseNoticeReady({ suppressReleaseNotice: true }));

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
      vi.advanceTimersByTime(10000);
    });

    expect(result.current).toBe(false);
  });

  it('drops the pending open when the trip view unmounts first', () => {
    const { result, unmount } = renderHook(() => useReleaseNoticeReady({ suppressReleaseNotice: false }));

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    unmount();

    expect(() => vi.advanceTimersByTime(1)).not.toThrow();
    expect(result.current).toBe(false);
  });
});
