// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  adminListUsers: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminListUserTrips: vi.fn(),
  adminUpdateUserProfile: vi.fn(),
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
  adminListUserTrips: mocks.adminListUserTrips,
  adminListUsers: mocks.adminListUsers,
  adminUpdateTrip: vi.fn(),
  adminUpdateUserOverrides: vi.fn(),
  adminUpdateUserProfile: mocks.adminUpdateUserProfile,
}));

import { AdminUsersPage } from '../../../pages/AdminUsersPage';

const USER_ROW = {
  user_id: 'user-1',
  email: 'traveler@example.com',
  first_name: 'Traveler',
  last_name: 'One',
  display_name: 'Traveler One',
  username: 'traveler_one',
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
  created_at: '2026-02-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
  last_sign_in_at: '2026-02-15T00:00:00.000Z',
  onboarding_completed_at: '2026-02-10T00:00:00.000Z',
  auth_provider: 'email',
  auth_providers: ['email'],
  is_anonymous: false,
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
  total_trips: 3,
  active_trips: 3,
} as const;

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/users'] },
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

describe('pages/AdminUsersPage soft delete toasts', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.adminListUsers.mockResolvedValue([USER_ROW]);
    mocks.adminGetUserProfile.mockResolvedValue(USER_ROW);
    mocks.adminListUserTrips.mockResolvedValue([]);
    mocks.adminUpdateUserProfile.mockResolvedValue(undefined);
    mocks.adminHardDeleteUser.mockResolvedValue(undefined);
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.promptDialog.mockResolvedValue(null);
    mocks.showAppToast.mockImplementation(() => 'toast-id');
  });

  it('shows single-user soft-delete copy and exposes an undo toast action', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findAllByRole('button', { name: /Traveler One/i });
    const openDetailButtons = screen.getAllByRole('button', { name: /Traveler One/i });
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
  });

  it('uses hard-delete copy that explains permanent removal versus soft delete', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findAllByRole('button', { name: /Traveler One/i });
    const openDetailButtons = screen.getAllByRole('button', { name: /Traveler One/i });
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
  });

  it('shows a hard-delete error toast for failed bulk hard-delete operations', async () => {
    const user = userEvent.setup();
    mocks.adminHardDeleteUser.mockRejectedValueOnce(new Error('Vite proxy failed'));

    renderPage();

    await screen.findAllByRole('button', { name: /Traveler One/i });
    await user.click(screen.getByRole('checkbox', { name: /Select Traveler One/i }));
    await user.click(screen.getByRole('button', { name: 'Hard delete selected' }));

    await waitFor(() => {
      expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Hard delete failed',
      }));
    });
  });

  it('uses rich bulk hard-delete copy with transfer hints and irreversible warning', async () => {
    const user = userEvent.setup();
    mocks.adminListUsers.mockResolvedValue([USER_ROW, USER_ROW_2]);

    renderPage();

    await screen.findAllByRole('checkbox', { name: /Select Traveler/i });
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
  });
});
