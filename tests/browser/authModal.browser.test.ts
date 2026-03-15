// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  onClose: vi.fn(),
  rememberLoginEnabled: true,
  setRememberLoginEnabled: vi.fn(),
  auth: {
    isLoading: false,
    isAuthenticated: false,
    isAnonymous: false,
    loginWithPassword: vi.fn().mockResolvedValue({ error: null }),
    registerWithPassword: vi.fn().mockResolvedValue({ error: null, data: { session: null } }),
    loginWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue({ error: null }),
  },
  acceptCurrentTerms: vi.fn().mockResolvedValue({
    data: { termsVersion: '2026-03-03', acceptedAt: '2026-03-03T10:00:00Z' },
    error: null,
  }),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

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

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true, isSlowConnection: false }),
}));

vi.mock('../../services/networkStatus', () => ({
  getAuthRequestTimeoutMs: () => 8_000,
  getAuthRestoreTimeoutMs: () => 8_000,
}));

vi.mock('../../services/authNavigationService', () => ({
  buildPasswordResetRedirectUrl: () => 'https://example.com/auth/reset-password',
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

vi.mock('../../services/authService', () => ({
  acceptCurrentTerms: mocks.acceptCurrentTerms,
  isSupabaseAuthNotConfiguredError: (error: unknown) => error instanceof Error && error.message === 'Supabase auth is not configured.',
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../components/auth/SocialProviderIcon', () => ({
  SocialProviderIcon: () => React.createElement('span', null, 'icon'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { AuthModal } from '../../components/auth/AuthModal';

const renderModal = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/'] },
    React.createElement(AuthModal, {
      isOpen: true,
      source: 'test',
      nextPath: '/create-trip',
      reloadOnSuccess: false,
      onClose: mocks.onClose,
    }),
  ),
);

const setNativeInputValue = (input: HTMLInputElement, value: string): void => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('Missing HTMLInputElement value setter');
  valueSetter.call(input, value);
};

describe('components/auth/AuthModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.rememberLoginEnabled = true;
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.auth.isAnonymous = false;
    mocks.acceptCurrentTerms.mockResolvedValue({
      data: { termsVersion: '2026-03-03', acceptedAt: '2026-03-03T10:00:00Z' },
      error: null,
    });
  });

  it('uses session-only persistence when remember login is unchecked before password sign-in', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('checkbox', { name: 'labels.rememberLogin' }));
    await user.type(screen.getByLabelText('labels.email'), 'traveler@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'actions.submitLogin' }));

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('traveler@example.com', 'password123');
    });
    expect(mocks.setRememberLoginEnabled).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('states.alreadyAuthenticated')).not.toBeInTheDocument();
  });

  it('submits browser-autofilled credentials even when React state was not updated by input events', async () => {
    const user = userEvent.setup();
    renderModal();

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
    renderModal();

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

  it('records terms acceptance immediately when register returns an active session', async () => {
    const user = userEvent.setup();
    mocks.auth.registerWithPassword.mockResolvedValueOnce({
      error: null,
      data: { session: { access_token: 'session-token' } },
    });

    renderModal();

    await user.click(screen.getByRole('button', { name: 'tabs.register' }));
    await user.type(screen.getByLabelText('labels.email'), 'accepted@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'actions.submitRegister' }));

    await waitFor(() => {
      expect(mocks.acceptCurrentTerms).toHaveBeenCalledWith({
        locale: 'en',
        source: 'signup_auth_modal',
      });
    });
  });

  it('shows a support banner when auth config is missing', async () => {
    const user = userEvent.setup();
    mocks.auth.loginWithPassword.mockRejectedValueOnce(new Error('Supabase auth is not configured.'));

    renderModal();

    await user.type(screen.getByLabelText('labels.email'), 'traveler@example.com');
    await user.type(screen.getByLabelText('labels.password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'actions.submitLogin' }));

    await waitFor(() => {
      expect(screen.getByText('errors.auth_unavailable_title')).toBeInTheDocument();
    });
    expect(screen.getByText('errors.auth_unavailable_body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'actions.contactSupport' })).toBeInTheDocument();
  });
});
