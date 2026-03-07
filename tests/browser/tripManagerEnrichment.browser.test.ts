// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

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
  trackEvent: vi.fn(),
  showAppToast: vi.fn(() => 'toast-id'),
  confirmDialog: vi.fn(),
  getGoogleMapsApiKey: vi.fn(),
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
  useFocusTrap: () => undefined,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../utils', async () => {
  const actual = await vi.importActual<typeof import('../../utils')>('../../utils');
  return {
    ...actual,
    getGoogleMapsApiKey: mocks.getGoogleMapsApiKey,
  };
});

import { TripManager } from '../../components/TripManager';

describe('components/TripManager enrichment flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readLocalStorageItem.mockReturnValue(null);
    mocks.syncTripsFromDb.mockResolvedValue(undefined);
    mocks.getGoogleMapsApiKey.mockReturnValue('google-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        {
          address_components: [
            {
              short_name: 'DE',
              long_name: 'Germany',
              types: ['country'],
            },
          ],
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
  });

  it('keeps country enrichment local instead of writing remote trip updates on sidebar open', async () => {
    mocks.getAllTrips.mockReturnValue([
      makeTrip({
        id: 'trip-enrich',
        title: 'Berlin Loop',
        items: [
          makeCityItem({
            id: 'city-berlin',
            title: 'Berlin',
            location: 'Berlin',
            startDateOffset: 0,
            duration: 2,
            coordinates: { lat: 52.52, lng: 13.405 },
          }),
        ],
      }),
    ]);

    render(
      React.createElement(TripManager, {
        isOpen: true,
        onClose: vi.fn(),
        onSelectTrip: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(mocks.saveTrip).toHaveBeenCalled();
    });

    expect(mocks.dbUpsertTrip).not.toHaveBeenCalled();
  });
});
