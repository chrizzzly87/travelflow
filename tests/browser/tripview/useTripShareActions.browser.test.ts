// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IViewSettings } from '../../../types';
import { makeTrip } from '../../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  dbCreateShareLink: vi.fn(),
  dbGetTrip: vi.fn(),
  dbListTripShares: vi.fn(),
  dbUpdateTripShareViewSettings: vi.fn(),
  dbUpsertTrip: vi.fn(),
  ensureDbSession: vi.fn(),
  clipboardWriteText: vi.fn(),
}));

vi.mock('../../../config/db', () => ({
  DB_ENABLED: true,
}));

vi.mock('../../../services/dbApi', () => ({
  dbCreateShareLink: mocks.dbCreateShareLink,
  dbGetTrip: mocks.dbGetTrip,
  dbListTripShares: mocks.dbListTripShares,
  dbUpdateTripShareViewSettings: mocks.dbUpdateTripShareViewSettings,
  dbUpsertTrip: mocks.dbUpsertTrip,
  ensureDbSession: mocks.ensureDbSession,
}));

import { useTripShareActions } from '../../../components/tripview/useTripShareActions';

const CURRENT_VIEW_SETTINGS: IViewSettings = {
  layoutMode: 'horizontal',
  timelineMode: 'timeline',
  timelineView: 'vertical',
  mapDockMode: 'docked',
  mapStyle: 'standard',
  routeMode: 'simple',
  showCityNames: true,
  zoomLevel: 1.5,
  sidebarWidth: 520,
  timelineHeight: 340,
};

describe('components/tripview/useTripShareActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mocks.clipboardWriteText,
      },
    });
    mocks.dbUpdateTripShareViewSettings.mockResolvedValue(true);
    mocks.clipboardWriteText.mockResolvedValue(undefined);
  });

  it('syncs the latest share view settings before copying an existing share link', async () => {
    const callOrder: string[] = [];
    mocks.dbUpdateTripShareViewSettings.mockImplementation(async () => {
      callOrder.push('sync');
      return true;
    });
    mocks.clipboardWriteText.mockImplementation(async () => {
      callOrder.push('copy');
    });

    const trip = makeTrip({
      id: 'trip-share-actions',
      defaultView: CURRENT_VIEW_SETTINGS,
    });
    const showToast = vi.fn();

    const { result } = renderHook(() => useTripShareActions({
      canShare: true,
      isTripLockedByExpiry: false,
      tripId: trip.id,
      trip,
      currentViewSettings: CURRENT_VIEW_SETTINGS,
      shareMode: 'view',
      shareUrlsByMode: {
        view: 'https://example.com/s/share-token',
      },
      setShareUrlsByMode: vi.fn(),
      setIsShareOpen: vi.fn(),
      setIsGeneratingShare: vi.fn(),
      showToast,
    }));

    await act(async () => {
      await result.current.handleCopyShareLink();
    });

    expect(mocks.dbUpdateTripShareViewSettings).toHaveBeenCalledWith(trip.id, CURRENT_VIEW_SETTINGS);
    expect(mocks.clipboardWriteText).toHaveBeenCalledWith('https://example.com/s/share-token');
    expect(callOrder).toEqual(['sync', 'copy']);
    expect(showToast).toHaveBeenCalledWith('Link copied to clipboard', {
      tone: 'info',
      title: 'Share link',
    });
  });
});
