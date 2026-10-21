// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (
      options?.city ? `${key}|${String(options.city)}` : key
    ),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

const sendMessageMock = vi.fn();
const stopMock = vi.fn();
let chatStatus: 'ready' | 'streaming' = 'ready';

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: sendMessageMock,
    status: chatStatus,
    stop: stopMock,
    error: undefined,
    clearError: vi.fn(),
  }),
}));

vi.mock('ai', () => ({
  DefaultChatTransport: class {
    constructor(readonly options: unknown) {}
  },
}));

// jsdom has no layout: the scroller measures itself and the list scrolls
// its active option into view.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { TripAgentChatSession } from '../../components/trip-agent/TripAgentChatSession';

const renderSession = (props: Partial<React.ComponentProps<typeof TripAgentChatSession>> = {}) => render(
  React.createElement(TripAgentChatSession, {
    trip: {
      id: 'trip-1',
      title: 'Japan',
      items: [
        { id: 'c1', type: 'city', title: 'Kyoto', startDateOffset: 0, duration: 3 },
        { id: 'c2', type: 'city', title: 'Osaka', startDateOffset: 3, duration: 2 },
      ],
    } as never,
    thread: { id: 't1', tripId: 'trip-1', title: '', status: 'active', createdBy: '', createdAt: '', updatedAt: '' },
    initialMessages: [],
    contextRefs: [],
    quota: { enabled: true, limit: 3, used: 0, remaining: 3, resetsAt: '2026-09-29T00:00:00Z' },
    actorId: 'u1',
    onQuotaMayHaveChanged: vi.fn(),
    onAdoptCommittedTripVersion: vi.fn(),
    ...props,
  }),
);

afterEach(() => {
  sendMessageMock.mockReset();
  stopMock.mockReset();
  chatStatus = 'ready';
});

const field = () => screen.getByPlaceholderText('placeholder') as HTMLTextAreaElement;

const insertActivitiesExample = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'examples.activities.label' }));
  });
};

