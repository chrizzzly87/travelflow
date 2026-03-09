// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  adminListUsers: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminListUserTrips: vi.fn(),
  adminListUserChangeLogs: vi.fn(),
  adminUpdateUserProfile: vi.fn(),
  adminResetUserUsernameCooldown: vi.fn(),
  adminResetUserTermsAcceptance: vi.fn(),
  adminHardDeleteUser: vi.fn(),
  confirmDialog: vi.fn(async () => true),
  promptDialog: vi.fn(async () => null),
  showAppToast: vi.fn(() => 'toast-id'),
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
  DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../../components/profile/ProfileCountryRegionSelect', () => ({
  ProfileCountryRegionSelect: ({ value, onValueChange }: { value?: string; onValueChange: (next: string) => void }) => (
    React.createElement('input', {
      'aria-label': 'Country/Region',
      value: value || '',
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value),
    })
  ),
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

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../services/adminService', () => ({
  adminCreateUserDirect: vi.fn(),
  adminCreateUserInvite: vi.fn(),
  adminGetUserProfile: mocks.adminGetUserProfile,
  adminHardDeleteUser: mocks.adminHardDeleteUser,
  adminListUserChangeLogs: mocks.adminListUserChangeLogs,
  adminListUserTrips: mocks.adminListUserTrips,
  adminListUsers: mocks.adminListUsers,
  adminResetUserUsernameCooldown: mocks.adminResetUserUsernameCooldown,
  adminResetUserTermsAcceptance: mocks.adminResetUserTermsAcceptance,
  adminUpdateTrip: vi.fn(),
  adminUpdateUserOverrides: vi.fn(),
  adminUpdateUserProfile: mocks.adminUpdateUserProfile,
}));

import { AdminUsersPage } from '../../../pages/AdminUsersPage';

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const USER_ROW = {
  user_id: 'user-1',
  email: 'traveler@example.com',
  first_name: 'Traveler',
  last_name: 'One',
  display_name: 'Traveler One',
  username: 'traveler_one',
  username_display: 'TravelerOne',
  username_changed_at: daysAgoIso(10),
  gender: null,
  country: null,
  city: null,
  preferred_language: 'en',
  activation_status: 'activated',
  account_status: 'active',
  system_role: 'user',
  tier_key: 'tier_free',
  total_trips: 2,
  active_trips: 2,
  created_at: daysAgoIso(3),
  updated_at: daysAgoIso(2),
  last_sign_in_at: daysAgoIso(1),
  onboarding_completed_at: daysAgoIso(2),
  auth_provider: 'email',
  auth_providers: ['email'],
  is_anonymous: false,
  provider_subscription_id: 'sub_active_1',
  provider_status: 'active',
  subscription_status: 'active',
  terms_accepted_version: '2026-03-03',
  terms_accepted_at: '2026-03-03T10:00:00Z',
  entitlements_override: {},
} as const;

const USER_ROW_2 = {
  ...USER_ROW,
  user_id: 'user-2',
  email: 'traveler2@example.com',
  first_name: 'Traveler',
  last_name: 'Two',
  display_name: 'Traveler Two',
  username: 'traveler_two',
  username_display: 'TravelerTwo',
  username_changed_at: daysAgoIso(9),
  total_trips: 3,
  active_trips: 3,
  provider_subscription_id: 'sub_canceled_2',
  provider_status: 'canceled',
  subscription_status: 'inactive',
} as const;

const USER_ROW_3 = {
  ...USER_ROW,
  user_id: 'user-3',
  email: 'traveler3@example.com',
  first_name: 'Traveler',
  last_name: 'Three',
  display_name: 'Traveler Three',
  username: 'traveler_three',
  username_display: 'TravelerThree',
  provider_subscription_id: null,
  provider_status: null,
  subscription_status: null,
} as const;

const createTripRow = (index: number) => ({
  trip_id: `trip-${index}`,
  owner_id: USER_ROW.user_id,
  owner_email: USER_ROW.email,
  title: `Trip ${index}`,
  status: 'active' as const,
  trip_expires_at: null,
  archived_at: null,
  source_kind: null,
  created_at: daysAgoIso(20 - index),
  updated_at: daysAgoIso(20 - index),
});

const renderPage = (initialEntries: string[] = ['/admin/users']) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries },
    React.createElement(AdminUsersPage),
  ),
);

const extractNodeText = (value: React.ReactNode): string => {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((entry) => extractNodeText(entry)).join(' ');
  if (React.isValidElement(value)) {
    const element = value as React.ReactElement<{ children?: React.ReactNode }>;
    return extractNodeText(element.props.children);
  }
  return '';
};

