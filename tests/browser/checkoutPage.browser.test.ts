// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  location: {
    pathname: '/checkout',
    search: '?tier=tier_mid&source=trip_paywall_strip&claim=claim_123&return_to=%2Ftrip%2Ftrip_123&trip_id=trip_123',
    hash: '',
  },
  navigate: vi.fn(),
  auth: {
    session: {
      user: {
        email: 'ada@example.com',
      },
    },
    access: {
      isAnonymous: false,
    },
    isAuthenticated: true,
    isLoading: false,
    isProfileLoading: false,
    profile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      bio: 'Maps before meals.',
      country: 'DE',
      city: 'Berlin',
      preferredLanguage: 'en',
      publicProfileEnabled: true,
      defaultPublicTripVisibility: true,
      username: 'ada',
      usernameDisplay: 'ada',
      gender: '',
    },
    refreshAccess: vi.fn().mockResolvedValue(undefined),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    loginWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_123' } } }, error: null }),
    registerWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_123' } } }, error: null }),
  },
  fetchPaddlePublicConfig: vi.fn().mockResolvedValue({
    provider: 'paddle',
    environment: 'sandbox',
    checkoutEnabled: true,
    clientTokenConfigured: true,
    tierAvailability: {
      tier_mid: true,
      tier_premium: false,
    },
    issues: [],
  }),
  initializePaddleJs: vi.fn().mockResolvedValue(true),
  navigateToPaddleCheckout: vi.fn(),
  startPaddleCheckoutSession: vi.fn().mockResolvedValue({
    provider: 'paddle',
    environment: 'sandbox',
    transactionId: 'txn_123',
    checkoutUrl: '/checkout?_ptxn=txn_123',
    tierKey: 'tier_mid',
  }),
  updateCurrentUserProfile: vi.fn().mockResolvedValue(undefined),
  acceptCurrentTerms: vi.fn().mockResolvedValue({ data: { termsVersion: '2026-03', acceptedAt: '2026-03-08T10:00:00Z' }, error: null }),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
  NavLink: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../components/marketing/SiteFooter', () => ({
  SiteFooter: () => React.createElement('div', { 'data-testid': 'site-footer' }),
}));

vi.mock('../../components/profile/ProfileCountryRegionSelect', () => ({
  ProfileCountryRegionSelect: ({ value, onValueChange }: { value: string; onValueChange: (nextValue: string) => void }) => (
    React.createElement('input', {
      'aria-label': 'country-select',
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value),
    })
  ),
}));

vi.mock('../../components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (next: boolean) => void }) => (
    React.createElement('button', {
      type: 'button',
      'aria-pressed': checked,
      onClick: () => onCheckedChange?.(!checked),
      ...props,
    }, checked ? 'checked' : 'unchecked')
  ),
}));

vi.mock('../../components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  TabsList: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  TabsTrigger: ({ children, value, onClick, disabled }: { children: React.ReactNode; value: string; onClick?: () => void; disabled?: boolean }) => (
    React.createElement('button', { type: 'button', onClick, disabled, 'data-value': value }, children)
  ),
}));

vi.mock('../../components/ui/appToast', () => ({
  showAppToast: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/analyticsService', () => ({
  getAnalyticsDebugAttributes: () => ({}),
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../services/authService', () => ({
  acceptCurrentTerms: mocks.acceptCurrentTerms,
}));

vi.mock('../../services/billingService', async () => {
  const actual = await vi.importActual('../../services/billingService');
  return {
    ...actual,
    startPaddleCheckoutSession: mocks.startPaddleCheckoutSession,
  };
});

vi.mock('../../services/paddleClient', async () => {
  const actual = await vi.importActual('../../services/paddleClient');
  return {
    ...actual,
    fetchPaddlePublicConfig: mocks.fetchPaddlePublicConfig,
    initializePaddleJs: mocks.initializePaddleJs,
    navigateToPaddleCheckout: mocks.navigateToPaddleCheckout,
  };
});

