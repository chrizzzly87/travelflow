// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  adminListTrips: vi.fn(),
  adminListUsers: vi.fn(),
  adminGetUserProfile: vi.fn(),
  adminUpdateTrip: vi.fn(),
  adminHardDeleteTrip: vi.fn(),
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
  DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
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
  normalizeTripGenerationAttemptsForDisplay: vi.fn(() => []),
}));

vi.mock('../../../services/tripGenerationRetryService', () => ({
  retryTripGenerationWithDefaultModel: vi.fn(),
}));

vi.mock('../../../services/tripGenerationAttemptLogService', () => ({
  listAdminTripGenerationAttempts: vi.fn(async () => []),
}));

vi.mock('../../../services/tripGenerationBenchmarkBridge', () => ({
  buildBenchmarkScenarioImportUrl: vi.fn(() => '/admin/ai-benchmark'),
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

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/trips'] },
    React.createElement(AdminTripsPage),
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
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.promptDialog.mockResolvedValue(null);
  });

  it('shows pagination controls and paginates trip rows', async () => {
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(mocks.adminListTrips).toHaveBeenCalled();
    });

    expect(await screen.findByText('Showing 1-25 of 30')).toBeInTheDocument();
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Showing 26-30 of 30')).toBeInTheDocument();
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
  });
});
