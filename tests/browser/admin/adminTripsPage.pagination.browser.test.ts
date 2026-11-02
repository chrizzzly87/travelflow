// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from '@/tests/helpers/routerHarness';

const mocks = vi.hoisted(() => ({
  adminListTrips: vi.fn(),
  adminListUsers: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminUpdateTrip: vi.fn(),
  adminHardDeleteTrip: vi.fn(),
  listAdminTripGenerationAttempts: vi.fn(),
  listTripGenerationJobsByTrip: vi.fn(),
  requeueTripGenerationJob: vi.fn(),
  confirmDialog: vi.fn(async () => true),
  promptDialog: vi.fn(async () => null),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      actions,
      children,
    )
  ),
}));

vi.mock('../../../components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? React.createElement('div', null, children) : null),
  DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', { role: 'dialog' }, children),
  DrawerClose: ({ children }: { children: React.ReactNode }) => children,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', null, children),
}));

vi.mock('../../../components/admin/AdminReloadButton', () => ({
  AdminReloadButton: ({ onClick, label }: { onClick: () => void; label: string }) => React.createElement('button', { type: 'button', onClick }, label),
}));

vi.mock('../../../components/admin/AdminFilterMenu', () => ({
  AdminFilterMenu: () => React.createElement('div', null),
}));

vi.mock('../../../components/admin/AdminCountUpNumber', () => ({
  AdminCountUpNumber: ({ value }: { value: number }) => React.createElement('span', null, String(value)),
}));

vi.mock('../../../components/admin/CopyableUuid', () => ({
  CopyableUuid: ({ value }: { value: string }) => React.createElement('span', null, value),
}));

vi.mock('../../../components/admin/AiProviderLogo', () => ({
  AiProviderLogo: () => React.createElement('span', null),
}));

vi.mock('../../../components/admin/adminLocalCache', () => ({
  readAdminCache: vi.fn(() => []),
  writeAdminCache: vi.fn(),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: mocks.confirmDialog,
    prompt: mocks.promptDialog,
  }),
}));

vi.mock('../../../services/adminService', () => ({
  adminGetUserProfile: mocks.adminGetUserProfile,
  adminHardDeleteTrip: mocks.adminHardDeleteTrip,
  adminListTrips: mocks.adminListTrips,
  adminListUsers: mocks.adminListUsers,
  adminUpdateTrip: mocks.adminUpdateTrip,
}));

vi.mock('../../../services/dbService', () => ({
  dbAdminOverrideTripCommit: vi.fn(),
  dbGetTrip: vi.fn(async () => ({ trip: null })),
  dbUpsertTrip: vi.fn(),
}));

vi.mock('../../../services/tripGenerationDiagnosticsService', () => ({
  getLatestTripGenerationAttempt: vi.fn(() => null),
  getTripGenerationState: vi.fn(() => 'succeeded'),
  normalizeTripGenerationAttemptsForDisplay: vi.fn((attempts: unknown[]) => attempts),
}));

vi.mock('../../../services/tripGenerationRetryService', () => ({
  retryTripGenerationWithDefaultModel: vi.fn(),
}));

vi.mock('../../../services/tripGenerationAttemptLogService', () => ({
  listAdminTripGenerationAttempts: mocks.listAdminTripGenerationAttempts,
}));

vi.mock('../../../services/tripGenerationBenchmarkBridge', () => ({
  buildBenchmarkScenarioImportUrl: vi.fn(() => '/admin/ai-benchmark'),
}));

vi.mock('../../../services/tripGenerationJobService', () => ({
  listTripGenerationJobsByTrip: mocks.listTripGenerationJobsByTrip,
  requeueTripGenerationJob: mocks.requeueTripGenerationJob,
}));

