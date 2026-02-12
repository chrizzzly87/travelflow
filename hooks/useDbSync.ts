import { useEffect, useRef } from 'react';
import { DB_ENABLED } from '../config/db';
import { AppLanguage } from '../types';

/** Has the DB sync already run in this session? */
let hasSynced = false;

type DbServiceModule = typeof import('../services/dbService');
let dbServicePromise: Promise<DbServiceModule> | null = null;

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

    useEffect(() => {
        if (!DB_ENABLED) return;
        if (hasSynced || calledRef.current) return;
        calledRef.current = true;
        hasSynced = true;

        let cancelled = false;

        const init = async () => {
            const db = await loadDbService();
            await db.ensureDbSession();
            await db.uploadLocalTripsToDb();
            await db.syncTripsFromDb();
            const settings = await db.dbGetUserSettings();
            if (!cancelled && settings) {
                db.applyUserSettingsToLocalStorage(settings);
                if (settings.language && onLanguageLoaded) {
                    onLanguageLoaded(settings.language);
                }
            }
        };

        void init();

        return () => {
            cancelled = true;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
