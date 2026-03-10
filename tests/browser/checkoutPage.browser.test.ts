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
      tierKey: 'tier_free',
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
  getCurrentSubscriptionSummary: vi.fn().mockResolvedValue(null),
  previewPaddleSubscriptionUpgrade: vi.fn(),
  applyPaddleSubscriptionUpgrade: vi.fn(),
  getPaddleSubscriptionManagementUrls: vi.fn(),
  startPaddleCheckoutSession: vi.fn().mockResolvedValue({
    provider: 'paddle',
    environment: 'sandbox',
    transactionId: 'txn_123',
    checkoutUrl: '/checkout?_ptxn=txn_123',
    tierKey: 'tier_mid',
  }),
  updateCurrentUserProfile: vi.fn().mockResolvedValue(undefined),
  acceptCurrentTerms: vi.fn().mockResolvedValue({ data: { termsVersion: '2026-03', acceptedAt: '2026-03-08T10:00:00Z' }, error: null }),
  processQueuedTripGenerationAfterAuth: vi.fn().mockResolvedValue({ tripId: 'trip_claimed_123' }),
  registerTripGenerationCompletionWatch: vi.fn(),
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
    getCurrentSubscriptionSummary: mocks.getCurrentSubscriptionSummary,
    previewPaddleSubscriptionUpgrade: mocks.previewPaddleSubscriptionUpgrade,
    applyPaddleSubscriptionUpgrade: mocks.applyPaddleSubscriptionUpgrade,
    getPaddleSubscriptionManagementUrls: mocks.getPaddleSubscriptionManagementUrls,
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

vi.mock('../../services/tripGenerationQueueService', () => ({
  processQueuedTripGenerationAfterAuth: mocks.processQueuedTripGenerationAfterAuth,
}));

vi.mock('../../services/tripGenerationCompletionWatchService', () => ({
  registerTripGenerationCompletionWatch: mocks.registerTripGenerationCompletionWatch,
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
    mocks.auth.access = { isAnonymous: false, tierKey: 'tier_free' };
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
    mocks.getCurrentSubscriptionSummary.mockResolvedValue(null);
    mocks.previewPaddleSubscriptionUpgrade.mockResolvedValue({
      mode: 'upgrade',
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_premium',
      providerSubscriptionId: 'sub_123',
      providerStatus: 'active',
      currentAmount: 900,
      currentCurrency: 'USD',
      recurringAmount: 1900,
      recurringCurrency: 'USD',
      immediateAmount: 1000,
      immediateCurrency: 'USD',
      prorationMessage: 'upgrade now',
    });
    mocks.applyPaddleSubscriptionUpgrade.mockResolvedValue({
      mode: 'upgrade_applied',
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_premium',
      providerSubscriptionId: 'sub_123',
      providerStatus: 'active',
      recurringAmount: 1900,
      recurringCurrency: 'USD',
      localSync: {
        status: 'processed',
        duplicate: false,
        reason: null,
      },
    });
    mocks.getPaddleSubscriptionManagementUrls.mockResolvedValue({
      provider: 'paddle',
      providerSubscriptionId: 'sub_123',
      cancelUrl: 'https://vendors.paddle.test/cancel',
      updatePaymentMethodUrl: 'https://vendors.paddle.test/manage',
      providerStatus: 'active',
      currentPeriodEnd: '2026-04-01T00:00:00.000Z',
      cancelAt: null,
      canceledAt: null,
      graceEndsAt: null,
    });
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
    mocks.auth.access = { isAnonymous: true, tierKey: 'tier_free' };

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
    mocks.auth.access = { isAnonymous: true, tierKey: 'tier_free' };
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
      tierKey: 'tier_free',
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

  it('starts the claimed trip after payment and prioritizes trip actions on success', async () => {
    let checkoutEventCallback: ((event: { name: string }) => void) | null = null;
    mocks.location.search = '?tier=tier_mid&source=trip_paywall_strip&claim=claim_123&return_to=%2Ftrip%2Ftrip_123&trip_id=trip_123&_ptxn=txn_123';
    mocks.initializePaddleJs.mockImplementation(async ({ eventCallback }: { eventCallback: (event: { name: string }) => void }) => {
      checkoutEventCallback = eventCallback;
      return true;
    });

    render(React.createElement(CheckoutPage));

    await waitFor(() => {
      expect(typeof checkoutEventCallback).toBe('function');
    });

    checkoutEventCallback?.({ name: 'checkout.completed' });

    await waitFor(() => {
      expect(mocks.processQueuedTripGenerationAfterAuth).toHaveBeenCalledWith('claim_123');
    });
    await waitFor(() => {
      expect(mocks.registerTripGenerationCompletionWatch).toHaveBeenCalledWith('trip_claimed_123', 'checkout_payment_completed');
    });

    expect(await screen.findByRole('link', { name: 'checkout.successOpenTrip' })).toHaveAttribute('href', '/trip/trip_claimed_123');
    expect(screen.getByRole('link', { name: 'checkout.successCreateTrip' })).toHaveAttribute('href', '/create-trip');
    expect(screen.queryByRole('link', { name: 'checkout.successOpenProfile' })).toBeNull();
  });

  it('renders an upgrade review flow for existing paid users and confirms the upgrade inline', async () => {
    const user = userEvent.setup();
    mocks.location.search = '?tier=tier_premium&source=pricing_page';
    mocks.auth.access = {
      isAnonymous: false,
      tierKey: 'tier_mid',
    };
    mocks.getCurrentSubscriptionSummary.mockResolvedValue({
      userId: 'user_123',
      provider: 'paddle',
      providerCustomerId: 'ctm_123',
      providerSubscriptionId: 'sub_123',
      providerPriceId: 'pri_mid',
      providerProductId: 'pro_mid',
      providerStatus: 'active',
      status: 'active',
      currentPeriodStart: '2026-03-01T00:00:00.000Z',
      currentPeriodEnd: '2026-04-01T00:00:00.000Z',
      cancelAt: null,
      canceledAt: null,
      graceEndsAt: null,
      currency: 'USD',
      amount: 900,
      lastEventId: 'evt_123',
      lastEventType: 'subscription.updated',
      lastEventAt: '2026-03-08T10:00:00.000Z',
    });
    mocks.fetchPaddlePublicConfig.mockResolvedValue({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: true,
      },
      issues: [],
    });

    render(React.createElement(CheckoutPage));

    await waitFor(() => {
      expect(mocks.previewPaddleSubscriptionUpgrade).toHaveBeenCalledWith('tier_premium');
      expect(screen.getByText('checkout.upgradeTitle')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'checkout.upgradeConfirmCta' }));

    await waitFor(() => {
      expect(mocks.applyPaddleSubscriptionUpgrade).toHaveBeenCalledWith({
        tierKey: 'tier_premium',
        source: 'pricing_page',
        claimId: null,
        returnTo: '/pricing',
        tripId: null,
      });
    });
  });
});
