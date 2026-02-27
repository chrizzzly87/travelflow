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
  confirmDialog: vi.fn(),
  trackEvent: vi.fn(),
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
      expect(screen.getByText('Archive Candidate')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Archive trip' }));

    await waitFor(() => {
      expect(mocks.dbArchiveTrip).toHaveBeenCalledWith('trip-1', {
        source: 'my_trips',
        metadata: { surface: 'trip_manager' },
      });
      expect(mocks.deleteTrip).toHaveBeenCalledWith('trip-1');
      expect(mocks.trackEvent).toHaveBeenCalledWith('my_trips__trip_archive--single', { trip_id: 'trip-1' });
    });
  });

  it('does not remove locally when db archive fails', async () => {
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
      expect(screen.getByText('Archive Candidate')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Archive trip' }));

    await waitFor(() => {
      expect(mocks.dbArchiveTrip).toHaveBeenCalledTimes(1);
    });
    expect(mocks.deleteTrip).not.toHaveBeenCalled();
  });
});
