import { useEffect, useRef } from 'react';
import { DB_ENABLED } from '../config/db';
import { AppLanguage } from '../types';

/** Has the DB sync already run in this session? */
let hasSynced = false;
let syncInFlightPromise: Promise<boolean> | null = null;

type DbServiceModule = typeof import('../services/dbService');
let dbServicePromise: Promise<DbServiceModule> | null = null;

export const DB_SYNC_RETRY_INTERVAL_MS = 15000;

const loadDbService = async (): Promise<DbServiceModule> => {
    if (!dbServicePromise) {
        dbServicePromise = import('../services/dbService');
    }
    return dbServicePromise;
};

/**
 * Runs the DB bootstrap (session, upload local trips, sync from DB, load user
 * settings) exactly once per browser session. Safe to call from multiple
 * components — the first invocation wins, subsequent calls are no-ops.
 */
export const useDbSync = (onLanguageLoaded?: (lang: AppLanguage) => void) => {
    const calledRef = useRef(false);
    const onLanguageLoadedRef = useRef(onLanguageLoaded);
    onLanguageLoadedRef.current = onLanguageLoaded;

    useEffect(() => {
        if (!DB_ENABLED) return;
        if (hasSynced || calledRef.current) return;
        calledRef.current = true;
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const clearRetryTimer = () => {
            if (!retryTimer) return;
            clearTimeout(retryTimer);
            retryTimer = null;
        };

        const runBootstrap = async (): Promise<boolean> => {
            if (hasSynced) return true;
            if (syncInFlightPromise) return syncInFlightPromise;
            syncInFlightPromise = (async () => {
                try {
                    const db = await loadDbService();
                    const sessionUserId = await db.ensureExistingDbSession();
                    if (!sessionUserId) {
                        return false;
                    }
                    await db.uploadLocalTripsToDb();
                    await db.syncTripsFromDb();
                    const settings = await db.dbGetUserSettings();
                    if (settings) {
                        db.applyUserSettingsToLocalStorage(settings);
                        if (settings.language && onLanguageLoadedRef.current) {
                            onLanguageLoadedRef.current(settings.language);
                        }
                    }
                    hasSynced = true;
                    return true;
                } catch (error) {
                    console.warn('DB bootstrap sync failed', error);
                    return false;
                } finally {
                    syncInFlightPromise = null;
                }
            })();

            return syncInFlightPromise;
        };

        const scheduleRetry = () => {
            if (cancelled || hasSynced) return;
            clearRetryTimer();
            retryTimer = setTimeout(() => {
                void attemptSync();
            }, DB_SYNC_RETRY_INTERVAL_MS);
        };

        const attemptSync = async () => {
            if (cancelled || hasSynced) return;
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                scheduleRetry();
                return;
            }
            const didSync = await runBootstrap();
            if (!didSync && !cancelled) {
                scheduleRetry();
            }
        };

        const handleOnline = () => {
            clearRetryTimer();
            void attemptSync();
        };

        void attemptSync();
        window.addEventListener('online', handleOnline);

        return () => {
            cancelled = true;
            clearRetryTimer();
            window.removeEventListener('online', handleOnline);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
};

export const __resetUseDbSyncStateForTests = (): void => {
    hasSynced = false;
    syncInFlightPromise = null;
    dbServicePromise = null;
};
