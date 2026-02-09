import { useEffect, useRef } from 'react';
import {
    DB_ENABLED,
    applyUserSettingsToLocalStorage,
    dbGetUserSettings,
    ensureDbSession,
    syncTripsFromDb,
    uploadLocalTripsToDb,
} from '../services/dbService';
import { AppLanguage } from '../types';

/** Has the DB sync already run in this session? */
let hasSynced = false;

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
            await ensureDbSession();
            await uploadLocalTripsToDb();
            await syncTripsFromDb();
            const settings = await dbGetUserSettings();
            if (!cancelled && settings) {
                applyUserSettingsToLocalStorage(settings);
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
