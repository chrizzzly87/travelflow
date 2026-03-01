// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    refreshAccess: vi.fn().mockResolvedValue(undefined),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    isProfileLoading: false,
    profile: null,
  },
  updateCurrentUserProfile: vi.fn(),
  checkUsernameAvailability: vi.fn(),
  trackEvent: vi.fn(),
  showAppToast: vi.fn(),
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    ...mocks.auth,
  }),
}));

vi.mock('../../services/profileService', () => ({
  updateCurrentUserProfile: mocks.updateCurrentUserProfile,
  checkUsernameAvailability: mocks.checkUsernameAvailability,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) => {
      if (key === 'settings.usernameStatus.cooldownDate') {
        return `cooldown:${options?.date}`;
      }
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { ProfileSettingsPage } from '../../pages/ProfileSettingsPage';

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    null,
    React.createElement(ProfileSettingsPage)
  )
);

describe('pages/ProfileSettingsPage username governance', () => {
  const buildProfile = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'traveler@example.com',
    displayName: 'Traveler One',
    firstName: 'Traveler',
    lastName: 'One',
    username: 'traveler',
    usernameDisplay: 'traveler',
    usernameCanonical: 'traveler',
    bio: '',
    gender: '',
    country: 'DE',
    city: 'Berlin',
    preferredLanguage: 'en',
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
    accountStatus: 'active',
    publicProfileEnabled: true,
    defaultPublicTripVisibility: true,
    usernameChangedAt: '2025-01-01T00:00:00Z',
    passportStickerPositions: {},
    passportStickerSelection: [],
    ...overrides,
  });

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mocks.auth.profile = buildProfile();
    mocks.updateCurrentUserProfile.mockResolvedValue(buildProfile());
    mocks.checkUsernameAvailability.mockResolvedValue({
      normalizedUsername: 'traveler',
      availability: 'unchanged',
      reason: null,
      cooldownEndsAt: null,
    });
  });

  it('keeps username locked by default and unlocks editing via the tiny edit action', async () => {
    const user = userEvent.setup();
    mocks.checkUsernameAvailability.mockResolvedValue({
      normalizedUsername: 'new_handle',
      availability: 'available',
      reason: null,
      cooldownEndsAt: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    const usernameInput = screen.getByLabelText('settings.fields.username');
    expect(usernameInput).toHaveAttribute('readonly');

    await user.click(screen.getByRole('button', { name: 'settings.usernameChange' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('profile_settings__username_edit--open');
    });

    expect(usernameInput).not.toHaveAttribute('readonly');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'new_handle');

    expect(mocks.checkUsernameAvailability).not.toHaveBeenCalledWith('new_handle');
    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith('new_handle', { logBlockedAttempt: true });
      expect(mocks.updateCurrentUserProfile).toHaveBeenCalledWith(expect.objectContaining({
        username: 'new_handle',
        usernameDisplay: 'new_handle',
      }));
    });
  });

  it('normalizes @-prefixed username input before availability check and save', async () => {
    const user = userEvent.setup();
    mocks.checkUsernameAvailability.mockResolvedValue({
      normalizedUsername: 'chrizzzly_hh',
      availability: 'available',
      reason: null,
      cooldownEndsAt: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'settings.usernameChange' }));
    const usernameInput = screen.getByLabelText('settings.fields.username');
    await user.clear(usernameInput);
    await user.type(usernameInput, '@chrizzzly_hh');
    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith('chrizzzly_hh', { logBlockedAttempt: true });
      expect(mocks.updateCurrentUserProfile).toHaveBeenCalledWith(expect.objectContaining({
        username: 'chrizzzly_hh',
        usernameDisplay: 'chrizzzly_hh',
      }));
    });
  });

  it('sanitizes unsupported username characters while preserving display case', async () => {
    const user = userEvent.setup();
    mocks.checkUsernameAvailability.mockResolvedValue({
      normalizedUsername: 'admin_support',
      availability: 'available',
      reason: null,
      cooldownEndsAt: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'settings.usernameChange' }));
    const usernameInput = screen.getByLabelText('settings.fields.username');
    await user.clear(usernameInput);
    await user.type(usernameInput, '@AdMiN_support!!!');

    expect((usernameInput as HTMLInputElement).value).toBe('AdMiN_support');

    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith('admin_support', { logBlockedAttempt: true });
      expect(mocks.updateCurrentUserProfile).toHaveBeenCalledWith(expect.objectContaining({
        username: 'admin_support',
        usernameDisplay: 'AdMiN_support',
      }));
    });
  });

  it('rejects handles that contain only separators before availability lookup', async () => {
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'settings.usernameChange' }));
    const usernameInput = screen.getByLabelText('settings.fields.username');
    await user.clear(usernameInput);
    await user.type(usernameInput, '___');
    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(mocks.updateCurrentUserProfile).not.toHaveBeenCalled();
      expect(screen.getByText('settings.usernameStatus.invalid')).toBeInTheDocument();
    });
  });

  it('keeps edit action blocked during cooldown and emits blocked analytics', async () => {
    const user = userEvent.setup();
    mocks.auth.profile = buildProfile({
      usernameChangedAt: '2026-01-15T00:00:00Z',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    const usernameInput = screen.getByLabelText('settings.fields.username');
    const editButton = screen.getByRole('button', { name: 'settings.usernameChange' });

    expect(usernameInput).toHaveAttribute('readonly');
    expect(editButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(editButton);

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('profile_settings__username_edit--blocked_cooldown');
    });

    expect(usernameInput).toHaveAttribute('readonly');

    expect(screen.getByText('settings.usernameCooldownHint')).toBeInTheDocument();
  });

  it('saves selected Country/Region as ISO code from the searchable picker and closes on select', async () => {
    const user = userEvent.setup();
    mocks.updateCurrentUserProfile.mockResolvedValue(buildProfile({ country: 'DE' }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    const countrySearchInput = screen.getByPlaceholderText('settings.countryRegionSearchPlaceholder');
    await user.click(countrySearchInput);
    await user.type(countrySearchInput, 'ger');
    await user.click(screen.getByRole('option', { name: 'Germany' }));

    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(mocks.updateCurrentUserProfile).toHaveBeenCalledWith(expect.objectContaining({
        country: 'DE',
      }));
    });
  });

  it('shows username suggestions when the requested username is unavailable', async () => {
    const user = userEvent.setup();
    mocks.checkUsernameAvailability.mockImplementation(async (candidate: string) => {
      if (candidate === 'taken_name') {
        return {
          normalizedUsername: candidate,
          availability: 'taken',
          reason: null,
          cooldownEndsAt: null,
        };
      }
      if (candidate === 'taken_name1') {
        return {
          normalizedUsername: candidate,
          availability: 'available',
          reason: null,
          cooldownEndsAt: null,
        };
      }
      return {
        normalizedUsername: candidate,
        availability: 'taken',
        reason: null,
        cooldownEndsAt: null,
      };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'settings.usernameChange' }));
    const usernameInput = screen.getByLabelText('settings.fields.username');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'taken_name');
    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(screen.getByText('settings.usernameSuggestionsTitle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'taken_name1' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'taken_name1' }));
    expect((usernameInput as HTMLInputElement).value).toBe('taken_name1');
  });

  it('shows a success toast after saving', async () => {
    const user = userEvent.setup();
    mocks.checkUsernameAvailability.mockResolvedValue({
      normalizedUsername: 'traveler',
      availability: 'unchanged',
      reason: null,
      cooldownEndsAt: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'settings.actions.save' }));

    await waitFor(() => {
      expect(mocks.showAppToast).toHaveBeenCalledWith({
        tone: 'success',
        title: 'settings.messages.savedTitle',
        description: 'settings.messages.saved',
      });
    });
  });
});
