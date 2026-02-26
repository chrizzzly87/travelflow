// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TripViewStatusBanners } from '../../components/tripview/TripViewStatusBanners';

const trackEventMock = vi.fn();

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

const messages: Record<string, string> = {
  'connectivity.tripStrip.offline.messageNone': 'Offline mode enabled. Trip data is served from local cache.',
  'connectivity.tripStrip.offline.messageOne': 'Offline mode enabled. {count} change is queued for sync.',
  'connectivity.tripStrip.offline.messageMany': 'Offline mode enabled. {count} changes are queued for sync.',
  'connectivity.tripStrip.degraded.messageNone': 'Connection is degraded. Edits are protected with local queue fallback.',
  'connectivity.tripStrip.degraded.messageOne': 'Connection is degraded. {count} change is queued for replay.',
  'connectivity.tripStrip.degraded.messageMany': 'Connection is degraded. {count} changes are queued for replay.',
  'connectivity.tripStrip.forcedSuffix': '(forced by debugger)',
  'connectivity.tripStrip.retry': 'Retry failed sync',
  'connectivity.tripStrip.syncingOne': 'Syncing {count} queued change to Supabase...',
  'connectivity.tripStrip.syncingMany': 'Syncing {count} queued changes to Supabase...',
  'connectivity.tripStrip.pendingOne': '{count} queued change is waiting for replay.',
  'connectivity.tripStrip.pendingMany': '{count} queued changes are waiting for replay.',
  'connectivity.tripStrip.serverBackup': 'A newer server version was backed up before replay. You can restore it if needed.',
  'connectivity.tripStrip.restoreServerVersion': 'Restore server version',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const template = messages[key] ?? key;
      if (typeof options?.count === 'number') {
        return template.replaceAll('{count}', String(options.count));
      }
      return template;
    },
  }),
}));

type TripViewStatusBannersProps = React.ComponentProps<typeof TripViewStatusBanners>;

const makeProps = (overrides?: Partial<TripViewStatusBannersProps>): TripViewStatusBannersProps => ({
  shareStatus: undefined,
  onCopyTrip: undefined,
  isAdminFallbackView: false,
  adminOverrideEnabled: false,
  canEnableAdminOverride: false,
  ownerUsersUrl: null,
  ownerEmail: undefined,
  ownerId: undefined,
  isTripLockedByArchive: false,
  isTripLockedByExpiry: false,
  hasLoadingItems: false,
  onOpenOwnerDrawer: () => undefined,
  onAdminOverrideEnabledChange: () => undefined,
  shareSnapshotMeta: undefined,
  onOpenLatestSnapshot: () => undefined,
  tripExpiresAtMs: null,
  isExampleTrip: false,
  isPaywallLocked: false,
  expirationLabel: null,
  expirationRelativeLabel: null,
  onPaywallLoginClick: () => undefined,
  tripId: 'trip-1',
  connectivityState: undefined,
  connectivityForced: false,
  pendingSyncCount: 0,
  failedSyncCount: 0,
  isSyncingQueue: false,
  onRetrySyncQueue: undefined,
  hasConflictBackupForTrip: false,
  onRestoreConflictBackup: undefined,
  exampleTripBanner: undefined,
  ...overrides,
});

describe('TripViewStatusBanners connectivity strips', () => {
  afterEach(() => {
    cleanup();
    trackEventMock.mockClear();
  });

  it('renders offline strip with count-specific copy and forced suffix', () => {
    render(
      <TripViewStatusBanners
        {...makeProps({
          connectivityState: 'offline',
          pendingSyncCount: 1,
          connectivityForced: true,
        })}
      />,
    );

    expect(screen.getByText(/Offline mode enabled. 1 change is queued for sync./i)).toBeInTheDocument();
    expect(screen.getByText(/\(forced by debugger\)/i)).toBeInTheDocument();
  });

  it('renders syncing strip while queue replay is running', () => {
    render(
      <TripViewStatusBanners
        {...makeProps({
          connectivityState: 'online',
          pendingSyncCount: 2,
          isSyncingQueue: true,
        })}
      />,
    );

    expect(screen.getByText('Syncing 2 queued changes to Supabase...')).toBeInTheDocument();
  });

  it('calls retry callback from connectivity strip', () => {
    const onRetrySyncQueue = vi.fn();
    render(
      <TripViewStatusBanners
        {...makeProps({
          connectivityState: 'degraded',
          pendingSyncCount: 2,
          failedSyncCount: 1,
          onRetrySyncQueue,
        })}
      />,
    );

    const retryButtons = screen.getAllByRole('button', { name: 'Retry failed sync' });
    fireEvent.click(retryButtons[0]);
    expect(onRetrySyncQueue).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalled();
  });

  it('shows server-backup restore action and calls handler', () => {
    const onRestoreConflictBackup = vi.fn();
    render(
      <TripViewStatusBanners
        {...makeProps({
          connectivityState: 'offline',
          hasConflictBackupForTrip: true,
          onRestoreConflictBackup,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore server version' }));
    expect(onRestoreConflictBackup).toHaveBeenCalledTimes(1);
  });

  it('does not render connectivity strips when no outage or queue state exists', () => {
    render(<TripViewStatusBanners {...makeProps()} />);

    expect(screen.queryByText(/Offline mode enabled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/queued change/i)).not.toBeInTheDocument();
  });
});