import { AdminTripsPage } from '../../../pages/AdminTripsPage';

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const createTrip = (index: number) => ({
  trip_id: `trip-${index}`,
  owner_id: `owner-${index}`,
  owner_email: `owner${index}@example.com`,
  title: `Trip ${index}`,
  status: 'active' as const,
  generation_state: 'succeeded' as const,
  trip_expires_at: null,
  archived_at: null,
  source_kind: 'manual',
  created_at: daysAgoIso((index % 10) + 5),
  updated_at: daysAgoIso((index % 10) + 1),
});

const LocationProbe = () => {
  const location = useLocation();
  return React.createElement('output', { 'data-testid': 'location' }, `${location.pathname}${location.search}`);
};

const renderPage = (initialEntry = '/admin/trips') => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [initialEntry] },
    React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '/admin/trips', element: React.createElement(AdminTripsPage) }),
      React.createElement(Route, { path: '/admin/users', element: React.createElement(LocationProbe) }),
    ),
  ),
);

describe('pages/AdminTripsPage pagination', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.adminListTrips.mockResolvedValue(Array.from({ length: 30 }, (_, index) => createTrip(index + 1)));
    mocks.adminListUsers.mockResolvedValue([]);
    mocks.adminGetUserProfile.mockResolvedValue(null);
    mocks.adminUpdateTrip.mockResolvedValue(undefined);
    mocks.adminHardDeleteTrip.mockResolvedValue(undefined);
    mocks.listAdminTripGenerationAttempts.mockResolvedValue([]);
    mocks.listTripGenerationJobsByTrip.mockResolvedValue([]);
    mocks.requeueTripGenerationJob.mockResolvedValue({ ok: true });
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.promptDialog.mockResolvedValue(null);
  });

  it('shows pagination controls and paginates trip rows', async () => {
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(mocks.adminListTrips).toHaveBeenCalled();
    });

    expect(await screen.findByText('Showing 1–25 of 30 trips')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Showing 26–30 of 30 trips')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  }, 30000);

  it('shows attempt metadata details and latest queue job diagnostics in the trip drawer', async () => {
    const user = userEvent.setup();

    mocks.listAdminTripGenerationAttempts.mockResolvedValue([
      {
        id: 'attempt-1',
        flow: 'classic',
        source: 'trip_status_strip',
        state: 'failed',
        startedAt: '2026-03-16T14:12:58.760Z',
        finishedAt: '2026-03-16T14:14:32.024Z',
        durationMs: 90001,
        requestId: 'req-timeout-1',
        provider: 'openai',
        model: 'gpt-5.4',
        failureKind: 'timeout',
        errorCode: 'OPENAI_REQUEST_TIMEOUT',
        errorMessage: 'OpenAI generation request timed out.',
        metadata: {
          orchestration: 'async_worker',
          details: 'Provider request timed out after 120000ms.',
          requestPayload: {
            source: 'trip_status_strip',
          },
        },
      },
    ]);
    mocks.listTripGenerationJobsByTrip.mockResolvedValue([
      {
        id: 'job-1',
        tripId: 'trip-1',
        ownerId: 'owner-1',
        attemptId: 'attempt-1',
        state: 'failed',
        priority: 100,
        retryCount: 1,
        maxRetries: 0,
        runAfter: '2026-03-16T14:12:58.760Z',
        payload: {
          source: 'trip_status_strip',
          requestedModel: 'gpt-5.4',
        },
        lastErrorCode: 'OPENAI_REQUEST_TIMEOUT',
        lastErrorMessage: 'OpenAI generation request timed out.',
        startedAt: '2026-03-16T14:13:01.380Z',
        finishedAt: '2026-03-16T14:14:32.223Z',
        createdAt: '2026-03-16T14:13:00.950Z',
        updatedAt: '2026-03-16T14:14:32.223Z',
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(mocks.adminListTrips).toHaveBeenCalled();
    });

    await user.click(await screen.findByRole('button', { name: 'Open details for Trip 1' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Generation' })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Status and expiry' })).toBeInTheDocument();
    // Raw diagnostics sit behind a disclosure, still in the document.
    expect(within(sheet).getByText('Technical details')).toBeInTheDocument();
    expect(await screen.findByText('Attempt metadata details')).toBeInTheDocument();
    expect(screen.getByText('Provider request timed out after 120000ms.')).toBeInTheDocument();
    expect(screen.getByText('Job last error code')).toBeInTheDocument();
    expect(screen.getAllByText('OPENAI_REQUEST_TIMEOUT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Latest queue job payload JSON')).toBeInTheDocument();
    expect(screen.getByText(/"requestedModel": "gpt-5.4"/)).toBeInTheDocument();
    expect(screen.getByText('Attempt metadata JSON')).toBeInTheDocument();
    expect(screen.getByText(/"details": "Provider request timed out after 120000ms."/)).toBeInTheDocument();
  });
  it('shows an authored sentence instead of the raw exception when trips fail to load', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.adminListTrips.mockRejectedValue(new Error('pg: relation "trips" leaked detail'));

    renderPage();

    expect(await screen.findByText('Could not load trips.')).toBeInTheDocument();
    expect(screen.queryByText(/leaked detail/)).toBeNull();
    consoleError.mockRestore();
  });

  it('opens the row actions menu with the trip actions', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Showing 1–25 of 30 trips')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Open trip actions' })[0]);

    expect(await screen.findByRole('menuitem', { name: 'Open details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open trip' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate…' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Transfer owner…' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download JSON' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Archive trip' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete permanently' })).toBeInTheDocument();
  });

  it('shows bulk actions only once a trip is selected, and selects the page before everything', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Showing 1–25 of 30 trips')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: 'Select trip Trip 1' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByText('1 trip selected')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument();

    // The header checkbox covers the 25 rows on this page, not all 30 matches.
    await user.click(screen.getByRole('checkbox', { name: 'Select all trips on this page' }));
    expect(within(bar).getByText('25 trips selected')).toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: 'Select all 30 matching' }));
    expect(within(bar).getByText('30 trips selected')).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: /Select all .* matching/ })).toBeNull();

    await user.click(within(bar).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mocks.adminUpdateTrip).toHaveBeenCalledTimes(30));
    expect(mocks.adminUpdateTrip).toHaveBeenCalledWith('trip-1', { status: 'archived' });

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull());
  });

  it('narrows the table to failed generations from the KPI tile', async () => {
    const user = userEvent.setup();
    mocks.adminListTrips.mockResolvedValue([
      ...Array.from({ length: 4 }, (_, index) => createTrip(index + 1)),
      { ...createTrip(5), generation_state: 'failed' as const },
      { ...createTrip(6), generation_state: 'failed' as const },
    ]);

    renderPage();

    expect(await screen.findByText('Showing 1–6 of 6 trips')).toBeInTheDocument();
    expect(screen.getByText('Open a trip to retry it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show failed' }));

    expect(await screen.findByText('Showing 1–2 of 2 trips')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open details for Trip 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open details for Trip 1' })).toBeNull();

    // Reset appears only while a filter is active.
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('Showing 1–6 of 6 trips')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('links the owner to the Users sheet instead of a duplicate owner drawer', async () => {
    renderPage();

    const ownerLink = await screen.findByRole('link', { name: 'owner1@example.com' });
    expect(ownerLink).toHaveAttribute('href', '/admin/users?user=owner-1&drawer=user');
  });

  it('forwards the old owner drawer deep link to the Users sheet', async () => {
    renderPage('/admin/trips?user=owner-7&drawer=user');

    expect(await screen.findByTestId('location')).toHaveTextContent('/admin/users?user=owner-7&drawer=user');
  });

  it('opens the trip sheet from a ?trip= deep link', async () => {
    renderPage('/admin/trips?trip=trip-3&drawer=trip');

    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByRole('heading', { name: 'Trip 3' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Open in Users' })).toHaveAttribute('href', '/admin/users?user=owner-3&drawer=user');
  });
});
