// Public entry point for the Supabase data layer. The implementation lives in
// services/db/*; keep importing from here (or lazily via services/dbApi.ts) so
// the db chunk stays behind its dynamic-import boundary.
export {
    DB_ENABLED,
} from './db/internal';
export {
    ensureExistingDbSession,
    ensureDbSession,
    dbGetAccessToken,
    isSimulatedLoggedIn,
    setSimulatedLoggedIn,
    toggleSimulatedLogin,
} from './db/session';
export {
    type DbTripAccessSource,
    type DbTripAccessMetadata,
    type DbTripResult,
    type DbAdminOverrideCommitResult,
    __shouldUploadLocalTripSnapshot,
    dbUpsertTrip,
    type DbUpsertTripResult,
    dbUpsertTripWithStatus,
    dbGetTrip,
    dbGetTripVersion,
    dbCreateTripVersion,
    dbAdminOverrideTripCommit,
    dbListTrips,
    uploadLocalTripsToDb,
    syncTripsFromDb,
    type DbArchiveTripOptions,
    dbArchiveTrip,
    dbDeleteTrip,
    dbCanCreateTrip,
} from './db/trips';
export {
    dbCreateShareLink,
    dbUpdateTripShareViewSettings,
    dbGetSharedTrip,
    dbGetSharedTripVersion,
    dbUpdateSharedTrip,
    dbListTripShares,
    dbSetTripSharingEnabled,
    dbRevokeTripShares,
} from './db/shares';
export {
    type DbAnonymousAssetClaimResult,
    type DbClaimAnonymousAssetsResult,
    dbCreateAnonymousAssetClaim,
    dbClaimAnonymousAssets,
    dbExpireStaleAnonymousAssetClaims,
} from './db/assetClaims';
export {
    dbGetUserSettings,
    dbUpsertUserSettings,
    applyUserSettingsToLocalStorage,
} from './db/userSettings';
export {
    dbFindNearestCommercialAirports,
} from './db/airports';
