// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], options?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0] : key;
      return options && 'count' in options ? `${resolved}:${options.count}` : resolved;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

const createThreadMock = vi.fn();
const archiveThreadMock = vi.fn();
const restoreThreadMock = vi.fn();

vi.mock('../../services/tripAgentService', () => ({
  archiveTripAgentThread: (...args: unknown[]) => archiveThreadMock(...args),
  createTripAgentThread: (...args: unknown[]) => createThreadMock(...args),
  restoreTripAgentThread: (...args: unknown[]) => restoreThreadMock(...args),
  readTripAgentError: () => ({ code: 'TRIP_AGENT_REQUEST_FAILED' }),
}));

let sessionThread: string | null = null;
const writeSessionMock = vi.fn();

vi.mock('../../components/trip-agent/tripAgentPanelState', () => ({
  TRIP_AGENT_DRAFT_SESSION_VALUE: 'draft',
  readTripAgentSessionThread: () => sessionThread,
  writeTripAgentSessionThread: (...args: unknown[]) => writeSessionMock(...args),
}));

interface SessionProps {
  thread: { id: string; title: string };
  initialMessages: unknown[];
  recentChats?: Array<{ id: string; title: string }>;
  onOpenChat?: (id: string) => void;
  onBeforeSend?: (id: string) => Promise<void>;
}

// Stands in for the lazy chat chunk and shows what the shell handed it.
const FakeChatSession: React.FC<SessionProps> = ({ thread, initialMessages, recentChats = [], onOpenChat, onBeforeSend }) => (
  React.createElement('div', { 'data-testid': 'chat', 'data-thread': thread.id, 'data-messages': initialMessages.length },
    React.createElement('textarea', { 'aria-label': 'prompt' }),
    React.createElement('button', { type: 'button', onClick: () => void onBeforeSend?.(thread.id) }, 'send'),
    ...recentChats.map((chat) => React.createElement('button', {
      key: chat.id,
      type: 'button',
      onClick: () => onOpenChat?.(chat.id),
    }, `recent:${chat.title}`)),
  )
);

const loadBootstrapMock = vi.fn();
let resolveChunk: () => void = () => undefined;
const chunkPromise = new Promise<{ TripAgentChatSession: React.FC<SessionProps> }>((resolve) => {
  resolveChunk = () => resolve({ TripAgentChatSession: FakeChatSession });
});

vi.mock('../../components/trip-agent/tripAgentPrefetch', () => ({
  loadTripAgentBootstrapForPanel: (...args: unknown[]) => loadBootstrapMock(...args),
  loadTripAgentChatSessionModule: () => chunkPromise,
  readCachedTripAgentBootstrap: () => null,
}));

import { TripAgentPanel } from '../../components/trip-agent/TripAgentPanel';

const thread = (id: string, title: string, status: 'active' | 'archived' = 'active') => ({
  id,
  tripId: 'trip-1',
  title,
  status,
  createdBy: 'u1',
  createdAt: '2026-09-28T08:00:00Z',
  updatedAt: '2026-09-28T08:00:00Z',
});

const bootstrapFor = (currentThreadId: string | null) => ({
  actor: { userId: 'u1', label: 'U', isAdmin: false },
  threads: [thread('t1', 'Relaxed route'), thread('t2', 'East coast'), thread('t0', 'Old idea', 'archived')],
  currentThreadId,
  messages: currentThreadId ? [{ id: 'm1' }, { id: 'm2' }] : [],
  quota: { enabled: true, limit: 3, used: 0, remaining: 3, resetsAt: '2026-09-29T00:00:00Z' },
  changeSets: [],
});

const onClose = vi.fn();
const renderPanel = () => render(React.createElement(TripAgentPanel, {
  trip: { id: 'trip-1', title: 'Trip', items: [] } as never,
  contextRefs: [],
  isOpen: true,
  onClose,
  onAdoptCommittedTripVersion: vi.fn(),
}));