vi.mock('../../services/profileService', () => ({
  updateCurrentUserProfile: mocks.updateCurrentUserProfile,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean; count?: number }) => {
      if (options?.returnObjects && key.endsWith('.features')) {
        return ['feature_one', 'feature_two'];
      }
      if (key === 'shared.days') {
        return `${options?.count ?? 0} days`;
      }
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { CheckoutPage } from '../../pages/CheckoutPage';

describe('pages/CheckoutPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.location.pathname = '/checkout';
    mocks.location.search = '?tier=tier_mid&source=trip_paywall_strip&claim=claim_123&return_to=%2Ftrip%2Ftrip_123&trip_id=trip_123';
    mocks.location.hash = '';
    mocks.auth.session = {
      user: {
        email: 'ada@example.com',
      },
    };
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.isProfileLoading = false;
    mocks.auth.access = { isAnonymous: false };
    mocks.auth.profile = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      bio: 'Maps before meals.',
      country: 'DE',
      city: 'Berlin',
      preferredLanguage: 'en',
      publicProfileEnabled: true,
      defaultPublicTripVisibility: true,
      username: 'ada',
      usernameDisplay: 'ada',
      gender: '',
    };
    mocks.auth.refreshAccess.mockResolvedValue(undefined);
  });

  it('preserves trip and claim metadata when starting checkout from the dedicated route', async () => {
    const user = userEvent.setup();

    render(React.createElement(CheckoutPage));

    await user.click(screen.getByRole('button', { name: 'checkout.continueToPayment' }));

    await waitFor(() => {
      expect(mocks.startPaddleCheckoutSession).toHaveBeenCalledWith({
        tierKey: 'tier_mid',
        source: 'trip_paywall_strip',
        claimId: 'claim_123',
        returnTo: '/trip/trip_123',
        tripId: 'trip_123',
      });
    });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(
        '/checkout?_ptxn=txn_123&tier=tier_mid&source=trip_paywall_strip&claim=claim_123&return_to=%2Ftrip%2Ftrip_123&trip_id=trip_123',
      );
    });
    expect(mocks.navigateToPaddleCheckout).not.toHaveBeenCalled();
  });

  it('keeps signed-out users inside the checkout page and submits inline login', async () => {
    const user = userEvent.setup();
    mocks.auth.session = null;
    mocks.auth.isAuthenticated = false;
    mocks.auth.access = { isAnonymous: true };

    render(React.createElement(CheckoutPage));

    expect(screen.queryByRole('link', { name: 'checkout.loginCta' })).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'labels.email' }), 'traveler@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'actions.submitLogin' }));

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('traveler@example.com', 'password123');
    });

    expect(mocks.startPaddleCheckoutSession).not.toHaveBeenCalled();
  });

  it('adds the signup terms-finalization marker to register email redirects', async () => {
    const user = userEvent.setup();
    mocks.auth.session = null;
    mocks.auth.isAuthenticated = false;
    mocks.auth.access = { isAnonymous: true };
    mocks.auth.registerWithPassword.mockResolvedValueOnce({
      error: null,
      data: { session: null },
    });

    render(React.createElement(CheckoutPage));

    await user.click(screen.getByRole('button', { name: 'tabs.register' }));
    await user.type(screen.getByRole('textbox', { name: 'labels.email' }), 'new-user@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'errors.terms_required' }));
    await user.click(screen.getByRole('button', { name: 'actions.submitRegister' }));

    await waitFor(() => {
      expect(mocks.auth.registerWithPassword).toHaveBeenCalledWith(
        'new-user@example.com',
        'password123',
        expect.objectContaining({
          emailRedirectTo: expect.stringContaining('signup_accept_terms=1'),
        }),
      );
    });
  });

  it('auto-accepts pending signup terms after confirmed email and keeps the user on checkout', async () => {
    mocks.location.search = '?tier=tier_mid&source=pricing_page&signup_accept_terms=1';
    mocks.auth.access = {
      isAnonymous: false,
      termsAcceptanceRequired: true,
    };

    render(React.createElement(CheckoutPage));

    await waitFor(() => {
      expect(mocks.acceptCurrentTerms).toHaveBeenCalledWith({
        locale: 'en',
        source: 'signup_checkout_email_confirmation',
      });
    });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/checkout?tier=tier_mid&source=pricing_page', { replace: true });
    });
  });

  it('keeps traveler details editable when an inline checkout transaction already exists', () => {
    mocks.location.search = '?tier=tier_mid&source=pricing_page&_ptxn=txn_123';

    render(React.createElement(CheckoutPage));

    expect(screen.getByDisplayValue('Ada')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'checkout.refreshPayment' })).toBeInTheDocument();
  });
});