const normalizeMessageText = (value: string): string => (
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+"/g, '"')
    .replace(/"\s+/g, '"')
    .replace(/\s+\?/g, '?')
    .trim()
);

const findButtonsByName = (name: RegExp) => (
  screen.findAllByRole('button', { name }, { timeout: 10_000 })
);

const findCheckboxesByName = (name: RegExp) => (
  screen.findAllByRole('checkbox', { name }, { timeout: 10_000 })
);

describe('pages/AdminUsersPage soft delete toasts', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.adminListUsers.mockResolvedValue([USER_ROW]);
    mocks.adminGetUserProfile.mockResolvedValue(USER_ROW);
    mocks.adminListUserTrips.mockResolvedValue([]);
    mocks.adminListUserChangeLogs.mockResolvedValue([]);
    mocks.adminUpdateUserProfile.mockResolvedValue(undefined);
    mocks.adminResetUserUsernameCooldown.mockResolvedValue(undefined);
    mocks.adminResetUserTermsAcceptance.mockResolvedValue(undefined);
    mocks.adminHardDeleteUser.mockResolvedValue(undefined);
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.promptDialog.mockResolvedValue(null);
    mocks.showAppToast.mockImplementation(() => 'toast-id');
  });

  it('shows single-user soft-delete copy and exposes an undo toast action', async () => {
    const user = userEvent.setup();

    renderPage();

    const openDetailButtons = await findButtonsByName(/Traveler One/i);
    await user.click(openDetailButtons[0]);
    await user.click(await screen.findByRole('button', { name: 'Soft-delete user' }));

    const softDeleteDialogCall = mocks.confirmDialog.mock.calls
      .map((entry) => entry[0])
      .find((payload) => payload?.title === 'Soft delete user');

    expect(softDeleteDialogCall).toBeTruthy();
    const softDeleteText = normalizeMessageText(extractNodeText(softDeleteDialogCall?.message));
    expect(softDeleteText).toMatch(/Are you sure you want to soft-delete\s*"Traveler One"\?/);

    await waitFor(() => {
      expect(mocks.adminUpdateUserProfile).toHaveBeenCalledWith('user-1', { accountStatus: 'deleted' });
    });

    const softDeletedToastPayload = mocks.showAppToast.mock.calls
      .map((entry) => entry[0])
      .find((payload) => payload?.title === 'User soft-deleted');

    expect(softDeletedToastPayload).toBeTruthy();
    expect(softDeletedToastPayload?.action?.label).toBe('Undo');

    softDeletedToastPayload?.action?.onClick();

    await waitFor(() => {
      expect(mocks.adminUpdateUserProfile).toHaveBeenCalledWith('user-1', { accountStatus: 'active' });
    });

    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Soft-delete undone',
    }));
  }, 20000);

  it('shows terms acceptance snapshot fields in the user detail drawer', async () => {
    const user = userEvent.setup();

    renderPage();

    const openDetailButtons = await findButtonsByName(/Traveler One/i);
    await user.click(openDetailButtons[0]);

    const identitySection = (await screen.findByRole('heading', { name: 'Identity' })).closest('section');
    expect(identitySection).not.toBeNull();
    expect(identitySection).toHaveTextContent('Terms accepted version: 2026-03-03');
    expect(identitySection).toHaveTextContent('Terms accepted at:');
    expect(identitySection).not.toHaveTextContent('Terms accepted at: Not set');
    expect(identitySection).toHaveTextContent('Last log:');
  }, 20000);

  it('resets terms acceptance from the user detail identity panel', async () => {
    const user = userEvent.setup();

    renderPage();

    const openDetailButtons = await findButtonsByName(/Traveler One/i);
    await user.click(openDetailButtons[0]);

    await user.click(await screen.findByRole('button', { name: 'Reset ToC acceptance' }));

    await waitFor(() => {
      expect(mocks.adminResetUserTermsAcceptance).toHaveBeenCalledWith('user-1', 'admin.testing.reset_terms');
    });
  }, 20000);

  it('shows subscription status pills and honors the subscription query filter', async () => {
    mocks.adminListUsers.mockResolvedValue([USER_ROW, USER_ROW_2, USER_ROW_3]);
    mocks.adminGetUserProfile.mockResolvedValue(USER_ROW);

    renderPage(['/admin/users?subscription=active']);

    expect(await screen.findByRole('columnheader', { name: 'Subscription' })).toBeInTheDocument();
    expect(await screen.findByText('sub_active_1')).toBeInTheDocument();
    expect(screen.queryByText('Canceled')).not.toBeInTheDocument();
    expect(screen.queryByText('No subscription')).not.toBeInTheDocument();
    expect(screen.getByText('traveler@example.com')).toBeInTheDocument();
    expect(screen.queryByText('traveler2@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('traveler3@example.com')).not.toBeInTheDocument();
  }, 20000);

  it('paginates connected trips in the user detail drawer', async () => {
    const user = userEvent.setup();
    const manyTrips = Array.from({ length: 12 }, (_, index) => createTripRow(index + 1));
    mocks.adminListUserTrips.mockResolvedValue(manyTrips);

    renderPage();

    const openDetailButtons = await findButtonsByName(/Traveler One/i);
    await user.click(openDetailButtons[0]);

    const connectedTripsSection = (await screen.findByRole('heading', { name: 'Connected trips' })).closest('section');
    expect(connectedTripsSection).not.toBeNull();
    const section = connectedTripsSection as HTMLElement;

    expect(within(section).getByText('Trip 1')).toBeInTheDocument();
    expect(within(section).queryByText('Trip 11')).not.toBeInTheDocument();
    expect(within(section).getByText('Page 1 / 2')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(within(section).getByText('Trip 11')).toBeInTheDocument();
    });
    expect(within(section).getByText('Page 2 / 2')).toBeInTheDocument();
  }, 20000);

  it('uses hard-delete copy that explains permanent removal versus soft delete', async () => {
    const user = userEvent.setup();

    renderPage();

    const openDetailButtons = await findButtonsByName(/Traveler One/i);
    await user.click(openDetailButtons[0]);
    await user.click(await screen.findByRole('button', { name: 'Hard delete' }));

    const hardDeleteDialogCall = mocks.confirmDialog.mock.calls
      .map((entry) => entry[0])
      .find((payload) => payload?.title === 'Hard delete user');

    expect(hardDeleteDialogCall).toBeTruthy();
    const hardDeleteMessageText = normalizeMessageText(extractNodeText(hardDeleteDialogCall?.message));
    expect(hardDeleteMessageText).toMatch(/Are you sure you want to hard-delete\s*"Traveler One"\?/);
    expect(hardDeleteMessageText).toContain('Use soft delete instead if you may need to restore this user later.');
    expect(hardDeleteMessageText).toContain('This action cannot be undone.');
  }, 20000);

  it('shows a hard-delete error toast for failed bulk hard-delete operations', async () => {
    const user = userEvent.setup();
    mocks.adminHardDeleteUser.mockRejectedValueOnce(new Error('Vite proxy failed'));

    renderPage();

    await findButtonsByName(/Traveler One/i);
    await user.click(screen.getByRole('checkbox', { name: /Select Traveler One/i }));
    await user.click(screen.getByRole('button', { name: 'Hard delete selected' }));

    await waitFor(() => {
      expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Hard delete failed',
      }));
    });
  }, 20000);

  it('uses rich bulk hard-delete copy with transfer hints and irreversible warning', async () => {
    const user = userEvent.setup();
    mocks.adminListUsers.mockResolvedValue([USER_ROW, USER_ROW_2]);

    renderPage();

    await findCheckboxesByName(/Select Traveler/i);
    const travelerOneCheckboxes = screen.getAllByRole('checkbox', { name: /Select Traveler One/i });
    const travelerTwoCheckboxes = screen.getAllByRole('checkbox', { name: /Select Traveler Two/i });
    await user.click(travelerOneCheckboxes[0]);
    await user.click(travelerTwoCheckboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Hard delete selected' }));

    const bulkDialogCall = mocks.confirmDialog.mock.calls
      .map((entry) => entry[0])
      .find((payload) => payload?.title === 'Hard delete selected users');

    expect(bulkDialogCall).toBeTruthy();
    expect(typeof bulkDialogCall?.message).not.toBe('string');
    const bulkMessageText = normalizeMessageText(extractNodeText(bulkDialogCall?.message));
    expect(bulkMessageText).toContain('Selected users: 2');
    expect(bulkMessageText).toContain('Cancel and transfer trips from each user drawer if you need to preserve trip data.');
    expect(bulkMessageText).toContain('This action cannot be undone.');
  }, 20000);

  it('hydrates admin username input from username_display and preserves mixed casing on save', async () => {
    const user = userEvent.setup();
    const mixedCaseUser = {
      ...USER_ROW,
      first_name: null,
      last_name: null,
      display_name: null,
      username: 'exampleuser',
      username_display: 'ExAmPleUser',
    };
    mocks.adminListUsers.mockResolvedValue([mixedCaseUser]);
    mocks.adminGetUserProfile.mockResolvedValue(mixedCaseUser);

    renderPage();

    const openDetailButtons = await findButtonsByName(/ExAmPleUser/i);
    await user.click(openDetailButtons[0]);

    const usernameInput = await screen.findByLabelText('Username');
    expect(usernameInput).toHaveValue('ExAmPleUser');

    await user.clear(usernameInput);
    await user.type(usernameInput, 'NeWMiXeDcAsE');
    await user.click(screen.getByRole('button', { name: 'Save user' }));

    await waitFor(() => {
      expect(mocks.adminUpdateUserProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ username: 'NeWMiXeDcAsE' }),
      );
    });
  }, 20000);

  it('resets username cooldown from the admin drawer with one click', async () => {
    const user = userEvent.setup();

    renderPage();

    const openDetailButtons = await findButtonsByName(/Traveler One/i);
    await user.click(openDetailButtons[0]);

    expect(await screen.findByText(/Self-service username changes are limited to once every 90 days\./i)).toBeInTheDocument();
    expect(screen.getByText(/Cooldown ends:/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke cooldown' }));

    await waitFor(() => {
      expect(mocks.adminResetUserUsernameCooldown).toHaveBeenCalledWith('user-1', 'admin.manual_reset');
    });
  }, 20000);
});
