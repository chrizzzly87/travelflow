// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    isProfileLoading: false,
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    access: {
      email: 'traveler@example.com',
      tierKey: 'tier_free',
      role: 'user',
      userId: 'user-1',
    },
    session: {
      user: {
        user_metadata: {},
      },
    },
    profile: null as null | {
      id: string;
      displayName: string;
      firstName: string;
      lastName: string;
      username: string;
      passportStickerPositions: Record<string, { x: number; y: number }>;
    },
  },
  getAllTrips: vi.fn(),
  updatePositions: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn(),
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
}));

vi.mock('../../services/profileService', () => ({
  updateCurrentUserPassportStickerPositions: mocks.updatePositions,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string; count?: number; total?: number }) => {
      if (key === 'stamps.description') return `desc ${options?.name || ''}`;
      if (key === 'stamps.unlockedCount') return `${options?.count ?? 0}/${options?.total ?? 0}`;
      if (key === 'stamps.lastUpdated') return `${options?.count ?? 0}`;
      if (key === 'fallback.displayName') return 'Traveler';
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { ProfileStampsPage } from '../../pages/ProfileStampsPage';

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/profile/stamps'] },
    React.createElement(ProfileStampsPage)
  )
);

describe('pages/ProfileStampsPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.auth.isProfileLoading = false;
    mocks.auth.access.email = 'traveler@example.com';
    mocks.auth.profile = {
      id: 'user-1',
      displayName: 'Traveler One',
      firstName: 'Traveler',
      lastName: 'One',
      username: 'traveler',
      passportStickerPositions: {
        first_trip_created: { x: 44, y: 55 },
      },
    };

    mocks.getAllTrips.mockReturnValue([
      {
        id: 'trip-1',
        title: 'Trip one',
        startDate: '2026-01-10',
        items: [],
        createdAt: 100,
        updatedAt: 120,
      },
    ]);
  });

  it('uses persisted passport sticker positions from profile data', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      expect(container.querySelector('[data-stamp-id="first_trip_created"]')).toBeTruthy();
    });

    const sticker = container.querySelector('[data-stamp-id="first_trip_created"]') as HTMLButtonElement;
    expect(sticker.style.left).toBe('44px');
    expect(sticker.style.top).toBe('55px');
  });

  it('saves sticker positions after moving a passport sticker', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      expect(container.querySelector('[data-stamp-id="first_trip_created"]')).toBeTruthy();
    });

    const sticker = container.querySelector('[data-stamp-id="first_trip_created"]') as HTMLButtonElement;
    const canvas = screen.getByTestId('profile-stamps-passport-canvas');

    fireEvent.pointerDown(sticker, { clientX: 60, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 170, clientY: 190, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    await waitFor(() => {
      expect(mocks.updatePositions).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.updatePositions.mock.calls[0][0] as Record<string, { x: number; y: number }>;
    expect(payload.first_trip_created).toBeTruthy();
    expect(typeof payload.first_trip_created.x).toBe('number');
    expect(typeof payload.first_trip_created.y).toBe('number');
  });

  it('uses email fallback for new users while profile is not cached yet', async () => {
    mocks.auth.profile = null;
    mocks.auth.access.email = 'new.user@example.com';
    mocks.getAllTrips.mockReturnValue([]);

    renderPage();

    await waitFor(() => {
      expect(mocks.auth.refreshProfile).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('desc new.user')).toBeInTheDocument();
  });
});