describe('TripAgentChatSession examples', () => {
  it('writes an example into the prompt instead of sending it, and explains how to adapt it', async () => {
    renderSession();
    await insertActivitiesExample();
    expect(field().value).toBe('examples.activities.prompt|@Kyoto');
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(screen.getByText('exampleHint')).toBeTruthy();
    expect(field().getAttribute('aria-describedby')).toBe('trip-agent-example-hint');
    // The pills give way to the hint while the example is being adapted.
    expect(screen.queryByRole('button', { name: 'examples.stays.label' })).toBeNull();
  });

  it('opens the swap list for the example stop straight away, and swaps it from the keyboard', async () => {
    renderSession();
    await insertActivitiesExample();
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options.some((text) => text?.includes('Osaka'))).toBe(true);
    // Move to Osaka and pick it with Enter.
    const osakaIndex = screen.getAllByRole('option').findIndex((option) => option.textContent?.includes('Osaka'));
    // One key per render, as a real keyboard delivers them.
    for (let step = 0; step < osakaIndex; step += 1) {
      await act(async () => {
        fireEvent.keyDown(field(), { key: 'ArrowDown' });
      });
    }
    expect(screen.getAllByRole('option')[osakaIndex].getAttribute('aria-selected')).toBe('true');
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Enter' });
    });
    expect(field().value).toBe('examples.activities.prompt|@Osaka');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('reopens the swap list when a highlighted stop is clicked, or with Alt+ArrowDown on it', async () => {
    renderSession();
    await insertActivitiesExample();
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Escape' });
    });
    expect(screen.queryByRole('listbox')).toBeNull();

    const mentionStart = field().value.indexOf('@Kyoto');
    field().setSelectionRange(mentionStart + 2, mentionStart + 2);
    await act(async () => {
      fireEvent.click(field());
    });
    expect(screen.getByRole('listbox')).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Escape' });
    });
    field().setSelectionRange(mentionStart + 1, mentionStart + 1);
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'ArrowDown', altKey: true });
    });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('keeps Escape inside the list, so it does not reach the panel', async () => {
    const outerKeyDown = vi.fn();
    render(React.createElement('div', { onKeyDown: (event: React.KeyboardEvent) => outerKeyDown(event.defaultPrevented) },
      React.createElement(TripAgentChatSession, {
        trip: { id: 'trip-1', title: 'Japan', items: [{ id: 'c1', type: 'city', title: 'Kyoto', startDateOffset: 0, duration: 3 }] } as never,
        thread: { id: 't1', tripId: 'trip-1', title: '', status: 'active', createdBy: '', createdAt: '', updatedAt: '' },
        initialMessages: [],
        contextRefs: [],
        quota: { enabled: true, limit: 3, used: 0, remaining: 3, resetsAt: '2026-09-29T00:00:00Z' },
        actorId: 'u1',
        onQuotaMayHaveChanged: vi.fn(),
        onAdoptCommittedTripVersion: vi.fn(),
      })));
    await insertActivitiesExample();
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Escape' });
    });
    expect(outerKeyDown).not.toHaveBeenCalled();
  });

  it('selects a whole stop on the first Backspace after it, and removes it on the second', async () => {
    renderSession();
    await insertActivitiesExample();
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Escape' });
    });
    const text = field().value;
    const end = text.indexOf('@Kyoto') + '@Kyoto'.length;
    field().setSelectionRange(end, end);
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Backspace' });
    });
    expect([field().selectionStart, field().selectionEnd]).toEqual([end - '@Kyoto'.length, end]);
    expect(field().value).toBe(text);
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Backspace' });
    });
    expect(field().value).toBe(text.replace('@Kyoto ', '').replace('@Kyoto', ''));
    expect(field().value).not.toContain('  ');
  });

  it('starts the swap list on the stop being swapped, and Space keeps it', async () => {
    renderSession();
    await insertActivitiesExample();
    const options = screen.getAllByRole('option');
    const kyoto = options.findIndex((option) => option.textContent?.includes('Kyoto'));
    expect(options[kyoto].getAttribute('aria-selected')).toBe('true');
    await act(async () => {
      fireEvent.keyDown(field(), { key: ' ' });
    });
    expect(field().value).toBe('examples.activities.prompt|@Kyoto');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the list on a click outside it, but not on a click inside', async () => {
    renderSession();
    await insertActivitiesExample();
    await act(async () => {
      fireEvent.pointerDown(screen.getByRole('listbox'));
    });
    expect(screen.getByRole('listbox')).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lets a running answer be stopped with the button even though the field is empty', async () => {
    chatStatus = 'streaming';
    renderSession();
    const stopButton = screen.getByRole('button', { name: 'stop' }) as HTMLButtonElement;
    expect(stopButton.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(stopButton);
    });
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('stops a running answer on Escape without closing the panel', async () => {
    chatStatus = 'streaming';
    const outerKeyDown = vi.fn();
    render(React.createElement('div', { onKeyDown: () => outerKeyDown() },
      React.createElement(TripAgentChatSession, {
        trip: { id: 'trip-1', title: 'Japan', items: [] } as never,
        thread: { id: 't1', tripId: 'trip-1', title: '', status: 'active', createdBy: '', createdAt: '', updatedAt: '' },
        initialMessages: [],
        contextRefs: [],
        quota: { enabled: true, limit: 3, used: 0, remaining: 3, resetsAt: '2026-09-29T00:00:00Z' },
        actorId: 'u1',
        onQuotaMayHaveChanged: vi.fn(),
        onAdoptCommittedTripVersion: vi.fn(),
      })));
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Escape' });
    });
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(outerKeyDown).not.toHaveBeenCalled();
  });

  it('describes what a pill will write through the app tooltip layer', () => {
    renderSession();
    expect(screen.getByRole('button', { name: 'examples.review.label' }).getAttribute('data-tooltip')).toBe('exampleTooltip');
  });

  it('introduces the agent only on a trip without chats', () => {
    const { unmount } = renderSession({ showOnboarding: true });
    expect(screen.getByText('capabilitiesTitle')).toBeTruthy();
    unmount();
    renderSession();
    expect(screen.queryByText('capabilitiesTitle')).toBeNull();
  });
});
