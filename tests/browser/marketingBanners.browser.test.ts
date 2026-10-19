// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  location: null as { pathname: string; search: string; hash: string } | null,
  navigate: vi.fn(),
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn(),
}));

vi.mock('@/app/navigation', () => ({
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
import { CONSENT_STORAGE_KEY, saveConsent } from '../../services/consentService';

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

  it('includes undecided consent controls in the server document before interaction', () => {
    const html = renderToString(React.createElement(CookieConsentBanner));
    expect(html).toContain('Essential only');
    expect(html).toContain('Accept all');
    expect(html).toContain('data-tf-consent-banner');
  });

  it('accepts cookie consent when the router location is temporarily unavailable', async () => {
    const user = userEvent.setup();
    render(React.createElement(CookieConsentBanner));

    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('data-router-link', 'true');

    await user.click(screen.getByRole('button', { name: 'Accept all' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Accept all' })).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('all');
  });

  it('dismisses when consent is chosen from another control on the page', async () => {
    render(React.createElement(CookieConsentBanner));
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeVisible();
    act(() => saveConsent('essential'));
    expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull();
  });

  it('dismisses the language suggestion when the router location is temporarily unavailable', async () => {
    const user = userEvent.setup();
    render(React.createElement(LanguageSuggestionBanner));

    expect(await screen.findByText('Diese Seite ist auch auf Deutsch verfügbar.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sprachhinweis schließen' }));

    await waitFor(() => {
      expect(screen.queryByText('Diese Seite ist auch auf Deutsch verfügbar.')).not.toBeInTheDocument();
    });
    expect(window.sessionStorage.getItem('tf_locale_suggestion_dismissed_session')).toBe('1');
  });
});
