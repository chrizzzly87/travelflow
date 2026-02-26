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
    mocks.checkUsernameAvailability.mockResolvedValueOnce({
      normalizedUsername: 'traveler',
      availability: 'unchanged',
      reason: null,
      cooldownEndsAt: null,
    }).mockResolvedValueOnce({
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

    await user.click(screen.getByRole('button', { name: 'settings.usernameEdit' }));

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('profile_settings__username_edit--open');
    });

    expect(usernameInput).not.toHaveAttribute('readonly');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'new_handle');

    await waitFor(() => {
      expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith('new_handle');
    });

    await waitFor(() => {
      expect(screen.getByText('settings.usernameStatus.available')).toBeInTheDocument();
    });
  });

  it('keeps edit action blocked during cooldown and emits blocked analytics', async () => {
    const user = userEvent.setup();
    mocks.auth.profile = buildProfile({
      usernameChangedAt: '2026-01-15T00:00:00Z',
    });
    mocks.checkUsernameAvailability.mockResolvedValueOnce({
      normalizedUsername: 'traveler',
      availability: 'unchanged',
      reason: null,
      cooldownEndsAt: null,
    }).mockResolvedValueOnce({
      normalizedUsername: 'later_name',
      availability: 'cooldown',
      reason: 'cooldown',
      cooldownEndsAt: '2026-05-01T00:00:00Z',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    const usernameInput = screen.getByLabelText('settings.fields.username');
    const editButton = screen.getByRole('button', { name: 'settings.usernameEdit' });

    expect(usernameInput).toHaveAttribute('readonly');
    expect(editButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(editButton);

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('profile_settings__username_edit--blocked_cooldown');
    });

    expect(usernameInput).toHaveAttribute('readonly');

    await waitFor(() => {
      expect(screen.getByText(/cooldown:/i)).toBeInTheDocument();
    });
  });

  it('saves selected Country/Region as ISO code from the searchable picker', async () => {
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
});
