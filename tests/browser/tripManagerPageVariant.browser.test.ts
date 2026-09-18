// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  readLocalStorageItem: vi.fn(),
  writeLocalStorageItem: vi.fn(),
  readSessionStorageItem: vi.fn(),
  writeSessionStorageItem: vi.fn(),
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
  useFocusTrap: vi.fn(),
}));

vi.mock('../../services/browserStorageService', () => ({
  readLocalStorageItem: mocks.readLocalStorageItem,
  writeLocalStorageItem: mocks.writeLocalStorageItem,
  readSessionStorageItem: mocks.readSessionStorageItem,
  writeSessionStorageItem: mocks.writeSessionStorageItem,
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
  useFocusTrap: (options: unknown) => mocks.useFocusTrap(options),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

import { TripManager } from '../../components/TripManager';

/**
 * The `page` variant backs the `/trips` route, which is the installed PWA's
 * start page. It must NOT behave like a modal: no dialog semantics, no focus
 * trap, no Escape-to-dismiss and no close button — there is nothing behind it
 * to return to.
 */
describe('components/TripManager page variant', () => {
  // This repo's vitest setup does not install RTL's auto-cleanup, so without
  // this every render in the file stays mounted and `screen` queries resolve
  // against the first one.
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readLocalStorageItem.mockReturnValue(null);
    mocks.getAllTrips.mockReturnValue([makeTrip({ id: 'trip-1', title: 'Taiwan Loop' })]);
    mocks.syncTripsFromDb.mockResolvedValue(undefined);
  });

  const renderVariant = (variant: 'overlay' | 'page', onClose = vi.fn()) => {
    const onSelectTrip = vi.fn();
    render(
      React.createElement(TripManager, {
        isOpen: true,
        variant,
        onClose,
        onSelectTrip,
      })
    );
    return { onClose, onSelectTrip };
  };

  it('renders the trip list without dialog semantics', async () => {
    renderVariant('page');

    await waitFor(() => {
      expect(screen.getAllByText('Taiwan Loop').length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close My Plans panel' })).toBeNull();
  });

  it('does not trap focus', async () => {
    renderVariant('page');
    await waitFor(() => {
      expect(mocks.useFocusTrap).toHaveBeenCalled();
    });
    const lastCall = mocks.useFocusTrap.mock.calls.at(-1)?.[0] as { isActive: boolean };
    expect(lastCall.isActive).toBe(false);
  });

  it('ignores Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderVariant('page');

    await waitFor(() => {
      expect(screen.getAllByText('Taiwan Loop').length).toBeGreaterThan(0);
    });

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still selects a trip', async () => {
    const { onSelectTrip } = renderVariant('page');

    await waitFor(() => {
      expect(screen.getAllByText('Taiwan Loop').length).toBeGreaterThan(0);
    });

    const openTripButton = screen.getAllByText('Taiwan Loop')[0].closest('button');
    expect(openTripButton).not.toBeNull();
    // fireEvent rather than userEvent: the row re-renders on pointer enter to
    // position the hover preview, which can detach the element between
    // userEvent's synthetic mousedown and click.
    fireEvent.click(openTripButton as HTMLButtonElement);
    await waitFor(() => {
      expect(onSelectTrip).toHaveBeenCalledWith(expect.objectContaining({ id: 'trip-1' }));
    });
  });

  it('keeps the overlay variant modal', async () => {
    const user = userEvent.setup();
    const { onClose } = renderVariant('overlay');

    await waitFor(() => {
      expect(screen.getAllByText('Taiwan Loop').length).toBeGreaterThan(0);
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();

    const focusTrapCall = mocks.useFocusTrap.mock.calls.at(-1)?.[0] as { isActive: boolean };
    expect(focusTrapCall.isActive).toBe(true);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
