// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from '@/tests/helpers/routerHarness';

const mocks = vi.hoisted(() => ({
  adminListAuditLogs: vi.fn(),
  adminListUserChangeLogs: vi.fn(),
  adminExportAuditReplay: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminListTrips: vi.fn(),
  confirmDialog: vi.fn(async () => false),
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

vi.mock('../../../components/admin/AdminFilterMenu', () => ({
  AdminFilterMenu: () => React.createElement('div', null),
}));

vi.mock('../../../components/admin/CopyableUuid', () => ({
  CopyableUuid: ({ value }: { value: string }) => React.createElement('span', null, value),
}));

vi.mock('../../../components/admin/adminLocalCache', () => ({
  readAdminCache: vi.fn(() => []),
  writeAdminCache: vi.fn(),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: mocks.confirmDialog }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: vi.fn(),
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

const createProfileUpdate = (index: number) => ({
  id: `audit-${index}`,
  actor_user_id: 'admin-1',
  actor_email: 'admin@example.com',
  action: 'admin.user.update_profile',
  target_type: 'user',
  target_id: `user-${index}`,
  before_data: { tier_key: 'tier_free', first_name: 'Ada', country: 'DE' },
  after_data: { tier_key: 'tier_mid', first_name: 'Ida', country: 'FR' },
  metadata: null,
  created_at: minutesAgoIso(index + 5),
});

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/audit'] },
    React.createElement(AdminAuditPage),
  ),
);

describe('pages/AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminListAuditLogs.mockResolvedValue([createProfileUpdate(1)]);
    mocks.adminListUserChangeLogs.mockResolvedValue([]);
    mocks.adminGetUserProfile.mockResolvedValue(null);
    mocks.adminListTrips.mockResolvedValue([]);
    mocks.adminExportAuditReplay.mockResolvedValue({
      bundle: { generated_at: '2026-10-24T10:00:00.000Z', totals: { event_count: 1, correlation_count: 1 } },
      exportAuditId: null,
    });
  });

  it('shows bulk export only once a row is selected, and exports exactly that row', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Updated user tier');
    expect(screen.queryByRole('button', { name: /Export selected/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Legend')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select Updated user tier entry' }));
    const bulkBar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bulkBar).getByText('1 entry selected')).toBeInTheDocument();

    await user.click(within(bulkBar).getByRole('button', { name: /Export replay/i }));
    await waitFor(() => expect(mocks.adminExportAuditReplay).toHaveBeenCalledTimes(1));
    expect(mocks.adminExportAuditReplay.mock.calls[0][0].selectedEventIds).toEqual(['admin:audit-1']);

    await user.click(within(bulkBar).getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('summarises changes in the row and lists every field in the entry sheet', async () => {
    const user = userEvent.setup();
    renderPage();

    const summary = await screen.findByRole('button', { name: 'Open details for Updated user tier' });
    expect(within(summary).getByText('Country: DE → FR')).toBeInTheDocument();
    expect(within(summary).getByText('+1 more field')).toBeInTheDocument();

    await user.click(summary);
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('3 changed fields')).toBeInTheDocument();
    expect(within(sheet).getByText('Tier Key')).toBeInTheDocument();
    expect(within(sheet).getByText('admin.user.update_profile')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Undo change' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Export entry/i })).toBeInTheDocument();
  });

  it('keeps per-row actions reachable through the entry menu', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Actions for Updated user tier entry' }));
    expect(await screen.findByRole('menuitem', { name: 'View details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Show full diff' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open user' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open actor' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy action code' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Undo change…' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Export entry' }));
    await waitFor(() => expect(mocks.adminExportAuditReplay).toHaveBeenCalledTimes(1));
    expect(mocks.adminExportAuditReplay.mock.calls[0][0].selectedEventIds).toEqual(['admin:audit-1']);
  });

  it('pages through the timeline 50 entries at a time', async () => {
    const user = userEvent.setup();
    mocks.adminListAuditLogs.mockResolvedValue(Array.from({ length: 60 }, (_, index) => createProfileUpdate(index + 1)));
    renderPage();

    expect(await screen.findByText('Showing 1–50 of 60 entries')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 51–60 of 60 entries')).toBeInTheDocument();
  });
});
