// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  resolvePublicProfileByHandle: vi.fn(),
  getPublicTripsPageByUserId: vi.fn(),
  trackEvent: vi.fn(),
  auth: {
    isAuthenticated: false,
    profile: null as any,
  },
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../services/profileService', () => ({
  resolvePublicProfileByHandle: mocks.resolvePublicProfileByHandle,
  getPublicTripsPageByUserId: mocks.getPublicTripsPageByUserId,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; date?: string; flag?: string; country?: string }) => {
      if (key === 'sections.highlightsCount') return `${options?.count ?? 0}/3 pinned`;
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { PublicProfilePage } from '../../pages/PublicProfilePage';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const renderPublicProfilePage = (initialPath: string) => {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/u/:username',
          element: React.createElement(
            React.Fragment,
            null,
            React.createElement(PublicProfilePage),
            React.createElement(LocationProbe)
          ),
        })
      )
    )
  );
};

describe('pages/PublicProfilePage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = false;
    mocks.auth.profile = null;
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [],
      hasMore: false,
      nextOffset: 0,
    });
  });

  it('renders visitor profile summary with disabled follow and message actions', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'found',
      canonicalUsername: 'traveler',
      redirectFromUsername: null,
      profile: {
        id: 'user-1',
        email: 'traveler@example.com',
        displayName: 'Traveler One',
        firstName: 'Traveler',
        lastName: 'One',
        username: 'traveler',
        bio: 'Slow travel fan',
        gender: '',
        country: 'Thailand',
        city: 'Bangkok',
        preferredLanguage: 'en',
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
        accountStatus: 'active',
        publicProfileEnabled: true,
        defaultPublicTripVisibility: true,
        usernameChangedAt: '2026-01-05T00:00:00Z',
      },
    });

    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [
        makeTrip({
          id: 'public-trip-1',
          title: 'Public Trip',
          showOnPublicProfile: true,
          items: [makeCityItem({ id: 'city-1', title: 'Bangkok', startDateOffset: 0, duration: 2 })],
        }),
      ],
      hasMore: false,
      nextOffset: 1,
    });

    renderPublicProfilePage('/u/traveler');

    await waitFor(() => {
      expect(screen.getByText('Traveler One')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'summary.follow' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'summary.message' })).toBeDisabled();
    expect(screen.getByText('Public Trip')).toBeInTheDocument();
  });

  it('redirects from old handle to canonical handle', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'redirect',
      canonicalUsername: 'traveler-new',
      redirectFromUsername: 'traveler-old',
      profile: {
        id: 'user-1',
        email: 'traveler@example.com',
        displayName: 'Traveler One',
        firstName: 'Traveler',
        lastName: 'One',
        username: 'traveler-new',
        bio: '',
        gender: '',
        country: '',
        city: '',
        preferredLanguage: 'en',
        onboardingCompletedAt: null,
        accountStatus: 'active',
        publicProfileEnabled: true,
        defaultPublicTripVisibility: true,
        usernameChangedAt: null,
      },
    });

    renderPublicProfilePage('/u/traveler-old');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toBe('/u/traveler-new');
    });
  });

  it.skip('loads public trips in paged batches and appends next pages', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'found',
      canonicalUsername: 'traveler',
      redirectFromUsername: null,
      profile: {
        id: 'user-1',
        email: 'traveler@example.com',
        displayName: 'Traveler One',
        firstName: 'Traveler',
        lastName: 'One',
        username: 'traveler',
        bio: '',
        gender: '',
        country: 'TH',
        city: 'Bangkok',
        preferredLanguage: 'en',
        onboardingCompletedAt: null,
        accountStatus: 'active',
        publicProfileEnabled: true,
        defaultPublicTripVisibility: true,
        usernameChangedAt: null,
      },
    });

    mocks.getPublicTripsPageByUserId
      .mockResolvedValueOnce({
        trips: [makeTrip({ id: 'trip-1', title: 'Trip One', showOnPublicProfile: true })],
        hasMore: true,
        nextOffset: 1,
      })
      .mockResolvedValueOnce({
        trips: [makeTrip({ id: 'trip-2', title: 'Trip Two', showOnPublicProfile: true })],
        hasMore: false,
        nextOffset: 2,
      })
      .mockResolvedValue({
        trips: [],
        hasMore: false,
        nextOffset: 2,
      });

    renderPublicProfilePage('/u/traveler');

    await waitFor(() => {
      expect(screen.getByText('Trip One')).toBeInTheDocument();
      expect(screen.getByText('Trip Two')).toBeInTheDocument();
    });

    expect(mocks.getPublicTripsPageByUserId).toHaveBeenNthCalledWith(1, 'user-1', {
      offset: 0,
      limit: 9,
    });
    expect(mocks.getPublicTripsPageByUserId).toHaveBeenNthCalledWith(2, 'user-1', {
      offset: 1,
      limit: 9,
    });
  });

  it('shows plan-trip and inspirations CTAs for guests on not found state', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'not_found',
      canonicalUsername: null,
      redirectFromUsername: null,
      profile: null,
    });
    mocks.auth.isAuthenticated = false;

    renderPublicProfilePage('/u/unknown-handle');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'publicProfile.ctaPlanTrip' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'publicProfile.ctaGetInspired' })).toBeInTheDocument();
    });
  });

  it('shows the same public CTAs for authenticated users on not found state', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'not_found',
      canonicalUsername: null,
      redirectFromUsername: null,
      profile: null,
    });
    mocks.auth.isAuthenticated = true;

    renderPublicProfilePage('/u/unknown-handle');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'publicProfile.ctaPlanTrip' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'publicProfile.ctaGetInspired' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'publicProfile.ctaRegisterFree' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'publicProfile.ctaBackProfile' })).toBeNull();
  });

  it('falls back to the authenticated viewer profile when own public handle resolve fails', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'not_found',
      canonicalUsername: null,
      redirectFromUsername: null,
      profile: null,
    });
    mocks.auth.isAuthenticated = true;
    mocks.auth.profile = {
      id: 'viewer-1',
      email: 'viewer@example.com',
      displayName: 'Viewer Traveler',
      firstName: 'Viewer',
      lastName: 'Traveler',
      username: 'viewer_traveler',
      bio: '',
      gender: '',
      country: 'DE',
      city: 'Hamburg',
      preferredLanguage: 'en',
      onboardingCompletedAt: null,
      accountStatus: 'active',
      publicProfileEnabled: true,
      defaultPublicTripVisibility: true,
      usernameChangedAt: null,
      passportStickerPositions: {},
      passportStickerSelection: [],
    };
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [makeTrip({ id: 'self-trip-1', title: 'My Public Trip', showOnPublicProfile: true })],
      hasMore: false,
      nextOffset: 1,
    });

    renderPublicProfilePage('/u/viewer_traveler');

    await waitFor(() => {
      expect(screen.getByText('Viewer Traveler')).toBeInTheDocument();
      expect(screen.getByText('My Public Trip')).toBeInTheDocument();
    });

    expect(mocks.getPublicTripsPageByUserId).toHaveBeenCalledWith('viewer-1', {
      offset: 0,
      limit: 9,
    });
  });

  it('keeps the profile visible when public trips loading fails', async () => {
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'found',
      canonicalUsername: 'traveler',
      redirectFromUsername: null,
      profile: {
        id: 'user-1',
        email: 'traveler@example.com',
        displayName: 'Traveler One',
        firstName: 'Traveler',
        lastName: 'One',
        username: 'traveler',
        bio: '',
        gender: '',
        country: 'TH',
        city: 'Bangkok',
        preferredLanguage: 'en',
        onboardingCompletedAt: null,
        accountStatus: 'active',
        publicProfileEnabled: true,
        defaultPublicTripVisibility: true,
        usernameChangedAt: null,
        passportStickerPositions: {},
        passportStickerSelection: [],
      },
    });
    mocks.getPublicTripsPageByUserId.mockRejectedValueOnce(new Error('Public trips unavailable'));

    renderPublicProfilePage('/u/traveler');

    await waitFor(() => {
      expect(screen.getByText('Traveler One')).toBeInTheDocument();
    });

    expect(screen.queryByText('publicProfile.notFoundTitle')).toBeNull();
    expect(screen.getByText('Public trips unavailable')).toBeInTheDocument();
  });

  it('opens passport dialog using URL search state', async () => {
    const user = userEvent.setup();
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'found',
      canonicalUsername: 'traveler',
      redirectFromUsername: null,
      profile: {
        id: 'user-1',
        email: 'traveler@example.com',
        displayName: 'Traveler One',
        firstName: 'Traveler',
        lastName: 'One',
        username: 'traveler',
        bio: '',
        gender: '',
        country: 'TH',
        city: 'Bangkok',
        preferredLanguage: 'en',
        onboardingCompletedAt: null,
        accountStatus: 'active',
        publicProfileEnabled: true,
        defaultPublicTripVisibility: true,
        usernameChangedAt: null,
        passportStickerPositions: {},
        passportStickerSelection: [],
      },
    });

    renderPublicProfilePage('/u/traveler');

    const openPassportButton = await screen.findByRole('button', { name: /summary\.stampsOpen/i });
    await user.click(openPassportButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('passport=open');
    });
    expect(screen.getByText('stamps.title')).toBeInTheDocument();
  });
});
