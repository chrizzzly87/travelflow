// @vitest-environment jsdom
import { renderWithRouter as render } from '@/tests/helpers/renderWithRouter';
import React from 'react';
import { MemoryRouter } from '@/tests/helpers/routerHarness';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

import { TripViewHudOverlays } from '../../../components/tripview/TripViewHudOverlays';
import { TripViewStatusBanners } from '../../../components/tripview/TripViewStatusBanners';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const analyticsMocks = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: (eventName: string) => ({ 'data-tf-track-event': eventName }),
}));

const renderHud = async (isAgentLauncherVisible: boolean, onCopyTrip = vi.fn()) => await render(
  React.createElement(MemoryRouter, null,
    React.createElement(TripViewHudOverlays, {
      shareStatus: 'view',
      onCopyTrip,
      isAgentLauncherVisible,
      isPaywallLocked: false,
      expirationLabel: null,
      tripId: 'trip-1',
      paywallActivationMode: 'login_modal',
      onPaywallActivateClick: vi.fn(),
      showGenerationOverlay: false,
      generationProgressMessage: '',
      loadingDestinationSummary: '',
      tripDateRange: '',
      tripSpanCompactLabel: '',
    } as unknown as React.ComponentProps<typeof TripViewHudOverlays>),
  ),
);

const renderStrip = async (onCopyTrip = vi.fn()) => await render(
  React.createElement(MemoryRouter, null,
    React.createElement(TripViewStatusBanners, {
      shareStatus: 'view',
      onCopyTrip,
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
      isExampleTrip: false,
      isPaywallLocked: false,
      expirationLabel: null,
      expirationRelativeLabel: null,
      paywallActivationMode: 'login_modal',
      onPaywallActivateClick: vi.fn(),
      tripId: 'trip-1',
    } as unknown as React.ComponentProps<typeof TripViewStatusBanners>),
  ),
);

describe('view-only "Copy trip" actions', () => {
  // Both buttons were hand-styled separately and both rendered amber-200 text
  // on an amber-200 fill in dark mode, i.e. invisible.
  it('renders the same shared button, readable in dark mode, on the strip and the card', async () => {
    const { unmount } = await renderStrip();
    const stripButton = screen.getByRole('button', { name: 'tripView.banners.copyTrip' });
    const stripClass = stripButton.className;
    unmount();

    await renderHud(false);
    const cardButton = within(screen.getByTestId('view-only-trip-card')).getByRole('button', { name: 'tripView.banners.copyTrip' });

    expect(cardButton.className).toBe(stripClass);
    expect(cardButton.className).toContain('dark:text-amber-950');
    expect(cardButton.className).not.toContain('dark:text-amber-200');
  });

  it('copies and reports which surface it came from', async () => {
    const onCopyTrip = vi.fn();
    await renderHud(false, onCopyTrip);
    fireEvent.click(screen.getByRole('button', { name: 'tripView.banners.copyTrip' }));
    expect(onCopyTrip).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__copy_trip--click', { surface: 'view_only_card' });
  });

  // The card sat at bottom-4 on every breakpoint, right where the "Plan with
  // AI" launcher is pinned.
  it('lifts the view-only card above the AI launcher on every breakpoint', async () => {
    const { unmount } = await renderHud(true);
    const lifted = screen.getByTestId('view-only-trip-card').className;
    expect(lifted).toContain('bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)]');
    expect(lifted).not.toMatch(/(^|\s)bottom-4(\s|$)/);
    unmount();

    await renderHud(false);
    expect(screen.getByTestId('view-only-trip-card').className).toMatch(/(^|\s)bottom-4(\s|$)/);
  });
});
