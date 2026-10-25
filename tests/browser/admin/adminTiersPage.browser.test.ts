// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from '@/tests/helpers/routerHarness';

const mocks = vi.hoisted(() => ({
  adminPreviewTierReapply: vi.fn(),
  adminReapplyTierToUsers: vi.fn(),
  adminUpdatePlanEntitlements: vi.fn(),
  confirmDialog: vi.fn(),
  showAppToast: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement('div', null, React.createElement('h1', null, title), actions, children)
  ),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: mocks.confirmDialog, prompt: vi.fn() }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../components/admin/adminLocalCache', () => ({
  readAdminCache: (_key: string, fallback: unknown) => fallback,
  writeAdminCache: vi.fn(),
}));

vi.mock('../../../services/adminService', () => ({
  adminPreviewTierReapply: mocks.adminPreviewTierReapply,
  adminReapplyTierToUsers: mocks.adminReapplyTierToUsers,
  adminUpdatePlanEntitlements: mocks.adminUpdatePlanEntitlements,
}));

import { AdminTiersPage } from '../../../pages/AdminTiersPage';
import { PLAN_CATALOG } from '../../../config/planCatalog';

const renderPage = () => render(
  React.createElement(MemoryRouter, { initialEntries: ['/admin/tiers'] }, React.createElement(AdminTiersPage)),
);

const tierCard = (tierKey: keyof typeof PLAN_CATALOG) => screen.getByLabelText(`${PLAN_CATALOG[tierKey].publicName} tier`);

describe('pages/AdminTiersPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.adminPreviewTierReapply.mockResolvedValue({
      affected_users: 12,
      affected_trips: 30,
      active_trips: 20,
      expired_trips: 8,
      archived_trips: 2,
      users_with_overrides: 1,
    });
    mocks.adminUpdatePlanEntitlements.mockResolvedValue(undefined);
    mocks.adminReapplyTierToUsers.mockResolvedValue({ affected_users: 12, affected_trips: 30 });
    mocks.confirmDialog.mockResolvedValue(true);
  });

  it('shows one card per tier with the edit form and the reapply preview', async () => {
    renderPage();

    await waitFor(() => expect(mocks.adminPreviewTierReapply).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('heading', { name: 'Plans' })).toBeInTheDocument();

    const card = tierCard('tier_mid');
    expect(within(card).getByText('1. Limits and permissions')).toBeInTheDocument();
    expect(within(card).getByText('2. Existing customers (optional)')).toBeInTheDocument();
    expect(within(card).getByLabelText('Max active trips')).toBeInTheDocument();
    expect(within(card).getByText('Edit as JSON')).toBeInTheDocument();
    expect(await within(card).findByText('20 active · 8 expired · 2 archived')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Reapply to 12 customers…' })).toBeEnabled();
  });

  it('saves the edited template and blocks reapply until it is saved', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(mocks.adminPreviewTierReapply).toHaveBeenCalledTimes(3));

    const card = tierCard('tier_mid');
    const input = within(card).getByLabelText('Max active trips');
    await user.clear(input);
    await user.type(input, '7');

    expect(within(card).getByText('Unsaved changes')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Reapply to/ })).toBeDisabled();

    await user.click(within(card).getByRole('button', { name: `Save ${PLAN_CATALOG.tier_mid.publicName}` }));

    await waitFor(() => expect(mocks.adminUpdatePlanEntitlements).toHaveBeenCalledTimes(1));
    const [tierKey, payload] = mocks.adminUpdatePlanEntitlements.mock.calls[0];
    expect(tierKey).toBe('tier_mid');
    expect(payload).toMatchObject({ maxActiveTrips: 7 });
    await waitFor(() => expect(within(card).queryByText('Unsaved changes')).toBeNull());
    expect(within(card).getByRole('button', { name: /Reapply to/ })).toBeEnabled();
    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });

  it('asks for confirmation with the preview counts before reapplying', async () => {
    const user = userEvent.setup();
    mocks.confirmDialog.mockResolvedValueOnce(false);
    renderPage();
    await waitFor(() => expect(mocks.adminPreviewTierReapply).toHaveBeenCalledTimes(3));

    const card = tierCard('tier_premium');
    const reapply = await within(card).findByRole('button', { name: 'Reapply to 12 customers…' });

    await user.click(reapply);
    expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'danger',
      confirmLabel: 'Reapply to 12 customers',
    }));
    expect(mocks.adminReapplyTierToUsers).not.toHaveBeenCalled();

    await user.click(reapply);
    await waitFor(() => expect(mocks.adminReapplyTierToUsers).toHaveBeenCalledWith('tier_premium'));
  });
});
