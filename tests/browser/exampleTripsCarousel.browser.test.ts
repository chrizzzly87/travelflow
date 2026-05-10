// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', {
    href: to,
    'data-router-link': 'true',
    ...props,
  }, children),
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        'examples.title': 'Example trips',
        'examples.subtitle': 'Browse route ideas',
      };
      return dictionary[key] ?? key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../data/exampleTripCards', () => ({
  exampleTripCards: [
    {
      id: 'japan',
      templateId: 'japan',
      title: 'Japan Highlights',
    },
  ],
  getExampleTripUiCopy: () => ({
    moreInspirationsCta: 'More inspirations',
  }),
}));

vi.mock('../../data/exampleTripTemplates', () => ({
  getExampleTemplateMiniCalendar: () => null,
  TRIP_FACTORIES: {},
}));

vi.mock('../../components/marketing/ExampleTripCard', () => ({
  ExampleTripCard: ({ card }: { card: { title: string } }) => (
    React.createElement('article', null, card.title)
  ),
}));

import { ExampleTripsCarousel } from '../../components/marketing/ExampleTripsCarousel';

describe('ExampleTripsCarousel', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.ResizeObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;
  });

  it('renders its inspirations CTA as a Router link with a stable href', () => {
    render(React.createElement(ExampleTripsCarousel));

    const cta = screen.getByRole('link', { name: /more inspirations/i });
    expect(cta).toHaveAttribute('href', '/inspirations');
    expect(cta).toHaveAttribute('data-router-link', 'true');

    cta.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(cta);

    expect(mocks.trackEvent).toHaveBeenCalledWith('home__carousel_cta--inspirations');
  });
});
