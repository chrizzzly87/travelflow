// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from '@/tests/helpers/routerHarness';

// Filter, sort, open-sheet and export flows against the real filter menus and table.

const mocks = vi.hoisted(() => ({
  adminListAuditLogs: vi.fn(),
  adminListUserChangeLogs: vi.fn(),
  adminExportAuditReplay: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminListTrips: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement('div', null, React.createElement('h1', null, title), actions, children)
  ),
}));

vi.mock('../../../components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? React.createElement('div', { role: 'dialog' }, children) : null),
  DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DrawerClose: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', null, children),
}));

vi.mock('../../../components/admin/CopyableUuid', () => ({
  CopyableUuid: ({ value }: { value: string }) => React.createElement('span', null, value),
}));

vi.mock('../../../components/admin/adminLocalCache', () => ({
  readAdminCache: vi.fn(() => []),
  writeAdminCache: vi.fn(),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: vi.fn(async () => false) }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: vi.fn(),
}));

vi.mock('../../../services/analyticsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analyticsService')>()),
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../../services/adminForensicsService', () => ({
  downloadAdminForensicsReplayBundle: vi.fn(() => true),
}));

vi.mock('../../../services/adminService', () => ({
  adminGetUserChangeLog: vi.fn(async () => null),
  adminExportAuditReplay: mocks.adminExportAuditReplay,
  adminOverrideTripCommit: vi.fn(),
  adminGetTripVersionSnapshots: vi.fn(async () => null),
  adminGetUserProfile: mocks.adminGetUserProfile,
  adminListAuditLogs: mocks.adminListAuditLogs,
  adminListUserChangeLogs: mocks.adminListUserChangeLogs,
  adminListTrips: mocks.adminListTrips,
  adminUpdatePlanEntitlements: vi.fn(),
  adminUpdateTrip: vi.fn(),
  adminUpdateUserOverrides: vi.fn(),
  adminUpdateUserProfile: vi.fn(),
}));

import { AdminAuditPage } from '../../../pages/AdminAuditPage';

const minutesAgoIso = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

const userTierUpdate = {
  id: 'audit-user',
  actor_user_id: 'admin-1',
  actor_email: 'admin@example.com',
  action: 'admin.user.update_profile',
  target_type: 'user',
  target_id: 'user-1',
  before_data: { tier_key: 'tier_free' },
  after_data: { tier_key: 'tier_mid' },
  metadata: null,
  created_at: minutesAgoIso(5),
};

const tripArchive = {
  id: 'audit-trip',
  actor_user_id: 'admin-1',
  actor_email: 'admin@example.com',
  action: 'admin.trip.update',
  target_type: 'trip',
  target_id: 'trip-42',
  before_data: { status: 'active', title: 'Lisbon long weekend', owner_id: 'owner-7' },
  after_data: { status: 'archived', title: 'Lisbon long weekend', owner_id: 'owner-7' },
  metadata: null,
  created_at: minutesAgoIso(90),
};

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/audit'] },
    React.createElement(AdminAuditPage),
  ),
);

const bodyRowLabels = (): string[] => {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body).getAllByRole('row').map((row) => (
    within(row).queryByRole('checkbox')?.getAttribute('aria-label') ?? ''
  ));
};

describe('pages/AdminAuditPage flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminListAuditLogs.mockResolvedValue([userTierUpdate, tripArchive]);
    mocks.adminListUserChangeLogs.mockResolvedValue([]);
    mocks.adminGetUserProfile.mockResolvedValue(null);
    mocks.adminListTrips.mockResolvedValue([]);
    mocks.adminExportAuditReplay.mockResolvedValue({
      bundle: { generated_at: '2026-10-24T10:00:00.000Z', totals: { event_count: 1, correlation_count: 1 } },
      exportAuditId: null,
    });
  });

  it('filters by target and exports what the filter shows', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Archived trip');

    await user.click(screen.getByRole('button', { name: 'Filter by target' }));
    const menu = screen.getByRole('dialog', { name: 'Target filter' });
    await user.click(within(menu).getByRole('checkbox', { name: /^Trip/ }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByText('Updated user tier')).not.toBeInTheDocument());
    expect(screen.getByText('Archived trip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export replay/i }));
    await waitFor(() => expect(mocks.adminExportAuditReplay).toHaveBeenCalledTimes(1));
    expect(mocks.adminExportAuditReplay.mock.calls[0][0]).toMatchObject({
      targetFilters: ['trip'],
      selectedEventIds: null,
      dateRange: '30d',
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__audit--export_replay', { count: 1 });
  });

  it('sorts the timeline from the When header and marks the sorted column', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Archived trip');

    const whenHeader = screen.getByRole('columnheader', { name: /When/ });
    expect(whenHeader).toHaveAttribute('aria-sort', 'descending');
    expect(bodyRowLabels()).toEqual(['Select Updated user tier entry', 'Select Archived trip entry']);

    await user.click(within(whenHeader).getByRole('button', { name: 'When' }));
    expect(whenHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(bodyRowLabels()).toEqual(['Select Archived trip entry', 'Select Updated user tier entry']);

    const targetHeader = screen.getByRole('columnheader', { name: /Target/ });
    await user.click(within(targetHeader).getByRole('button', { name: 'Target' }));
    expect(targetHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(whenHeader).not.toHaveAttribute('aria-sort');
    expect(bodyRowLabels()).toEqual(['Select Archived trip entry', 'Select Updated user tier entry']);
  });

  it('opens the trip sheet from the target column and loads the live trip', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Archived trip');

    await user.click(screen.getByRole('button', { name: 'Open trip details' }));
    const sheet = await screen.findByRole('dialog');
    expect(mocks.adminListTrips).toHaveBeenCalledWith({ search: 'trip-42', limit: 20, status: 'all' });
    expect(await within(sheet).findByText('Live trip not found. Showing audit snapshot only.')).toBeInTheDocument();
    expect(within(sheet).getByText('Lisbon long weekend')).toBeInTheDocument();
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__audit--open_target', { target_type: 'trip' });


    await user.click(within(sheet).getByRole('button', { name: 'Open owner' }));
    await waitFor(() => expect(mocks.adminGetUserProfile).toHaveBeenCalledWith('owner-7'));
    expect(screen.queryByText('Live trip not found. Showing audit snapshot only.')).not.toBeInTheDocument();
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__audit--open_owner');
  });

  it('opens the entry sheet and exports that single entry', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Open details for Archived trip' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('1 changed field')).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: /Export entry/i }));
    await waitFor(() => expect(mocks.adminExportAuditReplay).toHaveBeenCalledTimes(1));
    expect(mocks.adminExportAuditReplay.mock.calls[0][0].selectedEventIds).toEqual(['admin:audit-trip']);
  });
});
