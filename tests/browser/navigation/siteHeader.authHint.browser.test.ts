// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(() => new Promise(() => {})),
  getCurrentAccessContext: vi.fn().mockResolvedValue({
    userId: 'user-123',
    email: 'traveler@example.com',
    isAnonymous: false,
    role: 'user',
    tierKey: 'tier_free',
    entitlements: {},
    onboardingCompleted: true,
    accountStatus: 'active',
    termsCurrentVersion: null,
    termsRequiresReaccept: false,
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    termsAcceptanceRequired: false,
    termsNoticeRequired: false,
  }),
  subscribeToAuthState: vi.fn(() => () => undefined),
  openLoginModal: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('../../../services/authService', () => ({
  getCurrentAccessContext: mocks.getCurrentAccessContext,
  subscribeToAuthState: mocks.subscribeToAuthState,
}));

vi.mock('../../../services/profileService', () => ({
  getCurrentUserProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../hooks/useHasSavedTrips', () => ({
  useHasSavedTrips: () => false,
}));

vi.mock('../../../hooks/useLoginModal', () => ({
  useLoginModal: () => ({
    openLoginModal: mocks.openLoginModal,
  }),
}));

vi.mock('../../../components/navigation/LanguageSelect', () => ({
  LanguageSelect: () => React.createElement('div', { 'data-testid': 'language-select' }, 'Language'),
}));

vi.mock('../../../components/navigation/AppBrand', () => ({
  AppBrand: () => React.createElement('span', null, 'TravelFlow'),
}));

vi.mock('../../../components/navigation/MobileMenu', () => ({
  MobileMenu: () => null,
}));

vi.mock('../../../components/navigation/AccountMenu', () => ({
  AccountMenu: () => React.createElement('div', { 'data-testid': 'account-menu' }, 'Account'),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const dictionary: Record<string, string> = {
          'nav.features': 'Features',
          'nav.inspirations': 'Inspirations',
          'nav.updates': 'News & Updates',
          'nav.blog': 'Blog',
          'nav.pricing': 'Pricing',
          'nav.login': 'Login',
          'nav.createTrip': 'Create Trip',
          'nav.openMenu': 'Open menu',
          'language.label': 'Language',
        };
        return dictionary[key] ?? key;
      },
      i18n: {
        language: 'en',
        resolvedLanguage: 'en',
        changeLanguage: vi.fn().mockResolvedValue(undefined),
      },
    }),
  };
});

import { AuthProvider } from '../../../contexts/AuthContext';
import { SiteHeader } from '../../../components/navigation/SiteHeader';

describe('components/navigation/SiteHeader auth bootstrap hint', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('tf_auth_session_persistence_v1', 'persistent');
    window.localStorage.setItem('sb-demo-auth-token', JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 2_000_000_000,
      user: {
        id: 'user-123',
        email: 'traveler@example.com',
        app_metadata: { provider: 'email', providers: ['email'] },
      },
    }));
  });

  it('does not render the Login CTA on marketing routes while auth bootstrap is still pending', () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/blog'] },
        React.createElement(
          AuthProvider,
          null,
          React.createElement(SiteHeader)
        )
      )
    );

    expect(screen.queryByText('Login')).toBeNull();
    expect(screen.getByRole('link', { name: 'Create Trip' })).toHaveAttribute('href', '/create-trip');
  });
});
