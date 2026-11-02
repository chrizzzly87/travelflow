// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from '@/tests/helpers/routerHarness';

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

vi.mock('../../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => ({ pathname: '/blog', search: '', hash: '', state: null, key: 'default' }) }));

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
          'nav.account': 'Account',
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

import { AuthProvider, useAuthContext } from '../../../contexts/AuthContext';
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

  it('keeps stored session hints out of the initial server-rendered auth state', () => {
    const Probe = () => React.createElement('output', null, useAuthContext().isAuthenticated ? 'account' : 'public');
    const html = renderToString(React.createElement(AuthProvider, null, React.createElement(Probe)));
    expect(html).toContain('public');
    expect(html).not.toContain('account');
  });

  it('does not grant session, access or authenticated authority from a stored hint after mount', () => {
    const Probe = () => {
      const auth = useAuthContext();
      return React.createElement('output', { 'data-testid': 'authority' }, JSON.stringify({
        session: auth.session, access: auth.access, authenticated: auth.isAuthenticated, loading: auth.isLoading,
      }));
    };
    render(React.createElement(AuthProvider, null, React.createElement(Probe)));
    expect(JSON.parse(screen.getByTestId('authority').textContent!)).toEqual({
      session: null, access: null, authenticated: false, loading: true,
    });
  });

  it('renders the permanent Account entry while auth bootstrap is pending', async () => {
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

    expect(await screen.findByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(await screen.findByRole('link', { name: 'Create Trip' })).toHaveAttribute('href', '/create-trip');
  });
  it('focuses the menu opener before mounting its dialog on a pointer-only activation', async () => {
    render(React.createElement(MemoryRouter, { initialEntries: ['/blog'] },
      React.createElement(AuthProvider, null, React.createElement(SiteHeader))));
    await screen.findByRole('button', { name: 'Account' });
    const trigger = document.querySelector<HTMLButtonElement>('[data-tf-boot-intent="mobile-menu"]')!;
    expect(document.activeElement).not.toBe(trigger);
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
  });

});
