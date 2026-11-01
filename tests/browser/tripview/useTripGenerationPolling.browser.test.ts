// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITrip, TripGenerationState } from '../../../types';

const mocks = vi.hoisted(() => ({
  dbEnabled: true,
  dbGetTrip: vi.fn(),
  triggerTripGenerationWorker: vi.fn(),
  shouldPollTripGenerationState: vi.fn(),
  shouldApplyPolledTripUpdate: vi.fn(),
}));

vi.mock('../../../config/db', () => ({
  get DB_ENABLED() {
    return mocks.dbEnabled;
  },
}));

vi.mock('../../../services/dbApi', () => ({
  dbGetTrip: mocks.dbGetTrip,
}));

vi.mock('../../../services/tripGenerationJobService', () => ({
  triggerTripGenerationWorker: mocks.triggerTripGenerationWorker,
}));

vi.mock('../../../services/tripGenerationPollingService', () => ({
  shouldPollTripGenerationState: mocks.shouldPollTripGenerationState,
  shouldApplyPolledTripUpdate: mocks.shouldApplyPolledTripUpdate,
}));

import { useTripGenerationPolling } from '../../../components/tripview/useTripGenerationPolling';
import {
  TRIP_GENERATION_POLL_INTERVAL_MS,
  TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS,
} from '../../../components/tripview/tripViewModel';
import { makeTrip } from '../../helpers/tripFixtures';

// The fake polling predicate reads this flag, so a test can mark a trip as
// generating or finished.
type PollingTrip = ITrip & { __generating?: boolean };

interface HookProps {
  trip: PollingTrip;
  generationState: TripGenerationState;
  orchestration: string | null;
  connectivityState: string;
  tripAccessSource?: string;
}

const setup = (initialProps: Partial<HookProps> = {}) => {
  const setGenerationNowMs = vi.fn();
  const onUpdateTrip = vi.fn();
  const tripRef = { current: (initialProps.trip ?? makeTrip()) as ITrip };
  const onUpdateTripRef = { current: onUpdateTrip };
  const props: HookProps = {
    trip: { ...makeTrip({ id: 'trip-1' }), __generating: true },
    generationState: 'running',
    orchestration: null,
    connectivityState: 'online',
    tripAccessSource: undefined,
    ...initialProps,
  };
  tripRef.current = props.trip;

  const hook = renderHook((current: HookProps) => useTripGenerationPolling({
    trip: current.trip,
    generationNowMs: 0,
    setGenerationNowMs,
    generationState: current.generationState,
    latestGenerationAttemptOrchestration: current.orchestration,
    connectivityState: current.connectivityState,
    tripAccessSource: current.tripAccessSource,
    tripRef,
    onUpdateTripRef,
  }), { initialProps: props });

  return { ...hook, props, setGenerationNowMs, onUpdateTrip, tripRef };
};

