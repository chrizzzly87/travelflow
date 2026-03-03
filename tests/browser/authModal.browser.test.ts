// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
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

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true, isSlowConnection: false }),
}));

vi.mock('../../services/networkStatus', () => ({
  getAuthRequestTimeoutMs: () => 8000,
  getAuthRestoreTimeoutMs: () => 8000,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
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

const setNativeInputValue = (input: HTMLInputElement, value: string): void => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('Missing HTMLInputElement value setter');
  }
  valueSetter.call(input, value);
};

describe('components/auth/AuthModal remember login', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.rememberLoginEnabled = true;
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.auth.isAnonymous = false;
  });

  it('uses session-only persistence when remember login is unchecked before password sign-in', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(AuthModal, {
        isOpen: true,
        source: 'test',
        nextPath: '/create-trip',
        reloadOnSuccess: false,
        onClose: mocks.onClose,
      }),
    );

    const rememberCheckbox = screen.getByRole('checkbox', { name: 'labels.rememberLogin' });
    const emailInput = screen.getByLabelText('labels.email');
    const passwordInput = screen.getByLabelText('labels.password');
    const submitButton = screen.getByRole('button', { name: 'actions.submitLogin' });

    await user.click(rememberCheckbox);
    await user.type(emailInput, 'traveler@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('traveler@example.com', 'password123');
    });
    expect(mocks.setRememberLoginEnabled).toHaveBeenLastCalledWith(false);
  });

  it('submits browser-autofilled credentials even when React state was not updated by input events', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(AuthModal, {
        isOpen: true,
        source: 'test',
        nextPath: '/create-trip',
        reloadOnSuccess: false,
        onClose: mocks.onClose,
      }),
    );

    const emailInput = screen.getByLabelText('labels.email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('labels.password') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: 'actions.submitLogin' });

    setNativeInputValue(emailInput, 'autofill@example.com');
    setNativeInputValue(passwordInput, 'autofill-password');

    await user.click(submitButton);

    await waitFor(() => {
      expect(mocks.auth.loginWithPassword).toHaveBeenCalledWith('autofill@example.com', 'autofill-password');
    });
  });
});
