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

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: sendMessageMock,
    status: 'ready',
    stop: vi.fn(),
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
});

const field = () => screen.getByPlaceholderText('placeholder') as HTMLTextAreaElement;

const insertPaceExample = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'examples.pace.label' }));
  });
};

describe('TripAgentChatSession examples', () => {
  it('writes an example into the prompt instead of sending it, and explains how to adapt it', async () => {
    renderSession();
    await insertPaceExample();
    expect(field().value).toBe('examples.pace.prompt|@Kyoto');
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(screen.getByText('exampleHint')).toBeTruthy();
    expect(field().getAttribute('aria-describedby')).toBe('trip-agent-example-hint');
    // The pills give way to the hint while the example is being adapted.
    expect(screen.queryByRole('button', { name: 'examples.stays.label' })).toBeNull();
  });

  it('opens the swap list for the example stop straight away, and swaps it from the keyboard', async () => {
    renderSession();
    await insertPaceExample();
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
    expect(field().value).toBe('examples.pace.prompt|@Osaka');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('reopens the swap list when a highlighted stop is clicked, or with Alt+ArrowDown on it', async () => {
    renderSession();
    await insertPaceExample();
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
    await insertPaceExample();
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Escape' });
    });
    expect(outerKeyDown).not.toHaveBeenCalled();
  });

  it('shows what a pill will write in a tooltip', async () => {
    renderSession();
    await act(async () => {
      fireEvent.focus(screen.getByRole('button', { name: 'examples.route.label' }));
    });
    expect((await screen.findAllByText('exampleTooltip')).length).toBeGreaterThan(0);
  });

  it('introduces the agent only on a trip without chats', () => {
    const { unmount } = renderSession({ showOnboarding: true });
    expect(screen.getByText('capabilitiesTitle')).toBeTruthy();
    unmount();
    renderSession();
    expect(screen.queryByText('capabilitiesTitle')).toBeNull();
  });
});
