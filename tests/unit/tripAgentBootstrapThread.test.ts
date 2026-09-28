import { describe, expect, it, vi } from 'vitest';

import { resolveBootstrapThread } from '../../netlify/edge-lib/trip-agent-handler.ts';

const thread = (id: string, status: 'active' | 'archived') => ({ id, status });

describe('resolveBootstrapThread', () => {
  it('opens the newest active thread without creating one', async () => {
    const createThread = vi.fn();
    const result = await resolveBootstrapThread({
      threads: [thread('old', 'archived'), thread('a', 'active')],
      requestedThreadId: null,
      ensureThread: true,
      createThread,
    });
    expect(result.currentThread?.id).toBe('a');
    expect(createThread).not.toHaveBeenCalled();
  });

  it('creates a thread in the same request when asked and none is active', async () => {
    const createThread = vi.fn(async () => thread('new', 'active'));
    const result = await resolveBootstrapThread({
      threads: [thread('old', 'archived')],
      requestedThreadId: null,
      ensureThread: true,
      createThread,
    });
    expect(createThread).toHaveBeenCalledTimes(1);
    expect(result.currentThread?.id).toBe('new');
    expect(result.threads.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('never creates a thread for a plain bootstrap, which a hover prefetch sends', async () => {
    const createThread = vi.fn();
    const result = await resolveBootstrapThread({
      threads: [],
      requestedThreadId: null,
      ensureThread: false,
      createThread,
    });
    expect(result.currentThread).toBeUndefined();
    expect(createThread).not.toHaveBeenCalled();
  });

  it('opens a requested thread even when it is archived, and creates nothing', async () => {
    const createThread = vi.fn();
    const result = await resolveBootstrapThread({
      threads: [thread('a', 'active'), thread('old', 'archived')],
      requestedThreadId: 'old',
      ensureThread: true,
      createThread,
    });
    expect(result.currentThread?.id).toBe('old');
    expect(createThread).not.toHaveBeenCalled();
  });
});
