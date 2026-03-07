// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  location: {
    pathname: '/pricing',
    search: '',
  },
  auth: {
    access: {
      isAnonymous: false,
    },
    isAuthenticated: true,
    isLoading: false,
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
    checkoutUrl: 'https://example.com/pricing?_ptxn=txn_123',
    tierKey: 'tier_mid',
  }),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
  useLocation: () => mocks.location,
}));

vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/analyticsService', () => ({
  getAnalyticsDebugAttributes: () => ({}),
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../services/billingService', () => ({
  startPaddleCheckoutSession: mocks.startPaddleCheckoutSession,
}));

vi.mock('../../services/paddleClient', () => ({
  PADDLE_INLINE_FRAME_TARGET_CLASS: 'tf-paddle-inline-frame',
  appendPaddleCheckoutContext: (checkoutUrl: string, tierKey: string) => `${checkoutUrl}&_tf_tier=${tierKey}`,
  extractPaddleCheckoutItemName: () => null,
  fetchPaddlePublicConfig: mocks.fetchPaddlePublicConfig,
  initializePaddleJs: mocks.initializePaddleJs,
  isPaddleClientConfigured: () => true,
  isPaddleTierCheckoutConfigured: (_config: unknown, tierKey: string) => tierKey === 'tier_mid',
  navigateToPaddleCheckout: mocks.navigateToPaddleCheckout,
  readPaddleCheckoutLocationContext: (search: string) => {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const tierKey = params.get('_tf_tier');
    return {
      transactionId: params.get('_ptxn'),
      tierKey: tierKey === 'tier_mid' || tierKey === 'tier_premium' ? tierKey : null,
    };
  },
}));

vi.mock('react-i18next', () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
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

import { PricingPage } from '../../pages/PricingPage';

describe('pages/PricingPage paddle checkout', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.location.pathname = '/pricing';
    mocks.location.search = '';
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.access = {
      isAnonymous: false,
    };
    mocks.fetchPaddlePublicConfig.mockResolvedValue({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: false,
      },
      issues: [],
    });
  });

  it('appends the tier context to the checkout return URL', async () => {
    const user = userEvent.setup();

    render(React.createElement(PricingPage));

    await user.click(screen.getByRole('button', { name: 'tiers.explorer.cta' }));

    await waitFor(() => {
      expect(mocks.startPaddleCheckoutSession).toHaveBeenCalledWith({
        tierKey: 'tier_mid',
        source: 'pricing_page',
      });
    });
    expect(mocks.navigateToPaddleCheckout).toHaveBeenCalledWith('https://example.com/pricing?_ptxn=txn_123&_tf_tier=tier_mid');
  });

  it('renders the inline checkout shell when a Paddle transaction is present in the URL', () => {
    mocks.location.search = '?_ptxn=txn_123&_tf_tier=tier_mid';

    const { container } = render(React.createElement(PricingPage));

    expect(container.querySelector('.tf-paddle-inline-frame')).not.toBeNull();
    expect(screen.getAllByText('tiers.explorer.name').length).toBeGreaterThan(1);
  });
});
