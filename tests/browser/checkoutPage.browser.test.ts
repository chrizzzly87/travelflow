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
    refreshProfile: vi.fn().mockResolvedValue(undefined),
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
    checkoutUrl: 'https://example.com/checkout?_ptxn=txn_123',
    tierKey: 'tier_mid',
  }),
  updateCurrentUserProfile: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../components/flags/FlagIcon', () => ({
  FlagIcon: () => React.createElement('span', { 'data-testid': 'flag-icon' }),
}));

vi.mock('../../components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (next: boolean) => void }) => (
    React.createElement('button', {
      type: 'button',
      'aria-pressed': checked,
      onClick: () => onCheckedChange(!checked),
      ...props,
    }, checked ? 'on' : 'off')
  ),
}));

vi.mock('../../components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  TabsList: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  TabsTrigger: ({ children, value, onClick, disabled }: { children: React.ReactNode; value: string; onClick?: () => void; disabled?: boolean }) => (
    React.createElement('button', { type: 'button', onClick, disabled, 'data-value': value }, children)
  ),
}));

vi.mock('../../components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => React.createElement('div', { 'data-value': value }, children),
  SelectTrigger: React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(({ children, ...props }, ref) => (
    React.createElement('button', { type: 'button', ref, ...props }, children)
  )),
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
    t: (key: string, options?: { returnObjects?: boolean; count?: number; total?: number; tierName?: string }) => {
      if (options?.returnObjects && key === 'benefits.items') {
        return ['benefit_one', 'benefit_two'];
      }
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

    expect(mocks.navigateToPaddleCheckout).toHaveBeenCalledWith(
      'https://example.com/checkout?_ptxn=txn_123&tier=tier_mid&source=trip_paywall_strip&claim=claim_123&return_to=%2Ftrip%2Ftrip_123&trip_id=trip_123',
    );
  });

  it('routes signed-out users through login while preserving the checkout context', async () => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.access = { isAnonymous: true };

    render(React.createElement(CheckoutPage));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'checkout.loginCta' })).toHaveAttribute(
        'href',
        '/login?next=%2Fcheckout%3Ftier%3Dtier_mid%26source%3Dtrip_paywall_strip%26claim%3Dclaim_123%26return_to%3D%252Ftrip%252Ftrip_123%26trip_id%3Dtrip_123&claim=claim_123',
      );
    });
  });
});
