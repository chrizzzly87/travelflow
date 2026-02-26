// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  resolvePublicProfileByHandle: vi.fn(),
  getPublicTripsPageByUserId: vi.fn(),
  trackEvent: vi.fn(),
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
});