beforeEach(() => {
  sessionThread = null;
  loadBootstrapMock.mockImplementation(async (_tripId: string, threadId: string | null) => bootstrapFor(threadId ?? 't1'));
  createThreadMock.mockResolvedValue(thread('saved', 'x'));
  archiveThreadMock.mockResolvedValue({ ok: true });
  restoreThreadMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

const loadChunk = async () => {
  await act(async () => {
    resolveChunk();
    await chunkPromise;
  });
};

describe('TripAgentPanel', () => {
  it('opens at once with a skeleton while the chat chunk is still loading', () => {
    loadBootstrapMock.mockReturnValue(new Promise(() => undefined));
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'tripAgent.title' })).toBeTruthy();
    expect(screen.getByTestId('trip-agent-chat-skeleton').getAttribute('aria-busy')).toBe('true');
    // New chat needs no server, so it is never disabled.
    expect((screen.getByRole('button', { name: 'tripAgent.newChat' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('starts a new session with a fresh draft, without waiting for or switching to the last chat', async () => {
    loadBootstrapMock.mockReturnValue(new Promise(() => undefined));
    await loadChunk();
    renderPanel();
    const chat = await screen.findByTestId('chat');
    expect(chat.getAttribute('data-messages')).toBe('0');
    expect(screen.getByRole('button', { name: 'tripAgent.newChat tripAgent.history', expanded: false })).toBeTruthy();
    expect(loadBootstrapMock).toHaveBeenCalledWith('trip-1', null);
    expect(createThreadMock).not.toHaveBeenCalled();
  });

  it('offers recent chats in a fresh draft once the list arrives, and opens one', async () => {
    await loadChunk();
    renderPanel();
    const draftId = (await screen.findByTestId('chat')).getAttribute('data-thread');
    const recent = await screen.findByRole('button', { name: 'recent:Relaxed route' });
    // The server's most recent chat did not replace the draft.
    expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe(draftId);
    fireEvent.click(recent);
    await waitFor(() => expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe('t1'));
    expect(writeSessionMock).toHaveBeenLastCalledWith('trip-1', 't1');
  });

  it('resumes the chat this tab had open, with a single load', async () => {
    sessionThread = 't2';
    await loadChunk();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe('t2'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('chat').getAttribute('data-messages')).toBe('2');
    expect(loadBootstrapMock).toHaveBeenCalledTimes(1);
    expect(loadBootstrapMock).toHaveBeenCalledWith('trip-1', 't2');
  });

  it('opens a new chat instantly, with no server call', async () => {
    sessionThread = 't1';
    await loadChunk();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe('t1'));
    loadBootstrapMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'tripAgent.newChat' }));
    const chat = screen.getByTestId('chat');
    expect(chat.getAttribute('data-thread')).not.toBe('t1');
    expect(chat.getAttribute('data-messages')).toBe('0');
    expect(createThreadMock).not.toHaveBeenCalled();
    expect(loadBootstrapMock).not.toHaveBeenCalled();
    expect(writeSessionMock).toHaveBeenLastCalledWith('trip-1', 'draft');
  });

  it('saves a draft once, under its own id, when its first message is sent', async () => {
    await loadChunk();
    renderPanel();
    const draftId = (await screen.findByTestId('chat')).getAttribute('data-thread');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(writeSessionMock).toHaveBeenLastCalledWith('trip-1', draftId));
    expect(createThreadMock).toHaveBeenCalledTimes(1);
    expect(createThreadMock).toHaveBeenCalledWith('trip-1', draftId);
  });

  it('keeps an untouched draft when New chat is pressed again', async () => {
    await loadChunk();
    renderPanel();
    const draftId = (await screen.findByTestId('chat')).getAttribute('data-thread');
    fireEvent.click(screen.getByRole('button', { name: 'tripAgent.newChat' }));
    expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe(draftId);
  });

  it('shows history inside the panel with row actions, and archiving the open chat starts a draft', async () => {
    sessionThread = 't1';
    await loadChunk();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe('t1'));
    fireEvent.click(screen.getByRole('button', { name: 'Relaxed route tripAgent.history' }));
    expect(screen.getByRole('searchbox', { name: 'tripAgent.searchChats' })).toBeTruthy();
    const currentRow = screen.getByRole('button', { name: 'Relaxed route', current: true }).closest('li') as HTMLElement;
    // The archive action lives inside its row, not below it.
    fireEvent.click(within(currentRow).getByRole('button', { name: 'tripAgent.archive' }));
    expect(archiveThreadMock).toHaveBeenCalledWith('trip-1', 't1');
    expect(screen.queryByRole('button', { name: 'Relaxed route' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'tripAgent.backToChat' }));
    expect(screen.getByTestId('chat').getAttribute('data-thread')).not.toBe('t1');
  });

  it('filters chats by search and restores an archived one', async () => {
    sessionThread = 't1';
    await loadChunk();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe('t1'));
    fireEvent.click(screen.getByRole('button', { name: 'Relaxed route tripAgent.history' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'east' } });
    expect(screen.getByRole('button', { name: 'East coast' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Relaxed route' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'tripAgent.archivedChats:1' }));
    fireEvent.click(screen.getByRole('button', { name: /tripAgent.restoreChat/ }));
    expect(restoreThreadMock).toHaveBeenCalledWith('trip-1', 't0');
    expect(screen.queryByText('Old idea')).toBeNull();
  });

  it('steps back out of history on Escape before closing the panel', async () => {
    sessionThread = 't1';
    await loadChunk();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('chat').getAttribute('data-thread')).toBe('t1'));
    fireEvent.click(screen.getByRole('button', { name: 'Relaxed route tripAgent.history' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
