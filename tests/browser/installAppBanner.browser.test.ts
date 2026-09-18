// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  hasSavedTrips: vi.fn(),
  trackEvent: vi.fn(),
  recordDismissed: vi.fn(),
  recordAccepted: vi.fn(),
  readState: vi.fn(),
  shouldOffer: vi.fn(),
  detectStandalone: vi.fn(),
  detectPlatform: vi.fn(),
}));

vi.mock('../../hooks/useHasSavedTrips', () => ({ useHasSavedTrips: () => mocks.hasSavedTrips() }));
vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));
vi.mock('../../services/installPromptService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/installPromptService')>();
  return {
    ...actual,
    readInstallPromptState: mocks.readState,
    recordInstallPromptDismissed: mocks.recordDismissed,
    recordInstallAccepted: mocks.recordAccepted,
    shouldOfferInstallPrompt: mocks.shouldOffer,
    detectStandaloneDisplay: mocks.detectStandalone,
    detectInstallPlatform: mocks.detectPlatform,
  };
});

import { InstallAppBanner } from '../../components/InstallAppBanner';

const renderBanner = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/trips'] },
    React.createElement(InstallAppBanner)
  )
);

/** The component waits 5s before appearing; jump past it. */
const advancePastDelay = async () => {
  await vi.advanceTimersByTimeAsync(5200);
};

describe('components/InstallAppBanner', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // shouldAdvanceTime keeps RTL's waitFor polling alive; without it the fake
    // clock freezes the poller and every assertion times out.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.hasSavedTrips.mockReturnValue(true);
    mocks.readState.mockReturnValue({ dismissCount: 0, lastDismissedAt: null, installedAt: null });
    mocks.detectStandalone.mockReturnValue(false);
    mocks.detectPlatform.mockReturnValue('ios');
    mocks.shouldOffer.mockReturnValue(true);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  it('stays hidden until the delay has passed, so it never competes with the page', async () => {
    renderBanner();
    expect(screen.queryByTestId('install-app-banner')).toBeNull();

    await advancePastDelay();
    await waitFor(() => {
      expect(screen.getByTestId('install-app-banner')).toBeTruthy();
    });
  });

  it('shows Share-sheet instructions on iOS, where there is no install API', async () => {
    mocks.detectPlatform.mockReturnValue('ios');
    renderBanner();
    await advancePastDelay();

    await waitFor(() => {
      expect(screen.getByTestId('install-app-banner')).toBeTruthy();
    });
    // No install button: iOS cannot be prompted programmatically.
    expect(screen.queryByTestId('install-app-banner-accept')).toBeNull();
  });

  it('says nothing on Android until the browser confirms the app is installable', async () => {
    // Without beforeinstallprompt we do not know which menu this browser hides
    // "install" behind, and iOS Share-sheet wording would be simply wrong.
    mocks.detectPlatform.mockReturnValue('android');
    renderBanner();
    await advancePastDelay();

    expect(screen.queryByTestId('install-app-banner')).toBeNull();
  });

  it('offers a real install button on Android once the browser fires the event', async () => {
    mocks.detectPlatform.mockReturnValue('android');
    renderBanner();

    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    event.prompt = vi.fn().mockResolvedValue(undefined);
    event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
    window.dispatchEvent(event);

    await advancePastDelay();
    await waitFor(() => {
      expect(screen.getByTestId('install-app-banner-accept')).toBeTruthy();
    });
  });

  it('does not render when the policy says no', async () => {
    mocks.shouldOffer.mockReturnValue(false);
    renderBanner();
    await advancePastDelay();
    expect(screen.queryByTestId('install-app-banner')).toBeNull();
  });

  it('records a dismissal so it does not ask again immediately', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderBanner();
    await advancePastDelay();
    await waitFor(() => {
      expect(screen.getByTestId('install-app-banner')).toBeTruthy();
    });

    await user.click(screen.getByTestId('install-app-banner-dismiss'));
    expect(mocks.recordDismissed).toHaveBeenCalledTimes(1);
  });

  it('remembers an install that happened outside the banner', async () => {
    renderBanner();
    window.dispatchEvent(new Event('appinstalled'));
    expect(mocks.recordAccepted).toHaveBeenCalledTimes(1);
  });
});
