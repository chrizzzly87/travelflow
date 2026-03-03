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
  rememberLoginEnabled: true,
  setRememberLoginEnabled: vi.fn(),
  runOpportunisticTripQueueCleanup: vi.fn().mockResolvedValue(undefined),
  processQueuedTripGenerationAfterAuth: vi.fn(),
  runOpportunisticAnonymousAssetClaimCleanup: vi.fn().mockResolvedValue(undefined),
  processAnonymousAssetClaimAfterAuth: vi.fn(),
  resolveAnonymousAssetClaimErrorCode: vi.fn().mockReturnValue('default'),
  acceptCurrentTerms: vi.fn().mockResolvedValue({
    data: { termsVersion: '2026-03-03', acceptedAt: '2026-03-03T10:00:00Z' },
    error: null,
  }),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
  useSearchParams: () => [mocks.searchParams, vi.fn()],
}));

vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    disabled,
    onCheckedChange,
    ...props
  }: {
    id?: string;
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (value: boolean) => void;
    [key: string]: unknown;
  }) => React.createElement('input', {
    ...props,
    id,
    type: 'checkbox',
    checked: checked === true,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(event.currentTarget.checked),
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/authService', () => ({
  acceptCurrentTerms: mocks.acceptCurrentTerms,
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

vi.mock('../../services/authSessionPersistenceService', () => ({
  isRememberLoginEnabled: () => mocks.rememberLoginEnabled,
  setRememberLoginEnabled: mocks.setRememberLoginEnabled,
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

const setNativeInputValue = (input: HTMLInputElement, value: string): void => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('Missing HTMLInputElement value setter');
  valueSetter.call(input, value);
};

describe('pages/LoginPage auth flows', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams();
    mocks.location.state = null;
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.auth.isAnonymous = false;
    mocks.rememberLoginEnabled = true;
    mocks.acceptCurrentTerms.mockResolvedValue({
      data: { termsVersion: '2026-03-03', acceptedAt: '2026-03-03T10:00:00Z' },
      error: null,
    });
  });

  it('submits credentials when Enter is pressed in the password field', async () => {
    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    await user.type(screen.getByLabelText('labels.email'), 'traveler@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123{enter}');

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('traveler@example.com', 'password123');
    });
    expect(mocks.setRememberLoginEnabled).toHaveBeenLastCalledWith(true);
  });

  it('switches to session-only persistence when remember login is unchecked', async () => {
    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    await user.click(screen.getByRole('checkbox', { name: 'labels.rememberLogin' }));
    await user.type(screen.getByLabelText('labels.email'), 'traveler@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123{enter}');

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('traveler@example.com', 'password123');
    });
    expect(mocks.setRememberLoginEnabled).toHaveBeenLastCalledWith(false);
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

  it('submits browser-autofilled credentials even when React state was not updated by input events', async () => {
    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    const emailInput = screen.getByLabelText('labels.email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('labels.password') as HTMLInputElement;
    setNativeInputValue(emailInput, 'autofill@example.com');
    setNativeInputValue(passwordInput, 'autofill-password');

    await user.click(screen.getByRole('button', { name: 'actions.submitLogin' }));

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('autofill@example.com', 'autofill-password');
    });
  });

  it('blocks register submit until terms consent checkbox is checked', async () => {
    const user = userEvent.setup();
    render(React.createElement(LoginPage));

    await user.click(screen.getByRole('button', { name: 'tabs.register' }));
    await user.type(screen.getByLabelText('labels.email'), 'new-user@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'actions.submitRegister' }));

    expect(mocks.auth.registerWithPassword).not.toHaveBeenCalled();
    expect(screen.getByText('errors.terms_required')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'actions.submitRegister' }));

    await waitFor(() => {
      expect(mocks.auth.registerWithPassword).toHaveBeenCalledWith('new-user@example.com', 'password123', expect.any(Object));
    });
  });

  it('records terms acceptance immediately for register flows with an active session', async () => {
    const user = userEvent.setup();
    mocks.auth.registerWithPassword.mockResolvedValueOnce({
      error: null,
      data: { session: { access_token: 'session-token' } },
    });

    render(React.createElement(LoginPage));

    await user.click(screen.getByRole('button', { name: 'tabs.register' }));
    await user.type(screen.getByLabelText('labels.email'), 'accepted@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'actions.submitRegister' }));

    await waitFor(() => {
      expect(mocks.acceptCurrentTerms).toHaveBeenCalledWith({
        locale: 'en',
        source: 'signup_login_page',
      });
    });
  });
});
