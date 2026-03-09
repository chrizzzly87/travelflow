// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensureExistingDbSession: vi.fn(),
    ensureDbSession: vi.fn(),
    uploadLocalTripsToDb: vi.fn(),
    syncTripsFromDb: vi.fn(),
    dbGetUserSettings: vi.fn(),
    applyUserSettingsToLocalStorage: vi.fn(),
}));

vi.mock('../../config/db', () => ({
    DB_ENABLED: true,
}));

vi.mock('../../services/dbService', () => ({
    ensureExistingDbSession: mocks.ensureExistingDbSession,
    ensureDbSession: mocks.ensureDbSession,
    uploadLocalTripsToDb: mocks.uploadLocalTripsToDb,
    syncTripsFromDb: mocks.syncTripsFromDb,
    dbGetUserSettings: mocks.dbGetUserSettings,
    applyUserSettingsToLocalStorage: mocks.applyUserSettingsToLocalStorage,
}));

import {
    DB_SYNC_RETRY_INTERVAL_MS,
    __resetUseDbSyncStateForTests,
    useDbSync,
} from '../../hooks/useDbSync';

const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

const setNavigatorOnlineState = (isOnline: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => isOnline,
    });
};

describe('hooks/useDbSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetUseDbSyncStateForTests();
        setNavigatorOnlineState(true);

        mocks.ensureExistingDbSession.mockResolvedValue('session-id');
        mocks.uploadLocalTripsToDb.mockResolvedValue(undefined);
        mocks.syncTripsFromDb.mockResolvedValue(undefined);
        mocks.dbGetUserSettings.mockResolvedValue({ language: 'de' });
        mocks.applyUserSettingsToLocalStorage.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        __resetUseDbSyncStateForTests();
        if (originalOnLineDescriptor) {
            Object.defineProperty(window.navigator, 'onLine', originalOnLineDescriptor);
        } else {
            delete (window.navigator as Navigator & { onLine?: unknown }).onLine;
        }
    });

    it('runs DB bootstrap once and applies language settings', async () => {
        const onLanguageLoaded = vi.fn();
        renderHook(() => useDbSync(onLanguageLoaded));

        await waitFor(() => {
            expect(mocks.ensureExistingDbSession).toHaveBeenCalledTimes(1);
            expect(mocks.uploadLocalTripsToDb).toHaveBeenCalledTimes(1);
            expect(mocks.syncTripsFromDb).toHaveBeenCalledTimes(1);
            expect(mocks.dbGetUserSettings).toHaveBeenCalledTimes(1);
            expect(mocks.applyUserSettingsToLocalStorage).toHaveBeenCalledTimes(1);
            expect(onLanguageLoaded).toHaveBeenCalledWith('de');
        });
    });

    it('keeps retrying while offline and resumes sync once connectivity returns', async () => {
        vi.useFakeTimers();
        setNavigatorOnlineState(false);
        renderHook(() => useDbSync());

        await act(async () => {
            vi.advanceTimersByTime(DB_SYNC_RETRY_INTERVAL_MS * 2);
            await Promise.resolve();
        });

        expect(mocks.ensureExistingDbSession).not.toHaveBeenCalled();

        setNavigatorOnlineState(true);

        await act(async () => {
            vi.advanceTimersByTime(DB_SYNC_RETRY_INTERVAL_MS);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mocks.ensureExistingDbSession).toHaveBeenCalledTimes(1);
        expect(mocks.syncTripsFromDb).toHaveBeenCalledTimes(1);
    });
});
