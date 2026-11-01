// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from '@/tests/helpers/routerHarness';
import type { ConfirmDialogOptions } from '../../../components/AppDialogProvider';
import type { showAppToast } from '../../../components/ui/appToast';

// Filter, sort, open-sheet and bulk-action flows against the real filter menus and table.

const mocks = vi.hoisted(() => ({
  adminListUsers: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminListUserTrips: vi.fn(),
  adminListUserChangeLogs: vi.fn(),
  adminUpdateUserProfile: vi.fn(),
  adminHardDeleteUser: vi.fn(),
  confirmDialog: vi.fn(async (_options: ConfirmDialogOptions): Promise<boolean> => true),
  showAppToast: vi.fn<typeof showAppToast>(() => 'toast-id'),
  trackEvent: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement('div', null, React.createElement('h1', null, title), actions, children)
  ),
}));

vi.mock('../../../components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? React.createElement('div', null, children) : null),
  DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', { role: 'dialog' }, children),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', null, children),
  DrawerClose: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../components/profile/ProfileCountryRegionSelect', () => ({
  ProfileCountryRegionSelect: () => React.createElement('input', { 'aria-label': 'Country/Region' }),
}));

vi.mock('../../../components/admin/CopyableUuid', () => ({
  CopyableUuid: ({ value }: { value: string }) => React.createElement('span', null, value),
  copyTextToClipboard: vi.fn(async () => true),
}));

vi.mock('../../../components/admin/adminLocalCache', () => ({
  readAdminCache: vi.fn((_key: string, fallback: unknown) => fallback),
  writeAdminCache: vi.fn(),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: mocks.confirmDialog, prompt: vi.fn(async () => null) }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../services/analyticsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analyticsService')>()),
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../../services/adminService', () => ({
  adminCreateUserDirect: vi.fn(),
  adminCreateUserInvite: vi.fn(),
  adminGetTripVersionSnapshots: vi.fn(async () => null),
  adminGetUserProfile: mocks.adminGetUserProfile,
  adminHardDeleteUser: mocks.adminHardDeleteUser,
  adminListUserChangeLogs: mocks.adminListUserChangeLogs,
  adminListUserTrips: mocks.adminListUserTrips,
  adminListUsers: mocks.adminListUsers,
  adminResetUserTermsAcceptance: vi.fn(),
  adminResetUserUsernameCooldown: vi.fn(),
  adminUpdateTrip: vi.fn(),
  adminUpdateUserOverrides: vi.fn(),
  adminUpdateUserProfile: mocks.adminUpdateUserProfile,
}));

import { AdminUsersPage } from '../../../pages/AdminUsersPage';

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const makeUser = (id: string, firstName: string, overrides: Record<string, unknown> = {}) => ({
  user_id: id,
  email: `${firstName.toLowerCase()}@example.com`,
  first_name: firstName,
  last_name: 'Tester',
  display_name: `${firstName} Tester`,
  username: null,
  username_display: null,
  activation_status: 'activated',
  account_status: 'active',
  system_role: 'user',
  tier_key: 'tier_free',
  total_trips: 0,
  active_trips: 0,
  created_at: daysAgoIso(3),
  updated_at: daysAgoIso(2),
  last_sign_in_at: daysAgoIso(1),
  auth_provider: 'email',
  auth_providers: ['email'],
  is_anonymous: false,
  entitlements_override: {},
  ...overrides,
});

const ADA = makeUser('user-ada', 'Ada', { total_trips: 4, active_trips: 4 });
const BEA = makeUser('user-bea', 'Bea', { account_status: 'disabled', total_trips: 1, active_trips: 1 });
const CAL = makeUser('user-cal', 'Cal', { total_trips: 2, active_trips: 2 });

const LocationProbe = () => {
  const location = useLocation();
  return React.createElement('output', { 'data-testid': 'location-search' }, location.search);
};

const renderPage = (initialEntries: string[] = ['/admin/users']) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries },
    React.createElement(AdminUsersPage),
    React.createElement(LocationProbe),
  ),
);

const locationSearch = () => screen.getByTestId('location-search').textContent ?? '';

const bodyRowNames = (): string[] => {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body).getAllByRole('row').map((row) => (
    within(row).queryByRole('checkbox')?.getAttribute('aria-label') ?? ''
  ));
};

