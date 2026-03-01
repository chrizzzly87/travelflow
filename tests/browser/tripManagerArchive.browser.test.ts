// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  readLocalStorageItem: vi.fn(),
  writeLocalStorageItem: vi.fn(),
  getAllTrips: vi.fn(),
  deleteTrip: vi.fn(),
  saveTrip: vi.fn(),
  dbArchiveTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
  syncTripsFromDb: vi.fn(),
  enqueueTripCommitAndSync: vi.fn(),
  confirmDialog: vi.fn(),
  trackEvent: vi.fn(),
  showAppToast: vi.fn(() => 'toast-id'),
}));

vi.mock('../../services/browserStorageService', () => ({
  readLocalStorageItem: mocks.readLocalStorageItem,
  writeLocalStorageItem: mocks.writeLocalStorageItem,
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
  deleteTrip: mocks.deleteTrip,
  saveTrip: mocks.saveTrip,
}));

vi.mock('../../services/dbService', () => ({
  DB_ENABLED: true,
  dbArchiveTrip: mocks.dbArchiveTrip,
  dbUpsertTrip: mocks.dbUpsertTrip,
  syncTripsFromDb: mocks.syncTripsFromDb,
}));

vi.mock('../../services/tripSyncManager', () => ({
  enqueueTripCommitAndSync: mocks.enqueueTripCommitAndSync,
}));

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: mocks.confirmDialog }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

import { TripManager } from '../../components/TripManager';

describe('components/TripManager archive flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readLocalStorageItem.mockReturnValue(null);
    mocks.getAllTrips.mockReturnValue([
      makeTrip({ id: 'trip-1', title: 'Archive Candidate', isFavorite: false }),
    ]);
    mocks.syncTripsFromDb.mockResolvedValue(undefined);
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.dbArchiveTrip.mockResolvedValue(true);
    mocks.dbUpsertTrip.mockResolvedValue('trip-1');
  });

  it('archives through dbArchiveTrip before local removal', async () => {
    const user = userEvent.setup();
    render(
      React.createElement(TripManager, {
        isOpen: true,
        onClose: vi.fn(),
        onSelectTrip: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(screen.getAllByText('Archive Candidate').length).toBeGreaterThan(0);
    });

    const archiveButtons = screen.getAllByRole('button', { name: 'Archive trip' });
    await user.click(archiveButtons[0]);

    await waitFor(() => {
      expect(mocks.dbArchiveTrip).toHaveBeenCalledWith('trip-1', {
        source: 'my_trips',
        metadata: { surface: 'trip_manager' },
      });
      expect(mocks.deleteTrip).toHaveBeenCalledWith('trip-1');
      expect(mocks.trackEvent).toHaveBeenCalledWith('my_trips__trip_archive--single', { trip_id: 'trip-1' });
    });
  });

  it('queues local archive and removes locally when db archive fails', async () => {
    const user = userEvent.setup();
    mocks.dbArchiveTrip.mockResolvedValueOnce(false);

    render(
      React.createElement(TripManager, {
        isOpen: true,
        onClose: vi.fn(),
        onSelectTrip: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(screen.getAllByText('Archive Candidate').length).toBeGreaterThan(0);
    });

    const archiveButtons = screen.getAllByRole('button', { name: 'Archive trip' });
    await user.click(archiveButtons[0]);

    await waitFor(() => {
      expect(mocks.dbArchiveTrip).toHaveBeenCalledTimes(1);
    });
    expect(mocks.enqueueTripCommitAndSync).toHaveBeenCalledTimes(1);
    expect(mocks.deleteTrip).toHaveBeenCalledWith('trip-1');
  });

  it('offers undo after archive and restores the trip when undo is clicked', async () => {
    const user = userEvent.setup();
    render(
      React.createElement(TripManager, {
        isOpen: true,
        onClose: vi.fn(),
        onSelectTrip: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(screen.getAllByText('Archive Candidate').length).toBeGreaterThan(0);
    });

    const archiveButtons = screen.getAllByRole('button', { name: 'Archive trip' });
    await user.click(archiveButtons[0]);

    await waitFor(() => {
      expect(mocks.deleteTrip).toHaveBeenCalledWith('trip-1');
    });

    const toastPayloads = mocks.showAppToast.mock.calls.map((call) => call[0] as Record<string, unknown>);
    const archiveToast = toastPayloads.find((payload) => payload.tone === 'remove' && typeof payload.action === 'object') as {
      action?: { onClick?: () => void };
    } | undefined;
    expect(archiveToast).toBeDefined();
    expect(archiveToast?.action?.onClick).toBeTypeOf('function');

    archiveToast?.action?.onClick?.();

    await waitFor(() => {
      expect(mocks.saveTrip).toHaveBeenCalledTimes(1);
      expect(mocks.dbUpsertTrip).toHaveBeenCalledTimes(1);
      expect(mocks.trackEvent).toHaveBeenCalledWith('my_trips__trip_archive--undo', { trip_id: 'trip-1' });
      expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
        tone: 'add',
        title: 'Archive undone',
      }));
    });
  });
});
