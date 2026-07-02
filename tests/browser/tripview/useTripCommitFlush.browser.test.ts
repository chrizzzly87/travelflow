// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';

import { useTripCommitFlush } from '../../../components/tripview/useTripCommitFlush';
import type { PendingTripCommitState } from '../../../components/tripview/useTripLiveUpdate';
import type { IViewSettings } from '../../../types';
import { makeTrip } from '../../helpers/tripFixtures';

const { enqueueTripCommitMock } = vi.hoisted(() => ({
  enqueueTripCommitMock: vi.fn(),
}));

vi.mock('../../../services/offlineChangeQueue', () => ({
  enqueueTripCommit: enqueueTripCommitMock,
}));

const VIEW_SETTINGS: IViewSettings = {
  layoutMode: 'vertical',
  timelineView: 'horizontal',
  mapStyle: 'standard',
  zoomLevel: 1,
};

interface HarnessRefs {
  commitTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingCommitRef: MutableRefObject<PendingTripCommitState | null>;
  pendingHistoryLabelRef: MutableRefObject<string | null>;
}

const makeRefs = (): HarnessRefs => ({
  commitTimerRef: { current: null },
  pendingCommitRef: { current: null },
  pendingHistoryLabelRef: { current: null },
});

const setVisibilityState = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  });
};

describe('components/tripview/useTripCommitFlush', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    enqueueTripCommitMock.mockClear();
    setVisibilityState('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes a pending commit exactly once through commitNow on unmount', () => {
    const refs = makeRefs();
    const commitNow = vi.fn();
    const debouncedCommit = vi.fn();
    const trip = makeTrip({ id: 'trip-flush-1' });

    const { unmount } = renderHook(() => useTripCommitFlush({ ...refs, commitNow }));

    refs.pendingCommitRef.current = { trip, view: VIEW_SETTINGS };
    refs.pendingHistoryLabelRef.current = 'Data: Renamed activity';
    refs.commitTimerRef.current = setTimeout(debouncedCommit, 700);

    unmount();

    expect(commitNow).toHaveBeenCalledTimes(1);
    expect(commitNow).toHaveBeenCalledWith(
      { trip, view: VIEW_SETTINGS },
      'Data: Renamed activity',
    );
    expect(refs.pendingCommitRef.current).toBeNull();
    expect(refs.pendingHistoryLabelRef.current).toBeNull();
    expect(refs.commitTimerRef.current).toBeNull();

    // The debounce timer was cancelled, so the regular path cannot fire a second commit.
    vi.runAllTimers();
    expect(debouncedCommit).not.toHaveBeenCalled();
    expect(commitNow).toHaveBeenCalledTimes(1);
    expect(enqueueTripCommitMock).not.toHaveBeenCalled();
  });

  it('persists a pending commit synchronously to the offline queue on pagehide', () => {
    const refs = makeRefs();
    const commitNow = vi.fn();
    const debouncedCommit = vi.fn();
    const trip = makeTrip({ id: 'trip-flush-2' });

    const { unmount } = renderHook(() => useTripCommitFlush({ ...refs, commitNow }));

    refs.pendingCommitRef.current = { trip, view: VIEW_SETTINGS };
    refs.pendingHistoryLabelRef.current = 'Visual: Moved map';
    refs.commitTimerRef.current = setTimeout(debouncedCommit, 700);

    window.dispatchEvent(new Event('pagehide'));

    expect(enqueueTripCommitMock).toHaveBeenCalledTimes(1);
    expect(enqueueTripCommitMock).toHaveBeenCalledWith({
      tripId: 'trip-flush-2',
      tripSnapshot: trip,
      viewSnapshot: VIEW_SETTINGS,
      label: 'Visual: Moved map',
    });
    expect(commitNow).not.toHaveBeenCalled();
    expect(refs.pendingCommitRef.current).toBeNull();

    vi.runAllTimers();
    expect(debouncedCommit).not.toHaveBeenCalled();

    // A later unmount finds nothing pending — no double commit.
    unmount();
    expect(commitNow).not.toHaveBeenCalled();
    expect(enqueueTripCommitMock).toHaveBeenCalledTimes(1);
  });

  it('persists a pending commit when the document becomes hidden', () => {
    const refs = makeRefs();
    const commitNow = vi.fn();
    const trip = makeTrip({ id: 'trip-flush-3' });

    renderHook(() => useTripCommitFlush({ ...refs, commitNow }));

    refs.pendingCommitRef.current = { trip, view: VIEW_SETTINGS };

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(enqueueTripCommitMock).toHaveBeenCalledTimes(1);
    expect(enqueueTripCommitMock).toHaveBeenCalledWith({
      tripId: 'trip-flush-3',
      tripSnapshot: trip,
      viewSnapshot: VIEW_SETTINGS,
      label: 'Data: Updated trip',
    });
    expect(commitNow).not.toHaveBeenCalled();
  });

  it('does nothing on pagehide, visibility change, or unmount without a pending commit', () => {
    const refs = makeRefs();
    const commitNow = vi.fn();

    const { unmount } = renderHook(() => useTripCommitFlush({ ...refs, commitNow }));

    window.dispatchEvent(new Event('pagehide'));
    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    unmount();

    expect(commitNow).not.toHaveBeenCalled();
    expect(enqueueTripCommitMock).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    const refs = makeRefs();
    const commitNow = vi.fn();
    const trip = makeTrip({ id: 'trip-flush-4' });

    const { unmount } = renderHook(() => useTripCommitFlush({ ...refs, commitNow }));
    unmount();

    // Pending state created after unmount must not be picked up by stale listeners.
    refs.pendingCommitRef.current = { trip, view: VIEW_SETTINGS };
    window.dispatchEvent(new Event('pagehide'));
    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(enqueueTripCommitMock).not.toHaveBeenCalled();
    expect(commitNow).not.toHaveBeenCalled();
  });
});
