// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { AddToCalendarCard } from '../../components/AddToCalendarCard';
import type { BlogCalendarCardConfig } from '../../services/blogCalendarCardService';

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'post.calendarCard.badge': 'Zum Kalender hinzufügen',
        'post.calendarCard.downloadIcs': '.ics herunterladen',
        'post.calendarCard.eventCount': `${options?.count ?? 0} Termine im Paket`,
        'post.calendarCard.compatibilityHint': 'Eine .ics-Datei funktioniert in Apple Kalender, Google Kalender und Outlook.',
      };
      return translations[key] ?? key;
    },
  }),
}));

const createObjectURLMock = vi.fn(() => 'blob:test-calendar');
const revokeObjectURLMock = vi.fn();

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('components/AddToCalendarCard', () => {
  beforeEach(() => {
    cleanup();
    analyticsMocks.trackEvent.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('renders a single .ics download action without per-provider quick-add links', () => {
    const config: BlogCalendarCardConfig = {
      title: 'Krokusblütenfest 2026',
      description: 'Gesamter Zeitplan für dein Wochenende',
      filename: 'husum-krokusbluetenfest-2026',
      timezone: 'Europe/Berlin',
      events: [
        {
          id: 'event-1',
          title: 'Eröffnung',
          start: '2026-03-14T11:00:00.000Z',
          end: '2026-03-14T12:00:00.000Z',
          location: 'Altes Rathaus Husum',
          description: 'Krönung der Krokusblütenmajestät',
        },
      ],
    };

    render(
      <AddToCalendarCard
        config={config}
        postSlug="husum-weekend-krokusbluetenfest"
      />
    );

    expect(screen.getByText('Zum Kalender hinzufügen')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('download', 'husum-krokusbluetenfest-2026.ics');
    expect(screen.queryByRole('link', { name: /Google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Outlook/i })).not.toBeInTheDocument();
  });
});
