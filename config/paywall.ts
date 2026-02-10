import { ITrip, ITimelineItem } from '../types';
import { isTripExpiredByTimestamp } from './productLimits';

export type TripLifecycleState = 'active' | 'expired' | 'archived';
export const TRIP_EXPIRY_DEBUG_EVENT = 'tf:trip-expiry-debug-updated';

const DEBUG_EXPIRED_OVERRIDES_STORAGE_KEY = 'tf_debug_trip_expired_overrides_v1';

type TripExpiryOverrides = Record<string, boolean>;

interface LifecycleOptions {
    nowMs?: number;
    expiredOverride?: boolean | null;
}

interface PaywallOptions extends LifecycleOptions {
    lifecycleState?: TripLifecycleState;
}

const PAYWALL_LOCATION_LABEL = 'Location hidden';

const ORDINAL_DESTINATION_LABELS = [
    'First destination',
    'Second destination',
    'Third destination',
    'Fourth destination',
    'Fifth destination',
    'Sixth destination',
    'Seventh destination',
    'Eighth destination',
    'Ninth destination',
    'Tenth destination',
    'Eleventh destination',
    'Twelfth destination',
] as const;

const toOrdinalSuffix = (value: number): string => {
    const v = Math.abs(Math.trunc(value));
    const mod100 = v % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
    const mod10 = v % 10;
    if (mod10 === 1) return `${v}st`;
    if (mod10 === 2) return `${v}nd`;
    if (mod10 === 3) return `${v}rd`;
    return `${v}th`;
};

const getPaywalledDestinationLabel = (cityIndex: number): string =>
    ORDINAL_DESTINATION_LABELS[cityIndex] ?? `${toOrdinalSuffix(cityIndex + 1)} destination`;

const maskTripItemForPaywall = (item: ITimelineItem, cityIndexByItemId: Map<string, number>): ITimelineItem => {
    if (item.type === 'city') {
        const cityIndex = cityIndexByItemId.get(item.id) ?? 0;
        const maskedLabel = getPaywalledDestinationLabel(cityIndex);
        return {
            ...item,
            title: maskedLabel,
            location: maskedLabel,
            description: '',
            countryCode: undefined,
            countryName: undefined,
            hotels: [],
        };
    }

    if (item.location) {
        return {
            ...item,
            location: PAYWALL_LOCATION_LABEL,
        };
    }

    return item;
};

const readDebugTripExpiryOverrides = (): TripExpiryOverrides => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(DEBUG_EXPIRED_OVERRIDES_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        const normalized: TripExpiryOverrides = {};
        Object.entries(parsed as Record<string, unknown>).forEach(([tripId, value]) => {
            if (typeof value === 'boolean') {
                normalized[tripId] = value;
            }
        });
        return normalized;
    } catch {
        return {};
    }
};

const writeDebugTripExpiryOverrides = (overrides: TripExpiryOverrides) => {
    if (typeof window === 'undefined') return;
    try {
        if (Object.keys(overrides).length === 0) {
            window.localStorage.removeItem(DEBUG_EXPIRED_OVERRIDES_STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(DEBUG_EXPIRED_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
        // ignore storage issues
    }
};

export const getDebugTripExpiredOverride = (tripId: string): boolean | null => {
    if (!tripId) return null;
    const overrides = readDebugTripExpiryOverrides();
    return Object.prototype.hasOwnProperty.call(overrides, tripId) ? overrides[tripId] : null;
};

export const setDebugTripExpiredOverride = (tripId: string, value: boolean | null): void => {
    if (!tripId) return;
    const overrides = readDebugTripExpiryOverrides();
    if (typeof value === 'boolean') {
        overrides[tripId] = value;
    } else {
        delete overrides[tripId];
    }
    writeDebugTripExpiryOverrides(overrides);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TRIP_EXPIRY_DEBUG_EVENT, {
            detail: { tripId, expired: typeof value === 'boolean' ? value : null },
        }));
    }
};

export const getTripLifecycleState = (
    trip: ITrip,
    options: LifecycleOptions = {}
): TripLifecycleState => {
    if (trip.status === 'archived') return 'archived';

    const resolvedExpiredOverride = typeof options.expiredOverride === 'boolean'
        ? options.expiredOverride
        : getDebugTripExpiredOverride(trip.id);
    const resolvedExpired = typeof resolvedExpiredOverride === 'boolean'
        ? resolvedExpiredOverride
        : trip.status === 'expired' || isTripExpiredByTimestamp(trip.tripExpiresAt, options.nowMs);

    return resolvedExpired ? 'expired' : 'active';
};

export const shouldShowTripPaywall = (
    trip: ITrip,
    options: PaywallOptions = {}
): boolean => {
    if (trip.isExample) return false;

    const lifecycle = options.lifecycleState ?? getTripLifecycleState(trip, options);
    return lifecycle === 'expired';
};

export const buildPaywalledTripDisplay = (trip: ITrip): ITrip => {
    const cityIndexByItemId = new Map<string, number>();
    let cityCounter = 0;
    trip.items
        .filter((item) => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset)
        .forEach((city) => {
            cityIndexByItemId.set(city.id, cityCounter);
            cityCounter += 1;
        });

    return {
        ...trip,
        countryInfo: undefined,
        items: trip.items.map((item) => maskTripItemForPaywall(item, cityIndexByItemId)),
    };
};
