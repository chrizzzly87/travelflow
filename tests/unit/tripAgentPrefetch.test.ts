import { afterEach, describe, expect, it, vi } from 'vitest';

const loadTripAgentBootstrapMock = vi.fn();

vi.mock('../../services/tripAgentService', () => ({
  loadTripAgentBootstrap: (...args: unknown[]) => loadTripAgentBootstrapMock(...args),
}));

vi.mock('../../components/trip-agent/TripAgentChatSession', () => ({
  TripAgentChatSession: () => null,
}));

import {
  loadTripAgentBootstrapForPanel,
  prefetchTripAgentBootstrap,
  readCachedTripAgentBootstrap,
  resetTripAgentPrefetchForTests,
} from '../../components/trip-agent/tripAgentPrefetch';

const bootstrap = (currentThreadId: string | null) => ({
  actor: { userId: 'u1', label: 'U', isAdmin: false },
  threads: currentThreadId ? [{ id: currentThreadId }] : [],
  currentThreadId,
  messages: [],
  quota: { remaining: 3, resetsAt: '2026-09-29T00:00:00Z' },
});

afterEach(() => {
  resetTripAgentPrefetchForTests();
  loadTripAgentBootstrapMock.mockReset();
});

describe('tripAgentPrefetch', () => {
  it('sends one request when hover, focus and click all warm the same trip', async () => {
    loadTripAgentBootstrapMock.mockResolvedValue(bootstrap('t1'));
    prefetchTripAgentBootstrap('trip-1');
    prefetchTripAgentBootstrap('trip-1');
    prefetchTripAgentBootstrap('trip-1');
    const result = await loadTripAgentBootstrapForPanel('trip-1', null);
    expect(result.currentThreadId).toBe('t1');
    expect(loadTripAgentBootstrapMock).toHaveBeenCalledTimes(1);
    expect(loadTripAgentBootstrapMock).toHaveBeenCalledWith('trip-1', null);
  });

  it('hands a prefetch to the panel only once, so a later load asks the server again', async () => {
    loadTripAgentBootstrapMock.mockResolvedValue(bootstrap('t1'));
    prefetchTripAgentBootstrap('trip-1');
    await loadTripAgentBootstrapForPanel('trip-1', null);
    await loadTripAgentBootstrapForPanel('trip-1', null);
    expect(loadTripAgentBootstrapMock).toHaveBeenCalledTimes(2);
  });

  it('reuses the prefetch for a named thread when it is the one the prefetch loaded', async () => {
    loadTripAgentBootstrapMock.mockResolvedValue(bootstrap('t1'));
    prefetchTripAgentBootstrap('trip-1');
    const result = await loadTripAgentBootstrapForPanel('trip-1', 't1');
    expect(result.currentThreadId).toBe('t1');
    expect(loadTripAgentBootstrapMock).toHaveBeenCalledTimes(1);
  });

  it('asks for a named thread when the prefetch loaded a different one', async () => {
    loadTripAgentBootstrapMock
      .mockResolvedValueOnce(bootstrap('t1'))
      .mockResolvedValueOnce(bootstrap('t2'));
    prefetchTripAgentBootstrap('trip-1');
    const result = await loadTripAgentBootstrapForPanel('trip-1', 't2');
    expect(result.currentThreadId).toBe('t2');
    expect(loadTripAgentBootstrapMock).toHaveBeenLastCalledWith('trip-1', 't2');
  });

  it('remembers the last bootstrap per trip for an instant reopen', async () => {
    loadTripAgentBootstrapMock.mockResolvedValue(bootstrap('t1'));
    expect(readCachedTripAgentBootstrap('trip-1')).toBeNull();
    await loadTripAgentBootstrapForPanel('trip-1', null);
    expect(readCachedTripAgentBootstrap('trip-1')?.currentThreadId).toBe('t1');
    expect(readCachedTripAgentBootstrap('trip-2')).toBeNull();
  });
});
