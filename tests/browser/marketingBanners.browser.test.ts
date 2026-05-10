// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  location: null as { pathname: string; search: string; hash: string } | null,
  navigate: vi.fn(),
  changeLanguage: vi.fn().mockResolvedValue(undefined),
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
    ...props,
  }, children),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const dictionary: Record<string, string> = {
        'cookieBanner.message': `${String(values?.appName ?? 'TravelFlow')} uses cookies to improve your trip planning experience.`,
        'cookieBanner.policyLinkLabel': 'Cookie Policy',
        'buttons.essentialOnly': 'Essential only',
        'buttons.acceptAll': 'Accept all',
      };
      return dictionary[key] ?? key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
      changeLanguage: mocks.changeLanguage,
    },
  }),
}));

vi.mock('../../i18n', () => ({
  default: {
    changeLanguage: mocks.changeLanguage,
  },
  preloadLocaleNamespaces: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

import { CookieConsentBanner } from '../../components/marketing/CookieConsentBanner';
import { LanguageSuggestionBanner } from '../../components/navigation/LanguageSuggestionBanner';
import { CONSENT_STORAGE_KEY } from '../../services/consentService';

describe('marketing banner crash guards', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.location = null;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/pricing#plans');
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['de-DE'],
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'de-DE',
    });
  });

  it('accepts cookie consent when the router location is temporarily unavailable', async () => {
    const user = userEvent.setup();
    render(React.createElement(CookieConsentBanner));

    await user.click(screen.getByRole('button', { name: 'Accept all' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Accept all' })).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('all');
  });

  it('dismisses the language suggestion when the router location is temporarily unavailable', async () => {
    const user = userEvent.setup();
    render(React.createElement(LanguageSuggestionBanner));

    expect(screen.getByText('Diese Seite ist auch auf Deutsch verfügbar.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sprachhinweis schließen' }));

    await waitFor(() => {
      expect(screen.queryByText('Diese Seite ist auch auf Deutsch verfügbar.')).not.toBeInTheDocument();
    });
    expect(window.sessionStorage.getItem('tf_locale_suggestion_dismissed_session')).toBe('1');
  });
});
