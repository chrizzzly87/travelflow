// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TripViewStatusBanners } from '../../../components/tripview/TripViewStatusBanners';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const renderBanners = (isAgentLauncherVisible: boolean) => render(
  React.createElement(MemoryRouter, null,
    React.createElement(TripViewStatusBanners, {
      isAdminFallbackView: false,
      adminOverrideEnabled: false,
      canEnableAdminOverride: false,
      ownerUsersUrl: null,
      isTripLockedByArchive: false,
      isTripLockedByExpiry: false,
      hasLoadingItems: false,
      onOpenOwnerDrawer: vi.fn(),
      onAdminOverrideEnabledChange: vi.fn(),
      onOpenLatestSnapshot: vi.fn(),
      tripExpiresAtMs: null,
      isExampleTrip: true,
      isPaywallLocked: false,
      expirationLabel: null,
      expirationRelativeLabel: null,
      paywallActivationMode: 'login_modal',
      onPaywallActivateClick: vi.fn(),
      tripId: 'trip-1',
      exampleTripBanner: { title: 'Italy', countries: ['Italy'] },
      isAgentLauncherVisible,
    } as unknown as React.ComponentProps<typeof TripViewStatusBanners>),
  ),
);

describe('example trip banner placement', () => {
  // The banner and the "Plan with AI" launcher share the bottom-end corner on
  // desktop; the launcher used to sit on top of the banner's action buttons.
  it('stacks above the AI launcher while the launcher is shown', () => {
    renderBanners(true);
    const banner = screen.getByTestId('example-trip-banner');
    expect(banner.className).toContain('sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)]');
    expect(banner.className).not.toContain('sm:bottom-6');
  });

  it('keeps its corner spot when there is no launcher', () => {
    renderBanners(false);
    expect(screen.getByTestId('example-trip-banner').className).toContain('sm:bottom-6');
  });
});
