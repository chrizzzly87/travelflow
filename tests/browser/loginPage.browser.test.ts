// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
  location: {
    pathname: '/login',
    search: '',
    hash: '',
    state: null as { from?: string } | null,
  },
  auth: {
    isLoading: false,
    isAuthenticated: false,
    isAnonymous: false,
    loginWithPassword: vi.fn().mockResolvedValue({ error: null }),
    registerWithPassword: vi.fn().mockResolvedValue({ error: null, data: { session: null } }),
    loginWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue({ error: null }),
  },
  runOpportunisticTripQueueCleanup: vi.fn().mockResolvedValue(undefined),
  processQueuedTripGenerationAfterAuth: vi.fn(),
  runOpportunisticAnonymousAssetClaimCleanup: vi.fn().mockResolvedValue(undefined),
  processAnonymousAssetClaimAfterAuth: vi.fn(),
  resolveAnonymousAssetClaimErrorCode: vi.fn().mockReturnValue('default'),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
  useSearchParams: () => [mocks.searchParams, vi.fn()],
}));

vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../services/tripGenerationQueueService', () => ({
  processQueuedTripGenerationAfterAuth: mocks.processQueuedTripGenerationAfterAuth,
  runOpportunisticTripQueueCleanup: mocks.runOpportunisticTripQueueCleanup,
}));

vi.mock('../../services/anonymousAssetClaimService', () => ({
  processAnonymousAssetClaimAfterAuth: mocks.processAnonymousAssetClaimAfterAuth,
  resolveAnonymousAssetClaimErrorCode: mocks.resolveAnonymousAssetClaimErrorCode,
  runOpportunisticAnonymousAssetClaimCleanup: mocks.runOpportunisticAnonymousAssetClaimCleanup,
}));

vi.mock('../../services/authNavigationService', () => ({
  buildPasswordResetRedirectUrl: () => 'https://example.com/auth/reset-password',
  clearRememberedAuthReturnPath: vi.fn(),
  getRememberedAuthReturnPath: () => null,
  rememberAuthReturnPath: vi.fn(),
  resolvePreferredNextPath: () => '/create-trip',
}));

vi.mock('../../services/authUiPreferencesService', () => ({
  clearPendingOAuthProvider: vi.fn(),
  getLastUsedOAuthProvider: () => null,
  setPendingOAuthProvider: vi.fn(),
}));

vi.mock('../../components/auth/SocialProviderIcon', () => ({
  SocialProviderIcon: () => React.createElement('span', null, 'icon'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (key === 'benefits.items' && options?.returnObjects) {
        return ['benefit_one', 'benefit_two'];
      }
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { LoginPage } from '../../pages/LoginPage';

describe('pages/LoginPage keyboard submit', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams();
    mocks.location.state = null;
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.auth.isAnonymous = false;
  });

  it('submits credentials when Enter is pressed in the password field', async () => {
    const user = userEvent.setup();

    render(React.createElement(LoginPage));

    const emailInput = screen.getByLabelText('labels.email');
    const passwordInput = screen.getByLabelText('labels.password');

    await user.type(emailInput, 'traveler@example.com');
    await user.type(passwordInput, 'password123{enter}');

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('traveler@example.com', 'password123');
    });
  });

  it('processes asset claim before queued generation claim after auth callback', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.isAnonymous = false;
    mocks.searchParams = new URLSearchParams({
      asset_claim: '8d4d4796-5fe3-4e5d-856d-2c6d6a0138d6',
      claim: 'queue-claim-1',
    });
    mocks.processAnonymousAssetClaimAfterAuth.mockResolvedValue({
      claimId: '8d4d4796-5fe3-4e5d-856d-2c6d6a0138d6',
      status: 'claimed',
      transferredTrips: 2,
      transferredTripEvents: 0,
      transferredProfileEvents: 0,
      transferredTripVersions: 0,
      transferredTripShares: 0,
      transferredCollaborators: 0,
      deduplicatedCollaborators: 0,
    });
    mocks.processQueuedTripGenerationAfterAuth.mockResolvedValue({ tripId: 'trip-123' });

    render(React.createElement(LoginPage));

    await waitFor(() => {
      expect(mocks.processAnonymousAssetClaimAfterAuth).toHaveBeenCalledWith('8d4d4796-5fe3-4e5d-856d-2c6d6a0138d6');
    });
    await waitFor(() => {
      expect(mocks.processQueuedTripGenerationAfterAuth).toHaveBeenCalledWith('queue-claim-1');
    });
    expect(mocks.processAnonymousAssetClaimAfterAuth.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.processQueuedTripGenerationAfterAuth.mock.invocationCallOrder[0],
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/trip/trip-123', { replace: true });
  });
});