describe('pages/AdminUsersPage flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminListUsers.mockResolvedValue([ADA, BEA, CAL]);
    mocks.adminGetUserProfile.mockImplementation(async (userId: string) => [ADA, BEA, CAL].find((row) => row.user_id === userId) ?? null);
    mocks.adminListUserTrips.mockResolvedValue([]);
    mocks.adminListUserChangeLogs.mockResolvedValue([]);
    mocks.adminUpdateUserProfile.mockResolvedValue(undefined);
    mocks.adminHardDeleteUser.mockResolvedValue(undefined);
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.showAppToast.mockImplementation(() => 'toast-id');
  });

  it('filters by status from the real menu, mirrors it into the URL and resets', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('ada@example.com');

    await user.click(screen.getByRole('button', { name: 'Filter by status' }));
    const menu = screen.getByRole('dialog', { name: 'Status filter' });
    await user.click(within(menu).getByRole('checkbox', { name: /^Suspended/ }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument());
    expect(screen.getByText('bea@example.com')).toBeInTheDocument();
    expect(locationSearch()).toContain('status=disabled');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.getByText('ada@example.com')).toBeInTheDocument());
    expect(locationSearch()).not.toContain('status=');
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__users--reset_filters');
  }, 20000);

  it('sorts from a column header and keeps the sort in the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('ada@example.com');

    const tripsHeader = screen.getByRole('columnheader', { name: /Trips/ });
    await user.click(within(tripsHeader).getByRole('button', { name: 'Trips' }));
    expect(bodyRowNames()).toEqual([
      'Select Bea Tester',
      'Select Cal Tester',
      'Select Ada Tester',
    ]);
    expect(locationSearch()).toContain('sort=total_trips');
    expect(locationSearch()).toContain('dir=asc');

    await user.click(within(tripsHeader).getByRole('button', { name: 'Trips' }));
    expect(bodyRowNames()[0]).toBe('Select Ada Tester');
    expect(locationSearch()).not.toContain('dir=');
  }, 20000);

  it('opens the sheet from a row, deep-links it and tracks tab changes', async () => {
    const user = userEvent.setup();
    renderPage();

    const [openCal] = await screen.findAllByRole('button', { name: /^Cal Tester/ });
    await user.click(openCal);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    await waitFor(() => expect(locationSearch()).toContain('user=user-cal&drawer=user'));
    expect(mocks.adminListUserTrips).toHaveBeenCalledWith('user-cal');

    await user.click(within(sheet).getByRole('tab', { name: 'Billing' }));
    expect(within(sheet).getByRole('heading', { name: 'Subscription' })).toBeInTheDocument();
    expect(mocks.trackEvent).toHaveBeenCalledWith('admin__users_detail--tab', { tab: 'billing' });
  }, 20000);

  it('bulk soft-deletes the selected rows only after confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('ada@example.com');

    await user.click(screen.getByRole('checkbox', { name: 'Select Ada Tester' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Cal Tester' }));
    const bulkBar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(bulkBar).toHaveTextContent('2 users selected');

    mocks.confirmDialog.mockResolvedValueOnce(false);
    await user.click(within(bulkBar).getByRole('button', { name: 'Soft delete' }));
    await waitFor(() => expect(mocks.confirmDialog).toHaveBeenCalledTimes(1));
    expect(mocks.adminUpdateUserProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('2 users selected');

    await user.click(within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole('button', { name: 'Soft delete' }));
    expect(mocks.confirmDialog.mock.calls[1][0]).toMatchObject({
      title: 'Soft delete selected users',
      message: 'Soft-delete 2 selected users?\n\nSoft delete can be reverted later and prevents sign-in while deleted.',
      confirmLabel: 'Soft delete',
    });
    await waitFor(() => expect(mocks.adminUpdateUserProfile).toHaveBeenCalledTimes(2));
    expect(mocks.adminUpdateUserProfile).toHaveBeenCalledWith('user-ada', { accountStatus: 'deleted' });
    expect(mocks.adminUpdateUserProfile).toHaveBeenCalledWith('user-cal', { accountStatus: 'deleted' });
    await waitFor(() => expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Users soft-deleted',
      description: '2 users were soft-deleted successfully.',
    })));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  }, 20000);

  it('keeps only the failed rows selected after a partial bulk hard delete', async () => {
    const user = userEvent.setup();
    mocks.adminHardDeleteUser.mockImplementation(async (userId: string) => {
      if (userId === 'user-cal') throw new Error('raw database failure');
    });
    renderPage();
    await screen.findByText('ada@example.com');

    await user.click(screen.getByRole('checkbox', { name: 'Select Ada Tester' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Cal Tester' }));
    await user.click(within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole('button', { name: 'Hard delete' }));

    expect(mocks.confirmDialog.mock.calls[0][0]).toMatchObject({ title: 'Hard delete selected users', confirmLabel: 'Hard delete' });
    await waitFor(() => expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Some users were not deleted',
      tone: 'warning',
    })));
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('1 user selected');
    expect(screen.getByText(/1 user failed to hard-delete\./)).toBeInTheDocument();
    expect(screen.queryByText(/raw database failure/)).not.toBeInTheDocument();
  }, 20000);

  it('never offers a soft-deleted account for bulk actions', async () => {
    mocks.adminListUsers.mockResolvedValue([ADA, makeUser('user-dee', 'Dee', { account_status: 'deleted' })]);
    renderPage();
    await screen.findByText('ada@example.com');

    expect(screen.getByRole('checkbox', { name: 'Cannot select Dee Tester (soft-deleted)' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select all 1 matching users' })).toBeEnabled();
  }, 20000);
});
