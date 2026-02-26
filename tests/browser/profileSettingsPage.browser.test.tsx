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
  },
  getCurrentUserProfile: vi.fn(),
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
  getCurrentUserProfile: mocks.getCurrentUserProfile,
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
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mocks.getCurrentUserProfile.mockResolvedValue({
      id: 'user-1',
      email: 'traveler@example.com',
      displayName: 'Traveler One',
      firstName: 'Traveler',
      lastName: 'One',
      username: 'traveler',
      bio: '',
      gender: '',
      country: 'Germany',
      city: 'Berlin',
      preferredLanguage: 'en',
      onboardingCompletedAt: '2026-01-01T00:00:00Z',
      accountStatus: 'active',
      publicProfileEnabled: true,
      defaultPublicTripVisibility: true,
      usernameChangedAt: '2026-01-01T00:00:00Z',
    });

    mocks.updateCurrentUserProfile.mockResolvedValue(null);
    mocks.checkUsernameAvailability.mockResolvedValue({
      normalizedUsername: 'traveler',
      availability: 'unchanged',
      reason: null,
      cooldownEndsAt: null,
    });
  });

  it('checks username availability while user edits the username field', async () => {
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
    await user.clear(usernameInput);
    await user.type(usernameInput, 'new_handle');

    await waitFor(() => {
      expect(mocks.checkUsernameAvailability).toHaveBeenCalledWith('new_handle');
    });

    await waitFor(() => {
      expect(screen.getByText('settings.usernameStatus.available')).toBeInTheDocument();
    });
  });

  it('shows cooldown date guidance when username check reports cooldown', async () => {
    const user = userEvent.setup();
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
    await user.clear(usernameInput);
    await user.type(usernameInput, 'later_name');

    await waitFor(() => {
      expect(screen.getByText(/cooldown:/i)).toBeInTheDocument();
    });
  });
});
