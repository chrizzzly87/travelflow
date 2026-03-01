// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { ConnectivitySnapshot } from '../../services/supabaseHealthMonitor';
import type { SyncRunSnapshot } from '../../services/tripSyncManager';
import { ConnectivityStatusBanner } from '../../components/ConnectivityStatusBanner';

const messages: Record<string, string> = {
  'contact.emailValue': 'contact@wizz.art',
  'connectivity.banner.offline.title': 'You are offline. Changes will be queued.',
  'connectivity.banner.offline.messageNone': 'Planner stays usable with cached data.',
  'connectivity.banner.offline.messageOne': '{count} change is queued and will sync after reconnect.',
  'connectivity.banner.offline.messageMany': '{count} changes are queued and will sync after reconnect.',
  'connectivity.banner.offline.browserTitle': 'You are offline. Changes stay local.',
  'connectivity.banner.offline.browserMessage': 'Reconnect to continue cloud sync. We will retry automatically.',
  'connectivity.banner.offline.serviceTitle': 'Cloud sync is temporarily unavailable.',
  'connectivity.banner.offline.serviceMessage': 'Your internet works, but the sync service is not responding. Edits stay queued and safe.',
  'connectivity.banner.degraded.title': 'Connection is unstable. Saving in resilient mode.',
  'connectivity.banner.degraded.messageNone': 'Planner stays usable while we retry in the background.',
  'connectivity.banner.degraded.messageOne': '{count} queued change will sync when Supabase stabilizes.',
  'connectivity.banner.degraded.messageMany': '{count} queued changes will sync when Supabase stabilizes.',
  'connectivity.banner.degraded.serviceMessage': 'Cloud sync is unstable right now. We keep retrying in the background.',
  'connectivity.banner.syncing.title': 'Sync in progress',
  'connectivity.banner.syncing.messageOne': '{count} change is waiting to sync.',
  'connectivity.banner.syncing.messageMany': '{count} changes are waiting to sync.',
  'connectivity.banner.retryHint': 'Retrying Supabase connection every 30s while this tab stays open.',
  'connectivity.banner.forcedMode': 'Supabase outage simulation is currently forced in debugger mode.',
  'connectivity.banner.actions.retrySync': 'Retry failed sync',
  'connectivity.banner.actions.dismiss': 'Dismiss connectivity banner',
  'connectivity.banner.actions.contact': 'Contact',
  'connectivity.banner.actions.email': 'Email support',
  'connectivity.banner.syncing.progressOne': 'Syncing {count} queued change...',
  'connectivity.banner.syncing.progressMany': 'Syncing {count} queued changes...',
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
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

const makeConnectivitySnapshot = (overrides?: Partial<ConnectivitySnapshot>): ConnectivitySnapshot => ({
  state: 'offline',
  reason: 'browser_offline',
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  isForced: false,
  forcedState: null,
  ...overrides,
});

const makeSyncSnapshot = (overrides?: Partial<SyncRunSnapshot>): SyncRunSnapshot => ({
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  processingEntryId: null,
  processingTripId: null,
  processedCount: 0,
  successCount: 0,
  failedDuringRun: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  lastTrigger: null,
  hasConflictBackups: false,
  ...overrides,
});

describe('ConnectivityStatusBanner', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders browser-offline copy without leaking raw ICU plural syntax', () => {
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot()}
          sync={makeSyncSnapshot({ pendingCount: 0 })}
          onRetrySync={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Reconnect to continue cloud sync. We will retry automatically.')).toBeInTheDocument();
    expect(screen.queryByText(/one \{/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/plural/i)).not.toBeInTheDocument();
  });

  it('shows service-outage message and support action when internet is up', () => {
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({ reason: 'forced_offline' })}
          sync={makeSyncSnapshot({ pendingCount: 2 })}
          onRetrySync={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Cloud sync is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Your internet works, but the sync service is not responding. Edits stay queued and safe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('link', { name: 'Email support' })).not.toBeInTheDocument();
  });

  it('shows degraded state copy and forced mode hint', () => {
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({
            state: 'degraded',
            isForced: true,
            forcedState: 'degraded',
          })}
          sync={makeSyncSnapshot({ pendingCount: 1 })}
          onRetrySync={() => undefined}
          showDeveloperDetails
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Connection is unstable. Saving in resilient mode.')).toBeInTheDocument();
    expect(screen.getByText('Cloud sync is unstable right now. We keep retrying in the background.')).toBeInTheDocument();
    expect(screen.getByText('Supabase outage simulation is currently forced in debugger mode.')).toBeInTheDocument();
  });

  it('hides forced-mode hint for non-developer surfaces', () => {
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({
            state: 'offline',
            isForced: true,
            forcedState: 'offline',
          })}
          sync={makeSyncSnapshot({ pendingCount: 1 })}
          onRetrySync={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Supabase outage simulation is currently forced in debugger mode.')).not.toBeInTheDocument();
  });

  it('shows online syncing state without outage-only contact actions', () => {
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({ state: 'online' })}
          sync={makeSyncSnapshot({ isSyncing: true, pendingCount: 2 })}
          onRetrySync={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sync in progress')).toBeInTheDocument();
    expect(screen.getByText('2 changes are waiting to sync.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contact' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Email support' })).not.toBeInTheDocument();
  });

  it('hides support actions when browser is offline', () => {
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({ state: 'offline', reason: 'browser_offline' })}
          sync={makeSyncSnapshot({ pendingCount: 2 })}
          onRetrySync={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Contact' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Email support' })).not.toBeInTheDocument();
  });

  it('calls retry handler when failed sync retry is clicked', () => {
    const onRetrySync = vi.fn();
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({ state: 'offline' })}
          sync={makeSyncSnapshot({ pendingCount: 1, failedCount: 1 })}
          onRetrySync={onRetrySync}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry failed sync' }));
    expect(onRetrySync).toHaveBeenCalledTimes(1);
  });

  it('respects dismiss state from session storage for same outage state', () => {
    window.sessionStorage.setItem('tf_connectivity_banner_dismissed_state_v1', 'offline');
    render(
      <MemoryRouter>
        <ConnectivityStatusBanner
          isPlannerRoute
          connectivity={makeConnectivitySnapshot({ state: 'offline' })}
          sync={makeSyncSnapshot({ pendingCount: 2 })}
          onRetrySync={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText('You are offline. Changes will be queued.')).not.toBeInTheDocument();
  });
});
