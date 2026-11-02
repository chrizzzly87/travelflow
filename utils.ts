// Barrel for the app-wide helpers. The code lives in focused modules; this file
// only re-exports them so existing `./utils` imports keep working.
// Pure, edge-safe helpers live in `shared/` (Netlify edge functions import it);
// browser-only or app-coupled helpers live in `utils/`.

export * from './shared/appLanguage';
export * from './utils/appLanguageStorage';
export * from './utils/googleMapsApiKey';
export * from './shared/tripUrls';
export * from './shared/distance';
export * from './shared/dateMath';
export * from './utils/timelineLayout';
export * from './utils/tripCompression';
export * from './shared/cityColors';
export * from './utils/internalMapColorMode';
export * from './shared/countries';

// The activity taxonomy is shared with the edge runtime; see shared/activityTypes.ts.
export {
    ALL_ACTIVITY_TYPES,
    ACTIVITY_TYPE_COLORS,
    normalizeActivityTypes,
    pickPrimaryActivityType,
    getActivityColorByTypes,
} from './shared/activityTypes';

export { buildRouteCacheKey } from './shared/routeCacheKey';