describe('components/tripview/useTripGenerationPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.dbEnabled = true;
    mocks.dbGetTrip.mockReset();
    mocks.triggerTripGenerationWorker.mockReset();
    mocks.shouldApplyPolledTripUpdate.mockReset();
    mocks.shouldPollTripGenerationState.mockReset();
    mocks.shouldPollTripGenerationState.mockImplementation((trip: PollingTrip) => Boolean(trip.__generating));
    mocks.dbGetTrip.mockResolvedValue(null);
    mocks.triggerTripGenerationWorker.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks the generation clock every second while generating', () => {
    const { setGenerationNowMs } = setup();
    expect(setGenerationNowMs).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(setGenerationNowMs).toHaveBeenCalledTimes(3);
  });

  it('polls the saved trip right away and then on the poll interval', async () => {
    setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(1);
    expect(mocks.dbGetTrip).toHaveBeenCalledWith('trip-1', { includeOwnerProfile: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_POLL_INTERVAL_MS - 1);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(2);
  });

  it('applies a newer remote trip without touching its updated time', async () => {
    const remoteTrip = makeTrip({ id: 'trip-1', updatedAt: 999 });
    mocks.dbGetTrip.mockResolvedValue({ trip: remoteTrip });
    mocks.shouldApplyPolledTripUpdate.mockReturnValue(true);
    const { onUpdateTrip, tripRef } = setup();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.shouldApplyPolledTripUpdate).toHaveBeenCalledWith(tripRef.current, remoteTrip, expect.any(Number));
    expect(onUpdateTrip).toHaveBeenCalledWith(remoteTrip, { preserveUpdatedAt: true });
  });

  it('skips a poll while the previous one is still in flight', async () => {
    let resolveFirst: (value: null) => void = () => undefined;
    mocks.dbGetTrip.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    setup();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_POLL_INTERVAL_MS * 2);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(null);
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_POLL_INTERVAL_MS);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(2);
  });

  it('stops ticking and polling once generation completes', async () => {
    const { rerender, props, setGenerationNowMs } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(1);

    rerender({ ...props, trip: { ...props.trip, __generating: false }, generationState: 'succeeded' });
    setGenerationNowMs.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_POLL_INTERVAL_MS * 3);
    });
    expect(setGenerationNowMs).not.toHaveBeenCalled();
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(1);
  });

  it('restarts polling for the new trip when the trip changes', async () => {
    const { rerender, props } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    rerender({ ...props, trip: { ...makeTrip({ id: 'trip-2' }), __generating: true } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.dbGetTrip).toHaveBeenLastCalledWith('trip-2', { includeOwnerProfile: false });

    mocks.dbGetTrip.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_POLL_INTERVAL_MS);
    });
    expect(mocks.dbGetTrip).toHaveBeenCalledTimes(1);
    expect(mocks.dbGetTrip).toHaveBeenCalledWith('trip-2', { includeOwnerProfile: false });
  });

  it('ignores a poll result that lands after the trip changed', async () => {
    let resolveFirst: (value: { trip: ITrip }) => void = () => undefined;
    mocks.dbGetTrip.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    mocks.shouldApplyPolledTripUpdate.mockReturnValue(true);
    const { rerender, props, onUpdateTrip } = setup();

    rerender({ ...props, trip: { ...makeTrip({ id: 'trip-2' }), __generating: true } });
    await act(async () => {
      resolveFirst({ trip: makeTrip({ id: 'trip-1', updatedAt: 999 }) });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onUpdateTrip).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'trip-1' }), expect.anything());
  });

  it('does not poll offline, for public read-only access, or without a database', async () => {
    setup({ connectivityState: 'offline' });
    setup({ tripAccessSource: 'public_read' });
    mocks.dbEnabled = false;
    setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_POLL_INTERVAL_MS * 2);
    });
    expect(mocks.dbGetTrip).not.toHaveBeenCalled();
  });

  it('nudges the async worker right away and then on the nudge interval while queued', async () => {
    setup({ generationState: 'queued', orchestration: 'async_worker' });
    expect(mocks.triggerTripGenerationWorker).toHaveBeenCalledTimes(1);
    expect(mocks.triggerTripGenerationWorker).toHaveBeenCalledWith({
      tripId: 'trip-1',
      limit: 1,
      source: 'trip_view_generation_poll_nudge',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS - 1);
    });
    expect(mocks.triggerTripGenerationWorker).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.triggerTripGenerationWorker).toHaveBeenCalledTimes(2);
  });

  it('does not nudge the worker unless the job is queued on the async worker', () => {
    setup({ generationState: 'running', orchestration: 'async_worker' });
    setup({ generationState: 'queued', orchestration: 'inline' });
    setup({ generationState: 'queued', orchestration: 'async_worker', connectivityState: 'offline' });
    expect(mocks.triggerTripGenerationWorker).not.toHaveBeenCalled();
  });

  it('stops nudging once the job leaves the queue', async () => {
    const { rerender, props } = setup({ generationState: 'queued', orchestration: 'async_worker' });
    rerender({ ...props, generationState: 'running' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS * 3);
    });
    expect(mocks.triggerTripGenerationWorker).toHaveBeenCalledTimes(1);
  });

  it('clears every timer on unmount', async () => {
    const { unmount, setGenerationNowMs } = setup({ generationState: 'queued', orchestration: 'async_worker' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    setGenerationNowMs.mockClear();
    mocks.dbGetTrip.mockClear();
    mocks.triggerTripGenerationWorker.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS * 2);
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(setGenerationNowMs).not.toHaveBeenCalled();
    expect(mocks.dbGetTrip).not.toHaveBeenCalled();
    expect(mocks.triggerTripGenerationWorker).not.toHaveBeenCalled();
  });
});
