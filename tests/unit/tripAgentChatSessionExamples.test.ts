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

// The conversation's stick-to-bottom scroller measures itself; jsdom cannot.
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
      items: [{ id: 'c1', type: 'city', title: 'Kyoto', startDateOffset: 0, duration: 3 }],
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

describe('TripAgentChatSession examples', () => {
  it('writes an example into the prompt instead of sending it, and explains how to adapt it', async () => {
    renderSession();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'tripAgent.examples.pace.label' }));
    });
    const field = screen.getByPlaceholderText('tripAgent.placeholder') as HTMLTextAreaElement;
    expect(field.value).toBe('tripAgent.examples.pace.prompt|@Kyoto');
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(screen.getByText('tripAgent.exampleHint')).toBeTruthy();
    // The pills give way to the hint while the example is being adapted.
    expect(screen.queryByRole('button', { name: 'tripAgent.examples.stays.label' })).toBeNull();
  });

  it('introduces the agent only on a trip without chats', () => {
    const { unmount } = renderSession({ showOnboarding: true });
    expect(screen.getByText('tripAgent.capabilitiesTitle')).toBeTruthy();
    unmount();
    renderSession();
    expect(screen.queryByText('tripAgent.capabilitiesTitle')).toBeNull();
  });
});
