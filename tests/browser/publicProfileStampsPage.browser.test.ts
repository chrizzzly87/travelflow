// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  resolvePublicProfileByHandle: vi.fn(),
  getPublicTripsPageByUserId: vi.fn(),
  getAllTrips: vi.fn(),
  trackEvent: vi.fn(),
  auth: {
    isLoading: false,
    isAuthenticated: false,
    profile: null as any,
  },
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../components/marketing/SiteFooter', () => ({
  SiteFooter: () => React.createElement('div', { 'data-testid': 'site-footer' }),
}));

vi.mock('../../components/profile/ProfileStampBookViewer', () => ({
  ProfileStampBookViewer: () => React.createElement('div', { 'data-testid': 'stamp-book' }),
}));

vi.mock('../../services/profileService', () => ({
  resolvePublicProfileByHandle: mocks.resolvePublicProfileByHandle,
  getPublicTripsPageByUserId: mocks.getPublicTripsPageByUserId,
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
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
    t: (key: string) => key,
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { PublicProfileStampsPage } from '../../pages/PublicProfileStampsPage';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const renderPage = (initialPath: string) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [initialPath] },
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: '/u/:username/stamps',
        element: React.createElement(
          React.Fragment,
          null,
          React.createElement(PublicProfileStampsPage),
          React.createElement(LocationProbe)
        ),
      })
    )
  )
);

describe('pages/PublicProfileStampsPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.auth.profile = null;
    mocks.getAllTrips.mockReturnValue([]);
    mocks.getPublicTripsPageByUserId.mockResolvedValue({
      trips: [],
      hasMore: false,
      nextOffset: 0,
    });
    mocks.resolvePublicProfileByHandle.mockResolvedValue({
      status: 'found',
      canonicalUsername: 'example',
      redirectFromUsername: null,
      profile: {
        id: 'user-1',
        email: 'example@example.com',
        displayName: 'Example User',
        firstName: 'Example',
        lastName: 'User',
        username: 'example',
        usernameDisplay: 'EXAMPLE',
        usernameCanonical: 'example',
        bio: '',
        gender: '',
        country: 'DE',
        city: 'Berlin',
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
  });

  it('canonicalizes mixed-case stamps URLs to lowercase', async () => {
    renderPage('/u/EXAMPLE/stamps');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toBe('/u/example/stamps');
    });

    await waitFor(() => {
      expect(mocks.resolvePublicProfileByHandle).toHaveBeenCalledWith('example');
    });
  });
});
