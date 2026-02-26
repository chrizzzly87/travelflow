import { useEffect, useRef } from 'react';
import { DB_ENABLED } from '../config/db';
import { AppLanguage } from '../types';
import { getConnectivitySnapshot, subscribeConnectivityStatus } from '../services/supabaseHealthMonitor';

/** Has the DB bootstrap already run in this session? */
let hasBootstrapped = false;
let initialBootstrapPromise: Promise<void> | null = null;
let recoverySyncPromise: Promise<void> | null = null;

type DbServiceModule = typeof import('../services/dbService');
let dbServicePromise: Promise<DbServiceModule> | null = null;

const loadDbService = async (): Promise<DbServiceModule> => {
    if (!dbServicePromise) {
        dbServicePromise = import('../services/dbService');
    }
    return dbServicePromise;
};

const runInitialBootstrap = async (onLanguageLoaded?: (lang: AppLanguage) => void) => {
    if (initialBootstrapPromise) return initialBootstrapPromise;

    initialBootstrapPromise = (async () => {
        const db = await loadDbService();
        await db.ensureDbSession();
        await db.uploadLocalTripsToDb();
        await db.syncTripsFromDb();
        const settings = await db.dbGetUserSettings();
        if (settings) {
            db.applyUserSettingsToLocalStorage(settings);
            if (settings.language && onLanguageLoaded) {
                onLanguageLoaded(settings.language);
            }
        }
        hasBootstrapped = true;
    })().finally(() => {
        initialBootstrapPromise = null;
    });

    return initialBootstrapPromise;
};

const runRecoverySync = async () => {
    if (recoverySyncPromise) return recoverySyncPromise;

    recoverySyncPromise = (async () => {
        const db = await loadDbService();
        await db.ensureDbSession();
        await db.uploadLocalTripsToDb();
        await db.syncTripsFromDb();
    })().finally(() => {
        recoverySyncPromise = null;
    });

    return recoverySyncPromise;
};

/**
 * Runs DB bootstrap once, then performs reconnect recovery sync whenever
 * connectivity transitions back to online during the same session.
 */
export const useDbSync = (onLanguageLoaded?: (lang: AppLanguage) => void) => {
    const calledRef = useRef(false);
    const previousConnectivityStateRef = useRef(getConnectivitySnapshot().state);

    useEffect(() => {
        if (!DB_ENABLED) return;
        if (!hasBootstrapped && !calledRef.current) {
            calledRef.current = true;
            void runInitialBootstrap(onLanguageLoaded);
        }

        const unsubscribe = subscribeConnectivityStatus((snapshot) => {
            const previous = previousConnectivityStateRef.current;
            previousConnectivityStateRef.current = snapshot.state;
            if (!hasBootstrapped) return;
            if (previous !== 'online' && snapshot.state === 'online') {
                void runRecoverySync();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [onLanguageLoaded]);
};
