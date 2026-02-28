import { DB_ENABLED } from '../config/db';

type DbServiceModule = typeof import('./dbService');

export type DbTripAccess = NonNullable<Awaited<ReturnType<DbServiceModule['dbGetTrip']>>>['access'];
export type DbTripAccessMetadata = DbTripAccess;

let dbServicePromise: Promise<DbServiceModule> | null = null;

const loadDbService = async (): Promise<DbServiceModule> => {
    if (!dbServicePromise) {
        dbServicePromise = import('./dbService');
    }
    return dbServicePromise;
};

export const ensureDbSession = async () => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.ensureDbSession();
};

export const dbCanCreateTrip = async () => {
    if (!DB_ENABLED) {
        return {
            allowCreate: true,
            activeTripCount: 0,
            maxTripCount: 0,
        };
    }
    const db = await loadDbService();
    return db.dbCanCreateTrip();
};

export const dbCreateTripVersion = async (...args: Parameters<DbServiceModule['dbCreateTripVersion']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbCreateTripVersion(...args);
};

export const dbGetSharedTrip = async (...args: Parameters<DbServiceModule['dbGetSharedTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetSharedTrip(...args);
};

export const dbGetSharedTripVersion = async (...args: Parameters<DbServiceModule['dbGetSharedTripVersion']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetSharedTripVersion(...args);
};

export const dbGetTrip = async (...args: Parameters<DbServiceModule['dbGetTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetTrip(...args);
};

export const dbAdminOverrideTripCommit = async (...args: Parameters<DbServiceModule['dbAdminOverrideTripCommit']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbAdminOverrideTripCommit(...args);
};

export const dbGetTripVersion = async (...args: Parameters<DbServiceModule['dbGetTripVersion']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetTripVersion(...args);
};

export const dbUpdateSharedTrip = async (...args: Parameters<DbServiceModule['dbUpdateSharedTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbUpdateSharedTrip(...args);
};

export const dbUpsertTrip = async (...args: Parameters<DbServiceModule['dbUpsertTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbUpsertTrip(...args);
};

export const dbArchiveTrip = async (...args: Parameters<DbServiceModule['dbArchiveTrip']>) => {
    if (!DB_ENABLED) return true;
    const db = await loadDbService();
    return db.dbArchiveTrip(...args);
};

export const dbUpsertUserSettings = async (...args: Parameters<DbServiceModule['dbUpsertUserSettings']>) => {
    if (!DB_ENABLED) return;
    const db = await loadDbService();
    await db.dbUpsertUserSettings(...args);
};

export const dbCreateShareLink = async (...args: Parameters<DbServiceModule['dbCreateShareLink']>) => {
    if (!DB_ENABLED) {
        return { error: 'db-disabled' };
    }
    const db = await loadDbService();
    return db.dbCreateShareLink(...args);
};

export const dbListTripShares = async (...args: Parameters<DbServiceModule['dbListTripShares']>) => {
    if (!DB_ENABLED) return [];
    const db = await loadDbService();
    return db.dbListTripShares(...args);
};

export const dbSetTripSharingEnabled = async (...args: Parameters<DbServiceModule['dbSetTripSharingEnabled']>) => {
    if (!DB_ENABLED) return false;
    const db = await loadDbService();
    return db.dbSetTripSharingEnabled(...args);
};

export const dbRevokeTripShares = async (...args: Parameters<DbServiceModule['dbRevokeTripShares']>) => {
    if (!DB_ENABLED) return 0;
    const db = await loadDbService();
    return db.dbRevokeTripShares(...args);
};
