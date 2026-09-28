// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../services/tripAgentService', () => ({
  archiveTripAgentThread: vi.fn(),
  createTripAgentThread: vi.fn(),
  readTripAgentError: () => ({ code: 'TRIP_AGENT_REQUEST_FAILED' }),
}));

const loadBootstrapMock = vi.fn();
let resolveChunk: (value: unknown) => void = () => undefined;
const chunkPromise = new Promise((resolve) => {
  resolveChunk = resolve;
});

vi.mock('../../components/trip-agent/tripAgentPrefetch', () => ({
  loadTripAgentBootstrapForPanel: (...args: unknown[]) => loadBootstrapMock(...args),
  loadTripAgentChatSessionModule: () => chunkPromise,
  readCachedTripAgentBootstrap: () => null,
}));

import { TripAgentPanel } from '../../components/trip-agent/TripAgentPanel';

const bootstrap = {
  actor: { userId: 'u1', label: 'U', isAdmin: false },
  threads: [{
    id: 't1',
    tripId: 'trip-1',
    title: 'Chat one',
    status: 'active',
    createdBy: 'u1',
    createdAt: '2026-09-28T08:00:00Z',
    updatedAt: '2026-09-28T08:00:00Z',
  }],
  currentThreadId: 't1',
  messages: [],
  quota: { remaining: 3, resetsAt: '2026-09-29T00:00:00Z' },
  changeSets: [],
};

const renderPanel = () => render(React.createElement(TripAgentPanel, {
  trip: { id: 'trip-1', title: 'Trip', items: [] } as never,
  contextRefs: [],
  isOpen: true,
  onClose: vi.fn(),
  onAdoptCommittedTripVersion: vi.fn(),
}));

afterEach(() => {
  loadBootstrapMock.mockReset();
});

describe('TripAgentPanel shell', () => {
  it('opens the dialog with a loading skeleton before the chat or its data arrive', () => {
    loadBootstrapMock.mockReturnValue(new Promise(() => undefined));
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'tripAgent.title' })).toBeTruthy();
    expect(screen.getByTestId('trip-agent-chat-skeleton').getAttribute('aria-busy')).toBe('true');
    // Controls that need the chat list stay off until it loads.
    expect((screen.getByRole('button', { name: 'tripAgent.history' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'tripAgent.close' }));
  });

  it('loads the chat once per open, not again after the thread id is known', async () => {
    loadBootstrapMock.mockResolvedValue(bootstrap);
    renderPanel();
    await waitFor(() => expect(screen.getByText('Chat one')).toBeTruthy());
    // Let any effect that would re-run on the new thread id do so.
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadBootstrapMock).toHaveBeenCalledTimes(1);
    expect(loadBootstrapMock).toHaveBeenCalledWith('trip-1', null);
  });

  it('swaps the skeleton for the chat once the chunk arrives', async () => {
    loadBootstrapMock.mockResolvedValue(bootstrap);
    renderPanel();
    await waitFor(() => expect(screen.getByText('Chat one')).toBeTruthy());
    expect(screen.getByTestId('trip-agent-chat-skeleton')).toBeTruthy();
    await act(async () => {
      resolveChunk({
        TripAgentChatSession: () => React.createElement('textarea', { 'aria-label': 'prompt' }),
      });
      await chunkPromise;
    });
    await waitFor(() => expect(screen.getByLabelText('prompt')).toBeTruthy());
    expect(screen.queryByTestId('trip-agent-chat-skeleton')).toBeNull();
  });
});
