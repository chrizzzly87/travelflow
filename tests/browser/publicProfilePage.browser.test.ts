// @vitest-environment jsdom
import { renderWithRouter as render } from '@/tests/helpers/renderWithRouter';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from '@/tests/helpers/routerHarness';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  resolvePublicProfileByHandle: vi.fn(),
  getPublicTripsPageByUserId: vi.fn(),
  trackEvent: vi.fn(),
  auth: {
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
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
import type { PublicProfilePageData } from '../../shared/publicProfile';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const renderPublicProfilePage = async (username: string, data: PublicProfilePageData) => {
  return await render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/u/${username}`] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/u/:username',
          element: React.createElement(
            React.Fragment,
            null,
            React.createElement(PublicProfilePage, { username, data }),
            React.createElement(LocationProbe)
          ),
        })
      )
    )
  );
};

const travelerProfile = {
  id: 'user-1',
  username: 'traveler',
  usernameDisplay: 'traveler',
  displayName: 'Traveler One',
  firstName: 'Traveler',
  lastName: 'One',
  bio: 'Slow travel fan',
  country: 'TH',
  city: 'Bangkok',
};

const foundData = (overrides: Partial<Extract<PublicProfilePageData, { status: 'found' }>> = {}): PublicProfilePageData => ({
  status: 'found',
  profile: travelerProfile,
  tripsPage: {
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
  },
  tripsFailed: false,
  ...overrides,
});

const privateData: PublicProfilePageData = {
  status: 'private',
  preview: { username: 'traveler', usernameDisplay: 'traveler', displayName: 'Traveler O.', firstName: 'Traveler', lastInitial: 'O' },
};

const viewerRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'viewer-1',
  email: 'viewer@example.com',
  displayName: 'Viewer Traveler',
  firstName: 'Viewer',
  lastName: 'Traveler',
  username: 'viewer_traveler',
  usernameDisplay: 'viewer_traveler',
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
  ...overrides,
});

describe('pages/PublicProfilePage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.auth.isAdmin = false;
    mocks.auth.profile = null;
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [],
      hasMore: false,
      nextOffset: 0,
    });
  });

  it('renders the loader profile and its trips without fetching in the browser', async () => {
    await renderPublicProfilePage('traveler', foundData());

    expect(screen.getByText('Traveler One')).toBeInTheDocument();
    expect(screen.getByText('Public Trip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'summary.follow' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'summary.message' })).toBeDisabled();
    expect(mocks.resolvePublicProfileByHandle).not.toHaveBeenCalled();
    expect(mocks.getPublicTripsPageByUserId).not.toHaveBeenCalled();
    expect(mocks.trackEvent).toHaveBeenCalledWith('public_profile__view', { username: 'traveler' });
  });

  it('does not render owner bio-fallback helper text on public profile when bio is empty', async () => {
    await renderPublicProfilePage('traveler', foundData({ profile: { ...travelerProfile, bio: '' } }));

    expect(screen.getByText('Traveler One')).toBeInTheDocument();
    expect(screen.queryByText('summary.bioFallback')).toBeNull();
  });

  it('shows plan-trip and inspirations CTAs for guests on not found state', async () => {
    await renderPublicProfilePage('unknown-handle', { status: 'not_found' });

    expect(screen.getByRole('link', { name: 'publicProfile.ctaPlanTrip' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'publicProfile.ctaGetInspired' })).toBeInTheDocument();
    expect(screen.getByText('publicProfile.notFoundInvalidPassportTitle')).toBeInTheDocument();
  });

  it('shows the same not found page when the profile backend is unavailable', async () => {
    await renderPublicProfilePage('traveler', { status: 'unavailable' });

    expect(screen.getByText('publicProfile.notFoundInvalidPassportTitle')).toBeInTheDocument();
    expect(screen.queryByText('Traveler One')).toBeNull();
  });

  it('shows the same public CTAs for authenticated users on not found state', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.profile = viewerRecord();

    await renderPublicProfilePage('unknown-handle', { status: 'not_found' });

    expect(screen.getByRole('link', { name: 'publicProfile.ctaPlanTrip' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'publicProfile.ctaGetInspired' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'publicProfile.ctaRegisterFree' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'publicProfile.ctaBackProfile' })).toBeNull();
    expect(mocks.getPublicTripsPageByUserId).not.toHaveBeenCalled();
  });

  it('falls back to the authenticated viewer profile when their own handle does not resolve publicly', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.profile = viewerRecord();
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [makeTrip({ id: 'self-trip-1', title: 'My Public Trip', showOnPublicProfile: true })],
      hasMore: false,
      nextOffset: 1,
    });

    await renderPublicProfilePage('viewer_traveler', { status: 'not_found' });

    await waitFor(() => {
      expect(screen.getByText('Viewer Traveler')).toBeInTheDocument();
      expect(screen.getByText('My Public Trip')).toBeInTheDocument();
    });
    expect(mocks.getPublicTripsPageByUserId).toHaveBeenCalledWith('viewer-1', { offset: 0, limit: 9 });
    expect(screen.getByRole('link', { name: 'summary.editProfile' })).toBeInTheDocument();
  });

  it('shows the owner their own private profile with trips instead of the masked card', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.profile = viewerRecord({ id: 'user-1', username: 'traveler', publicProfileEnabled: false, displayName: 'Traveler One' });
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [makeTrip({ id: 'own-trip', title: 'Own Trip', showOnPublicProfile: true })],
      hasMore: false,
      nextOffset: 1,
    });

    await renderPublicProfilePage('traveler', privateData);

    await waitFor(() => expect(screen.getByText('Own Trip')).toBeInTheDocument());
    expect(screen.getByText('Traveler One')).toBeInTheDocument();
    expect(screen.queryByText('Traveler O.')).toBeNull();
  });

  it('lets an admin see a private profile in full, marked as private', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.isAdmin = true;
    mocks.auth.profile = viewerRecord({ id: 'admin-1', username: 'admin_person' });
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'found',
      canonicalUsername: 'traveler',
      redirectFromUsername: null,
      profile: { ...viewerRecord(), ...travelerProfile, email: 'traveler@example.com', publicProfileEnabled: false },
    });
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [makeTrip({ id: 'hidden-profile-trip', title: 'Private Profile Trip', showOnPublicProfile: true })],
      hasMore: false,
      nextOffset: 1,
    });

    await renderPublicProfilePage('traveler', privateData);

    await waitFor(() => expect(screen.getByText('Private Profile Trip')).toBeInTheDocument());
    expect(mocks.resolvePublicProfileByHandle).toHaveBeenCalledWith('traveler');
    expect(screen.getByText('Traveler One')).toBeInTheDocument();
    expect(screen.getByText('publicProfile.visibilityPrivate')).toBeInTheDocument();
  });

  it('keeps the profile visible with a translated notice when public trips failed to load', async () => {
    await renderPublicProfilePage('traveler', foundData({ tripsPage: { trips: [], hasMore: false, nextOffset: 0 }, tripsFailed: true }));

    expect(screen.getByText('Traveler One')).toBeInTheDocument();
    expect(screen.getByText('errors.profileLoad')).toBeInTheDocument();
    expect(screen.queryByText('publicProfile.notFoundInvalidPassportTitle')).toBeNull();
  });

  // Mirrors the owner-profile case: the passport stays hidden on public
  // profiles while PASSPORT_FEATURE_ENABLED is off. Restore the click-through
  // assertions from git history when the feature comes back.
  it('does not offer the passport while PASSPORT_FEATURE_ENABLED is off', async () => {
    await renderPublicProfilePage('traveler', foundData());

    await screen.findByTestId('location-probe');

    expect(screen.queryByRole('button', { name: /summary\.stampsOpen/i })).toBeNull();
    expect(screen.queryByText('stamps.title')).toBeNull();
  });

  it('renders centered masked private profile card without public trips', async () => {
    await renderPublicProfilePage('traveler', privateData);

    expect(screen.getByText('publicProfile.visibilityPrivate')).toBeInTheDocument();
    expect(screen.queryByText('publicProfile.tripsTitle')).toBeNull();
    expect(screen.queryByText('publicProfile.privateTitle')).toBeNull();
    expect(screen.getByText('Traveler O.')).toBeInTheDocument();
    expect(mocks.resolvePublicProfileByHandle).not.toHaveBeenCalled();
  });

  it('shows edit profile action when visiting own public profile', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.profile = viewerRecord({ id: 'user-1', username: 'traveler' });

    await renderPublicProfilePage('traveler', foundData());

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'summary.editProfile' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'summary.follow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'summary.message' })).toBeNull();
    expect(mocks.getPublicTripsPageByUserId).not.toHaveBeenCalled();
  });
});
