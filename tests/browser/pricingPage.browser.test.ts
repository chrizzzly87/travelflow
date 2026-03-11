// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  location: {
    pathname: '/pricing',
    search: '',
  },
  navigate: vi.fn(),
  auth: {
    isAuthenticated: false,
    access: {
      tierKey: 'tier_free',
      isAnonymous: false,
    },
    refreshAccess: vi.fn().mockResolvedValue(undefined),
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
    priceIds: {
      tier_mid: 'pri_mid',
      tier_premium: null,
    },
    issues: [],
  }),
  getCurrentSubscriptionSummary: vi.fn().mockResolvedValue(null),
  getPaddleSubscriptionManagementUrls: vi.fn().mockResolvedValue({
    provider: 'paddle',
    providerSubscriptionId: 'sub_123',
    cancelUrl: 'https://vendors.paddle.test/cancel',
    updatePaymentMethodUrl: 'https://vendors.paddle.test/manage',
    providerStatus: 'active',
    currentPeriodEnd: '2026-04-01T00:00:00.000Z',
    cancelAt: null,
    canceledAt: null,
    graceEndsAt: null,
  }),
  lookupPaddleDiscount: vi.fn().mockResolvedValue({
    code: 'SPRING20',
    type: 'percentage',
    amount: 20,
    currencyCode: 'USD',
    description: 'Spring 20% off',
    appliesToAllRecurring: true,
    maximumRecurringIntervals: null,
    applicableToTier: true,
    estimate: {
      originalAmount: 900,
      discountedAmount: 720,
      savingsAmount: 180,
      currencyCode: 'USD',
    },
  }),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/billingService', async () => {
  const actual = await vi.importActual('../../services/billingService');
  return {
    ...actual,
    getCurrentSubscriptionSummary: mocks.getCurrentSubscriptionSummary,
    getPaddleSubscriptionManagementUrls: mocks.getPaddleSubscriptionManagementUrls,
    lookupPaddleDiscount: mocks.lookupPaddleDiscount,
  };
});

vi.mock('../../services/analyticsService', () => ({
  getAnalyticsDebugAttributes: () => ({}),
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../services/paddleClient', () => ({
  fetchPaddlePublicConfig: mocks.fetchPaddlePublicConfig,
  isPaddleTierCheckoutConfigured: (config: any, tierKey: string) => {
    if (!config || config.issues?.length) return false;
    return tierKey === 'tier_mid' ? config.tierAvailability?.tier_mid === true : config.tierAvailability?.tier_premium === true;
  },
}));

vi.mock('react-i18next', () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean; count?: number; ns?: string }) => {
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

import { PricingPage } from '../../pages/PricingPage';

describe('pages/PricingPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = false;
    mocks.location.pathname = '/pricing';
    mocks.location.search = '';
    mocks.auth.access = {
      tierKey: 'tier_free',
      isAnonymous: false,
    };
    mocks.auth.refreshAccess.mockResolvedValue(undefined);
    mocks.getCurrentSubscriptionSummary.mockResolvedValue(null);
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
    mocks.fetchPaddlePublicConfig.mockResolvedValue({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: false,
      },
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: null,
      },
      issues: [],
    });
    mocks.lookupPaddleDiscount.mockClear();
  });

  it('routes paid plans into the dedicated checkout page', async () => {
    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'tiers.explorer.cta' })).toHaveAttribute(
        'href',
        '/checkout?tier=tier_mid&source=pricing_page&return_to=%2Fpricing',
      );
    });
  });

  it('applies a voucher code from the URL to paid checkout links', async () => {
    mocks.location.search = '?voucher=SPRING20';
    mocks.fetchPaddlePublicConfig.mockResolvedValue({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: true,
      },
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
      issues: [],
    });

    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'tiers.explorer.cta' })).toHaveAttribute(
        'href',
        '/checkout?tier=tier_mid&source=pricing_page&return_to=%2Fpricing&discount=SPRING20',
      );
    });
  });

  it('does not render the voucher entry form on pricing', async () => {
    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('voucher.placeholder')).not.toBeInTheDocument();
    });
  });

  it('keeps unconfigured paid tiers disabled on pricing', async () => {
    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tiers.globetrotter.cta' })).toBeDisabled();
    });
  });

  it('shows current-plan and upgrade states for an existing paid subscriber', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.access = {
      tierKey: 'tier_mid',
      isAnonymous: false,
    };
    mocks.fetchPaddlePublicConfig.mockResolvedValue({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: true,
      },
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
      issues: [],
    });
    mocks.getCurrentSubscriptionSummary.mockResolvedValue({
      userId: 'user_1',
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
      lastEventId: 'evt_1',
      lastEventType: 'subscription.updated',
      lastEventAt: '2026-03-08T10:00:00.000Z',
    });

    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'shared.currentPlanCta' })).toBeDisabled();
      expect(screen.getByRole('link', { name: 'shared.upgradeCta' })).toHaveAttribute(
        'href',
        '/checkout?tier=tier_premium&source=pricing_page&return_to=%2Fpricing',
      );
    });
  });

  it('treats a synced paid subscription as the effective current tier even when access still says free', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.access = {
      tierKey: 'tier_free',
      isAnonymous: false,
    };
    mocks.fetchPaddlePublicConfig.mockResolvedValue({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: true,
      },
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
      issues: [],
    });
    mocks.getCurrentSubscriptionSummary.mockResolvedValue({
      userId: 'user_1',
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
      lastEventId: 'evt_1',
      lastEventType: 'subscription.updated',
      lastEventAt: '2026-03-08T10:00:00.000Z',
    });

    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'shared.currentPlanCta' })).toBeDisabled();
      expect(screen.getByRole('link', { name: 'shared.upgradeCta' })).toHaveAttribute(
        'href',
        '/checkout?tier=tier_premium&source=pricing_page&return_to=%2Fpricing',
      );
    });
  });

  it('attempts a one-time billing repair when a paid account is missing the local summary row', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.access = {
      tierKey: 'tier_mid',
      isAnonymous: false,
    };
    mocks.getCurrentSubscriptionSummary
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        userId: 'user_1',
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
        lastEventId: 'evt_1',
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
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
      issues: [],
    });

    render(React.createElement(PricingPage));

    await waitFor(() => {
      expect(mocks.getPaddleSubscriptionManagementUrls).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'shared.currentPlanCta' })).toBeDisabled();
    });
  });
});
