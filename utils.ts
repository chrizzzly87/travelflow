import LZString from 'lz-string';
import { ActivityType, AppLanguage, ICoordinates, ITrip, ITimelineItem, IViewSettings, ISharedState, MapColorMode, TransportMode, TripPrefillData } from './types';
import { normalizeTransportMode } from './shared/transportModes';
import { DEFAULT_LOCALE, localeToIntlLocale, normalizeLocale } from './config/locales';

export const BASE_PIXELS_PER_DAY = 120; // Width of one day column (Base Zoom 1.0)
export const PIXELS_PER_DAY = BASE_PIXELS_PER_DAY; // Deprecated: Use prop passed from parent for zooming

// --- API KEY MANAGEMENT ---

// --- API KEY MANAGEMENT ---
export const getGeminiApiKey = (): string => {
   return import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const getGoogleMapsApiKey = (): string => {
   return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
};

export const getApiKey = (): string => {
   return getGeminiApiKey(); // Backwards compatibility for now, but should be replaced
};

export const APP_LANGUAGE_STORAGE_KEY = 'tf_app_language';
export const DEFAULT_APP_LANGUAGE: AppLanguage = DEFAULT_LOCALE;

export const generateTripId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const generateVersionId = (): string => {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildTripUrl = (tripId: string, versionId?: string | null): string => {
    const base = `/trip/${encodeURIComponent(tripId)}`;
    if (!versionId) return base;
    const params = new URLSearchParams();
    params.set('v', versionId);
    return `${base}?${params.toString()}`;
};

export const buildShareUrl = (token: string, versionId?: string | null): string => {
    const base = `/s/${encodeURIComponent(token)}`;
    if (!versionId) return base;
    const params = new URLSearchParams();
    params.set('v', versionId);
    return `${base}?${params.toString()}`;
};

const isLayoutMode = (value: string | null): value is IViewSettings['layoutMode'] =>
    value === 'vertical' || value === 'horizontal';

const isTimelineViewMode = (value: string | null): value is IViewSettings['timelineView'] =>
    value === 'vertical' || value === 'horizontal';

const isMapStyleValue = (value: string | null): value is IViewSettings['mapStyle'] =>
    value === 'minimal' || value === 'standard' || value === 'dark' || value === 'satellite' || value === 'clean';

const isRouteModeValue = (value: string | null): value is NonNullable<IViewSettings['routeMode']> =>
    value === 'simple' || value === 'realistic';

export const applyViewSettingsToSearchParams = (
    params: URLSearchParams,
    view?: Partial<IViewSettings> | null
): void => {
    if (!view) return;

    if (isLayoutMode(view.layoutMode ?? null)) params.set('layout', view.layoutMode);
    if (isTimelineViewMode(view.timelineView ?? null)) params.set('timelineView', view.timelineView);
    if (isMapStyleValue(view.mapStyle ?? null)) params.set('mapStyle', view.mapStyle);

    if (isRouteModeValue(view.routeMode ?? null)) params.set('routeMode', view.routeMode);
    else params.delete('routeMode');

    if (typeof view.showCityNames === 'boolean') params.set('cityNames', view.showCityNames ? '1' : '0');
    else params.delete('cityNames');

    if (typeof view.zoomLevel === 'number' && Number.isFinite(view.zoomLevel)) params.set('zoom', view.zoomLevel.toFixed(2));
    else params.delete('zoom');

    if (typeof view.sidebarWidth === 'number' && Number.isFinite(view.sidebarWidth)) params.set('sidebarWidth', String(Math.round(view.sidebarWidth)));
    else params.delete('sidebarWidth');

    if (typeof view.timelineHeight === 'number' && Number.isFinite(view.timelineHeight)) params.set('timelineHeight', String(Math.round(view.timelineHeight)));
    else params.delete('timelineHeight');
};

export const isUuid = (value?: string | null): boolean => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export const normalizeAppLanguage = (value?: string | null): AppLanguage => {
    return normalizeLocale(value);
};

export const getStoredAppLanguage = (): AppLanguage => {
    if (typeof window === 'undefined') return DEFAULT_APP_LANGUAGE;
    return normalizeAppLanguage(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
};

export const setStoredAppLanguage = (language: AppLanguage): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, normalizeAppLanguage(language));
};

export const getIntlLocaleForAppLanguage = (language: AppLanguage): string => {
    return localeToIntlLocale(normalizeAppLanguage(language));
};

// --- HELPERS ---

export type DistanceUnit = 'km' | 'mi';
export const DEFAULT_DISTANCE_UNIT: DistanceUnit = 'km';
const KM_PER_MILE = 1.60934;

export const convertDistance = (distanceKm: number, unit: DistanceUnit): number => {
    return unit === 'mi' ? distanceKm / KM_PER_MILE : distanceKm;
};

export const formatDistance = (
    distanceKm: number | null | undefined,
    unit: DistanceUnit = DEFAULT_DISTANCE_UNIT,
    options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {}
): string | null => {
    if (!Number.isFinite(distanceKm)) return null;
    const value = convertDistance(distanceKm as number, unit);
    const { maximumFractionDigits = value >= 10 ? 0 : 1, minimumFractionDigits = 0 } = options;
    const formatted = value.toLocaleString(undefined, { maximumFractionDigits, minimumFractionDigits });
    return `${formatted} ${unit}`;
};

export const getDistanceKm = (from: ICoordinates, to: ICoordinates): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const earthRadiusKm = 6371;
    return earthRadiusKm * c;
};

const TRAVEL_SPEEDS_KMPH: Record<TransportMode, number> = {
    walk: 4.5,
    bicycle: 16,
    motorcycle: 60,
    car: 80,
    bus: 60,
    train: 120,
    boat: 35,
    plane: 750,
    na: 0,
};

const TRAVEL_OVERHEAD_HOURS: Partial<Record<TransportMode, number>> = {
    plane: 2,
    train: 0.5,
    bus: 0.3,
    boat: 0.5,
    car: 0.2,
    motorcycle: 0.2,
};

export const estimateTravelHours = (distanceKm: number, mode?: TransportMode | string): number | null => {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
    const normalizedMode = normalizeTransportMode(mode);
    if (normalizedMode === 'na') return null;
    const speed = TRAVEL_SPEEDS_KMPH[normalizedMode];
    if (!speed) return null;
    const base = distanceKm / speed;
    const overhead = TRAVEL_OVERHEAD_HOURS[normalizedMode] ?? 0;
    return Math.max(0.1, base + overhead);
};

export const formatDurationHours = (hours: number | null | undefined): string | null => {
    if (!Number.isFinite(hours)) return null;
    const totalMinutes = Math.max(1, Math.round((hours as number) * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

export const formatDate = (date: Date, language: AppLanguage = DEFAULT_APP_LANGUAGE): string => {
  return date.toLocaleDateString(getIntlLocaleForAppLanguage(language), { month: 'short', day: 'numeric', weekday: 'short' });
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDaysDifference = (start: string, end: string): number => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
};

export const getTripDuration = (items: any[]): number => {
  if (items.length === 0) return 14; // Default view
  let maxEnd = 0;
  items.forEach(item => {
    const end = item.startDateOffset + item.duration;
    if (end > maxEnd) maxEnd = end;
  });
  return Math.max(maxEnd + 2, 10); // Add some buffer
};

export interface TimelineBounds {
    startOffset: number;
    endOffset: number;
    dayCount: number;
}

export interface CityOverlapLayoutSlot {
    stackIndex: number;
    stackCount: number;
}

export const getTimelineBounds = (
    items: ITimelineItem[],
    options: { minDays?: number } = {}
): TimelineBounds => {
    const minDays = Math.max(1, Math.floor(options.minDays ?? 1));
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;

    items.forEach(item => {
        if (!Number.isFinite(item.startDateOffset) || !Number.isFinite(item.duration)) return;
        minStart = Math.min(minStart, item.startDateOffset);
        maxEnd = Math.max(maxEnd, item.startDateOffset + Math.max(item.duration, 0));
    });

    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
        return {
            startOffset: 0,
            endOffset: minDays,
            dayCount: minDays,
        };
    }

    const startOffset = Math.floor(minStart);
    const endOffset = Math.max(startOffset + minDays, Math.ceil(maxEnd));

    return {
        startOffset,
        endOffset,
        dayCount: endOffset - startOffset,
    };
};

const CITY_OVERLAP_EPSILON = 0.0001;

export const buildCityOverlapLayout = (
    cityItems: ITimelineItem[]
): Map<string, CityOverlapLayoutSlot> => {
    const layout = new Map<string, CityOverlapLayoutSlot>();
    if (!Array.isArray(cityItems) || cityItems.length === 0) return layout;

    const sortedCities = [...cityItems]
        .filter((item) => item.type === 'city')
        .sort((a, b) => {
            if (a.startDateOffset === b.startDateOffset) {
                return b.duration - a.duration;
            }
            return a.startDateOffset - b.startDateOffset;
        });

    if (sortedCities.length === 0) return layout;

    const laneEnds: number[] = [];
    const laneByCityId = new Map<string, number>();
    const componentByCityId = new Map<string, number>();
    const componentLaneCount = new Map<number, number>();

    let currentComponentId = 0;
    let currentComponentMaxEnd = Number.NEGATIVE_INFINITY;

    sortedCities.forEach((city) => {
        const start = city.startDateOffset;
        const end = city.startDateOffset + Math.max(0, city.duration);

        const startsNewComponent = start >= (currentComponentMaxEnd - CITY_OVERLAP_EPSILON);
        if (startsNewComponent) {
            currentComponentId += 1;
            currentComponentMaxEnd = end;
            laneEnds.length = 0;
        } else {
            currentComponentMaxEnd = Math.max(currentComponentMaxEnd, end);
        }

        let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= (start + CITY_OVERLAP_EPSILON));
        if (laneIndex < 0) {
            laneIndex = laneEnds.length;
            laneEnds.push(end);
        } else {
            laneEnds[laneIndex] = end;
        }

        laneByCityId.set(city.id, laneIndex);
        componentByCityId.set(city.id, currentComponentId);
        componentLaneCount.set(
            currentComponentId,
            Math.max(componentLaneCount.get(currentComponentId) || 1, laneIndex + 1)
        );
    });

    sortedCities.forEach((city) => {
        const componentId = componentByCityId.get(city.id) || 1;
        layout.set(city.id, {
            stackIndex: laneByCityId.get(city.id) || 0,
            stackCount: componentLaneCount.get(componentId) || 1,
        });
    });

    return layout;
};

export const findTravelBetweenCities = (
    items: ITimelineItem[],
    fromCity: ITimelineItem,
    toCity: ITimelineItem
): ITimelineItem | null => {
    const fromEnd = fromCity.startDateOffset + fromCity.duration;
    const toStart = toCity.startDateOffset;
    const windowStart = Math.min(fromEnd, toStart) - 0.6;
    const windowEnd = Math.max(fromEnd, toStart) + 0.6;

    const candidates = items.filter(i =>
        (i.type === 'travel' || i.type === 'travel-empty') &&
        i.startDateOffset >= windowStart &&
        i.startDateOffset <= windowEnd
    );

    if (candidates.length === 0) return null;

    return candidates.sort((a, b) =>
        Math.abs(a.startDateOffset - fromEnd) - Math.abs(b.startDateOffset - fromEnd)
    )[0];
};

export interface TravelLegMetrics {
    travelItem: ITimelineItem;
    fromCity: ITimelineItem;
    toCity: ITimelineItem;
    distanceKm: number | null;
}

export const getTravelLegMetrics = (items: ITimelineItem[]): TravelLegMetrics[] => {
    const cities = items
        .filter(item => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);

    const legs: TravelLegMetrics[] = [];
    for (let i = 0; i < cities.length - 1; i++) {
        const fromCity = cities[i];
        const toCity = cities[i + 1];
        const travelItem = findTravelBetweenCities(items, fromCity, toCity);
        if (!travelItem) continue;
        const distanceKm = fromCity.coordinates && toCity.coordinates
            ? getDistanceKm(fromCity.coordinates, toCity.coordinates)
            : null;
        legs.push({ travelItem, fromCity, toCity, distanceKm });
    }

    return legs;
};

export const getTravelLegMetricsForItem = (
    items: ITimelineItem[],
    travelItemId: string
): TravelLegMetrics | null => {
    const legs = getTravelLegMetrics(items);
    return legs.find(leg => leg.travelItem.id === travelItemId) || null;
};

export const getTripDistanceKm = (items: ITimelineItem[]): number => {
    return getTravelLegMetrics(items)
        .map((leg) => {
            const airDistance = leg.distanceKm;
            if (!Number.isFinite(airDistance)) return null;

            const mode = normalizeTransportMode(leg.travelItem.transportMode);
            const routeDistance = leg.travelItem.routeDistanceKm;

            if (mode === 'plane') return airDistance;
            if (Number.isFinite(routeDistance)) return routeDistance as number;
            return airDistance;
        })
        .filter((distance): distance is number => Number.isFinite(distance))
        .reduce((sum, distance) => sum + distance, 0);
};

const isTravelItem = (item: ITimelineItem): boolean =>
    item.type === 'travel' || item.type === 'travel-empty';

const cityPairKey = (fromId: string, toId: string): string => `${fromId}->${toId}`;

export const reorderSelectedCities = (
    items: ITimelineItem[],
    selectedCityIds: string[],
    desiredSelectedOrder: string[]
): ITimelineItem[] => {
    const cityItems = items
        .filter(item => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);

    if (cityItems.length < 2) return items;

    const selectedSet = new Set(selectedCityIds);
    if (selectedSet.size < 2) return items;

    const selectedInTimeline = cityItems.filter(city => selectedSet.has(city.id));
    if (selectedInTimeline.length < 2) return items;

    const normalizedDesiredOrder = desiredSelectedOrder.filter(id => selectedSet.has(id));
    const desiredSet = new Set(normalizedDesiredOrder);
    if (
        normalizedDesiredOrder.length !== selectedInTimeline.length ||
        desiredSet.size !== selectedInTimeline.length ||
        selectedInTimeline.some(city => !desiredSet.has(city.id))
    ) {
        return items;
    }

    const unchanged = selectedInTimeline.every((city, index) => city.id === normalizedDesiredOrder[index]);
    if (unchanged) return items;

    const cityById = new Map(cityItems.map(city => [city.id, city]));
    const oldStartByCityId = new Map(cityItems.map(city => [city.id, city.startDateOffset]));

    const replacementQueue = [...normalizedDesiredOrder];
    const reorderedCitySequence: ITimelineItem[] = cityItems.map(city => {
        if (!selectedSet.has(city.id)) return city;
        const replacementId = replacementQueue.shift();
        if (!replacementId) return city;
        return cityById.get(replacementId) || city;
    });

    const newStartByCityId = new Map<string, number>();
    let cursor = 0;
    reorderedCitySequence.forEach(city => {
        newStartByCityId.set(city.id, cursor);
        cursor += city.duration;
    });

    const cityOwnerForOffset = (offset: number): string | null => {
        const epsilon = 0.00001;
        for (const city of cityItems) {
            const start = city.startDateOffset;
            const end = city.startDateOffset + city.duration;
            if (offset >= (start - epsilon) && offset < (end - epsilon)) {
                return city.id;
            }
        }
        return null;
    };

    const updatedNonTravelItems = items
        .filter(item => !isTravelItem(item))
        .map(item => {
            if (item.type === 'city') {
                const newStart = newStartByCityId.get(item.id);
                if (newStart === undefined) return item;
                return { ...item, startDateOffset: newStart };
            }

            if (item.type === 'activity') {
                const ownerCityId = cityOwnerForOffset(item.startDateOffset);
                if (!ownerCityId) return item;
                const oldStart = oldStartByCityId.get(ownerCityId);
                const newStart = newStartByCityId.get(ownerCityId);
                if (oldStart === undefined || newStart === undefined) return item;
                const delta = newStart - oldStart;
                if (Math.abs(delta) < 0.000001) return item;
                return { ...item, startDateOffset: Math.max(0, item.startDateOffset + delta) };
            }

            return item;
        });

    const oldBoundaries = cityItems.slice(0, -1).map((fromCity, index) => {
        const toCity = cityItems[index + 1];
        const key = cityPairKey(fromCity.id, toCity.id);
        const travel = findTravelBetweenCities(items, fromCity, toCity);
        return { key, travel };
    });

    const oldPairSet = new Set(oldBoundaries.map(boundary => boundary.key));
    const oldPairTravel = new Map<string, ITimelineItem>();
    oldBoundaries.forEach(boundary => {
        if (boundary.travel && !oldPairTravel.has(boundary.key)) {
            oldPairTravel.set(boundary.key, boundary.travel);
        }
    });

    const oldBoundaryTravels = oldBoundaries
        .map(boundary => boundary.travel)
        .filter((travel): travel is ITimelineItem => !!travel);
    const oldLinkedTravelIds = new Set(oldBoundaryTravels.map(travel => travel.id));
    const nonBoundaryTravelItems = items
        .filter(isTravelItem)
        .filter(item => !oldLinkedTravelIds.has(item.id))
        .map(item => ({ ...item }));

    const usedTravelIds = new Set<string>();
    const takeTravelSource = (pairKey: string, index: number): ITimelineItem | null => {
        const exactMatch = oldPairTravel.get(pairKey);
        if (exactMatch && !usedTravelIds.has(exactMatch.id)) {
            usedTravelIds.add(exactMatch.id);
            return exactMatch;
        }

        const indexed = oldBoundaries[index]?.travel;
        if (indexed && !usedTravelIds.has(indexed.id)) {
            usedTravelIds.add(indexed.id);
            return indexed;
        }

        const fallback = oldBoundaryTravels.find(travel => !usedTravelIds.has(travel.id));
        if (fallback) {
            usedTravelIds.add(fallback.id);
            return fallback;
        }

        return null;
    };

    const rebuiltBoundaryTravelItems: ITimelineItem[] = [];
    for (let index = 0; index < reorderedCitySequence.length - 1; index++) {
        const fromCity = reorderedCitySequence[index];
        const toCity = reorderedCitySequence[index + 1];
        const pairKey = cityPairKey(fromCity.id, toCity.id);
        const sourceTravel = takeTravelSource(pairKey, index);
        const fromStart = newStartByCityId.get(fromCity.id) ?? fromCity.startDateOffset;
        const boundaryStart = fromStart + fromCity.duration;
        const isChangedAdjacency = !oldPairSet.has(pairKey);

        if (sourceTravel) {
            const rebuilt = {
                ...sourceTravel,
                startDateOffset: boundaryStart,
                duration: Math.max(0.05, sourceTravel.duration || 0.2),
            };

            if (isChangedAdjacency) {
                rebuilt.type = 'travel-empty';
                rebuilt.transportMode = 'na';
                rebuilt.color = TRAVEL_EMPTY_COLOR;
                rebuilt.title = `Travel to ${toCity.title}`;
                rebuilt.description = 'Transport not set';
            } else if (rebuilt.type === 'travel-empty') {
                rebuilt.transportMode = 'na';
                rebuilt.color = TRAVEL_EMPTY_COLOR;
                rebuilt.title = `Travel to ${toCity.title}`;
                rebuilt.description = rebuilt.description || 'Transport not set';
            }

            rebuiltBoundaryTravelItems.push(rebuilt);
            continue;
        }

        rebuiltBoundaryTravelItems.push({
            id: `travel-relinked-${Date.now()}-${index}`,
            type: 'travel-empty',
            title: `Travel to ${toCity.title}`,
            startDateOffset: boundaryStart,
            duration: 0.2,
            color: TRAVEL_EMPTY_COLOR,
            description: 'Transport not set',
            transportMode: 'na',
        });
    }

    return [...updatedNonTravelItems, ...nonBoundaryTravelItems, ...rebuiltBoundaryTravelItems];
};

export const getDefaultTripDates = () => {
    const today = new Date();
    // 3 months in future
    const target = new Date(today.getFullYear(), today.getMonth() + 3, 1);
    
    // Find next Friday (0=Sun, 5=Fri)
    const day = target.getDay();
    const diff = (5 - day + 7) % 7;
    target.setDate(target.getDate() + diff);
    
    const start = target;
    const end = new Date(start);
    // "Two weeks long, Friday until Saturday" implies ~15/16 days (3 weekends)
    end.setDate(start.getDate() + 15); 
    
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
};

// --- Dynamic Title Generation ---
export const generateTripTitle = (trip: ITrip): string => {
    const cities = trip.items.filter(i => i.type === 'city');
    if (cities.length === 0) return "New Trip";

    const baseTitle = trip.title.split('(')[0].trim();
    
    const start = new Date(trip.startDate);
    const end = addDays(start, getTripDuration(trip.items)); // Approx duration
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    
    const monthStr = startMonth === endMonth ? startMonth : `${startMonth}-${endMonth}`;
    const totalDays = Math.ceil(getTripDuration(trip.items));

    // Avoid duplicate suffix
    if (trip.title.includes(`(${monthStr}`)) return trip.title;

    return `${baseTitle} (${monthStr}, ${totalDays} Days)`;
};

// URL State Management
export const compressTripToUrl = (trip: ITrip): string => {
    const json = JSON.stringify(trip);
    return LZString.compressToEncodedURIComponent(json);
};

export const decompressTripFromUrl = (hash: string): ITrip | null => {
    try {
        const json = LZString.decompressFromEncodedURIComponent(hash);
        if (!json) return null;
        return JSON.parse(json);
    } catch (e) {
        console.error("Failed to decompress trip", e);
        return null;
    }
};

// --- COLOR PALETTE DEFINITION ---

export interface ColorDefinition {
    name: string;
    class: string; // Tailwind string
    hex: string;   // Hex code for Map/Canvas
}

export const PRESET_COLORS: ColorDefinition[] = [
    { name: 'Rose', class: 'bg-rose-200 border-rose-300 text-rose-900', hex: '#f43f5e' },
    { name: 'Orange', class: 'bg-orange-200 border-orange-300 text-orange-900', hex: '#f97316' },
    { name: 'Amber', class: 'bg-amber-200 border-amber-300 text-amber-900', hex: '#d97706' },
    { name: 'Emerald', class: 'bg-emerald-200 border-emerald-300 text-emerald-900', hex: '#059669' },
    { name: 'Teal', class: 'bg-teal-200 border-teal-300 text-teal-900', hex: '#0d9488' },
    { name: 'Cyan', class: 'bg-cyan-200 border-cyan-300 text-cyan-900', hex: '#0891b2' },
    { name: 'Sky', class: 'bg-sky-200 border-sky-300 text-sky-900', hex: '#0284c7' },
    { name: 'Indigo', class: 'bg-indigo-200 border-indigo-300 text-indigo-900', hex: '#4f46e5' },
    { name: 'Violet', class: 'bg-violet-200 border-violet-300 text-violet-900', hex: '#7c3aed' },
    { name: 'Fuchsia', class: 'bg-fuchsia-200 border-fuchsia-300 text-fuchsia-900', hex: '#c026d3' },
    { name: 'Slate', class: 'bg-slate-200 border-slate-300 text-slate-900', hex: '#475569' },
    { name: 'Lime', class: 'bg-lime-200 border-lime-300 text-lime-900', hex: '#65a30d' },
];

export const CITY_COLORS = PRESET_COLORS.map(c => c.class);

export type CityColorPaletteId =
    | 'classic'
    | 'pastel'
    | 'vibrant'
    | 'sunset'
    | 'ocean'
    | 'earth'
    | 'nordic'
    | 'blossom';

export interface CityColorPalette {
    id: CityColorPaletteId;
    name: string;
    colors: string[];
}

export const DEFAULT_CITY_COLOR_PALETTE_ID: CityColorPaletteId = 'classic';
export const DEFAULT_MAP_COLOR_MODE: MapColorMode = 'trip';

export const CITY_COLOR_PALETTES: CityColorPalette[] = [
    {
        id: 'classic',
        name: 'Classic',
        colors: PRESET_COLORS.map(color => color.hex),
    },
    {
        id: 'pastel',
        name: 'Pastel',
        colors: ['#f9a8d4', '#fbcfe8', '#fecdd3', '#fde68a', '#a7f3d0', '#bae6fd', '#c7d2fe', '#ddd6fe'],
    },
    {
        id: 'vibrant',
        name: 'Vibrant',
        colors: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#d946ef'],
    },
    {
        id: 'sunset',
        name: 'Sunset',
        colors: ['#fb7185', '#f97316', '#f59e0b', '#facc15', '#fb7185', '#c084fc', '#818cf8', '#38bdf8'],
    },
    {
        id: 'ocean',
        name: 'Ocean',
        colors: ['#0f766e', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#4f46e5', '#38bdf8', '#22d3ee'],
    },
    {
        id: 'earth',
        name: 'Earth',
        colors: ['#92400e', '#b45309', '#ca8a04', '#4d7c0f', '#166534', '#0f766e', '#57534e', '#7c2d12'],
    },
    {
        id: 'nordic',
        name: 'Aurora',
        colors: ['#22d3ee', '#06b6d4', '#0ea5e9', '#38bdf8', '#60a5fa', '#34d399', '#10b981', '#84cc16'],
    },
    {
        id: 'blossom',
        name: 'Blossom',
        colors: ['#f43f5e', '#ec4899', '#f472b6', '#fb7185', '#fda4af', '#e879f9', '#c084fc', '#a78bfa'],
    },
];

const CITY_COLOR_PALETTES_BY_ID = new Map(CITY_COLOR_PALETTES.map((palette) => [palette.id, palette]));

const TAILWIND_BG_HEX_LOOKUP: Record<string, string> = {
    'bg-rose-100': '#ffe4e6',
    'bg-rose-200': '#fecdd3',
    'bg-rose-300': '#fda4af',
    'bg-rose-400': '#fb7185',
    'bg-rose-500': '#f43f5e',
    'bg-pink-100': '#fce7f3',
    'bg-pink-200': '#fbcfe8',
    'bg-pink-300': '#f9a8d4',
    'bg-pink-400': '#f472b6',
    'bg-red-100': '#fee2e2',
    'bg-red-200': '#fecaca',
    'bg-red-300': '#fca5a5',
    'bg-orange-100': '#ffedd5',
    'bg-orange-200': '#fed7aa',
    'bg-orange-300': '#fdba74',
    'bg-amber-100': '#fef3c7',
    'bg-amber-200': '#fde68a',
    'bg-amber-300': '#fcd34d',
    'bg-yellow-100': '#fef9c3',
    'bg-yellow-200': '#fef08a',
    'bg-yellow-300': '#fde047',
    'bg-lime-100': '#ecfccb',
    'bg-lime-200': '#d9f99d',
    'bg-emerald-100': '#d1fae5',
    'bg-emerald-200': '#a7f3d0',
    'bg-green-100': '#dcfce7',
    'bg-green-200': '#bbf7d0',
    'bg-teal-100': '#ccfbf1',
    'bg-teal-200': '#99f6e4',
    'bg-cyan-100': '#cffafe',
    'bg-cyan-200': '#a5f3fc',
    'bg-sky-100': '#e0f2fe',
    'bg-sky-200': '#bae6fd',
    'bg-blue-100': '#dbeafe',
    'bg-blue-200': '#bfdbfe',
    'bg-indigo-100': '#e0e7ff',
    'bg-indigo-200': '#c7d2fe',
    'bg-violet-100': '#ede9fe',
    'bg-violet-200': '#ddd6fe',
    'bg-fuchsia-200': '#f5d0fe',
    'bg-slate-100': '#f1f5f9',
    'bg-slate-200': '#e2e8f0',
    'bg-stone-200': '#e7e5e4',
    'bg-white': '#ffffff',
};

const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_REGEX = /^rgb\(\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*\)$/i;
const RGB_CSV_REGEX = /^([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])$/;

export const normalizeMapColorMode = (value?: string | null): MapColorMode =>
    value === 'brand' || value === 'trip' ? value : DEFAULT_MAP_COLOR_MODE;

export const isInternalMapColorModeControlEnabled = (): boolean => {
    if (typeof window === 'undefined') return false;

    try {
        const params = new URLSearchParams(window.location.search);
        const queryToggle = params.get('internalMapColors') || params.get('internal');
        if (queryToggle === '1' || queryToggle?.toLowerCase() === 'true') return true;

        const storedToggle = window.localStorage.getItem('tf_internal_map_colors');
        if (storedToggle === '1' || storedToggle?.toLowerCase() === 'true' || storedToggle?.toLowerCase() === 'on') {
            return true;
        }
    } catch {
        // ignore malformed location/storage access
    }

    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
};

export const normalizeHexColor = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    const match = trimmed.match(HEX_COLOR_REGEX);
    if (!match) return null;

    const raw = match[1].toLowerCase();
    if (raw.length === 3) {
        return `#${raw.split('').map(char => `${char}${char}`).join('')}`;
    }
    return `#${raw}`;
};

const rgbToHex = (r: number, g: number, b: number): string =>
    `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;

export const normalizeRgbColor = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();

    const rgbMatch = trimmed.match(RGB_COLOR_REGEX);
    if (rgbMatch) {
        const [r, g, b] = rgbMatch.slice(1, 4).map(Number);
        return rgbToHex(r, g, b);
    }

    const csvMatch = trimmed.match(RGB_CSV_REGEX);
    if (csvMatch) {
        const [r, g, b] = csvMatch.slice(1, 4).map(Number);
        return rgbToHex(r, g, b);
    }

    return null;
};

export const normalizeCityColorInput = (value?: string | null): string | null => {
    return normalizeHexColor(value) || normalizeRgbColor(value);
};

const getTailwindBgHex = (value?: string | null): string | null => {
    if (!value) return null;
    const tokens = value.split(/\s+/).filter(Boolean);
    const bgToken = tokens.find(token => token.startsWith('bg-'));
    if (!bgToken) return null;
    return TAILWIND_BG_HEX_LOOKUP[bgToken] || null;
};

export const getCityColorPalette = (paletteId?: string | null): CityColorPalette => {
    if (!paletteId) return CITY_COLOR_PALETTES_BY_ID.get(DEFAULT_CITY_COLOR_PALETTE_ID)!;
    return CITY_COLOR_PALETTES_BY_ID.get(paletteId as CityColorPaletteId) || CITY_COLOR_PALETTES_BY_ID.get(DEFAULT_CITY_COLOR_PALETTE_ID)!;
};

export const getPaletteColorAtIndex = (paletteId: string | null | undefined, index: number): string => {
    const palette = getCityColorPalette(paletteId);
    if (palette.colors.length === 0) return '#4f46e5';
    return palette.colors[Math.max(0, index) % palette.colors.length];
};

export const shiftHexColor = (hex: string, amount: number): string => {
    const normalized = normalizeHexColor(hex) || '#4f46e5';
    const raw = normalized.slice(1);
    const next = [0, 2, 4].map((idx) => {
        const channel = Number.parseInt(raw.slice(idx, idx + 2), 16);
        const shifted = Math.max(0, Math.min(255, channel + amount));
        return shifted.toString(16).padStart(2, '0');
    }).join('');
    return `#${next}`;
};

export const getContrastTextColor = (hex: string): '#000000' | '#ffffff' => {
    const normalized = normalizeHexColor(hex) || '#4f46e5';
    const raw = normalized.slice(1);
    const [r, g, b] = [0, 2, 4].map((idx) => Number.parseInt(raw.slice(idx, idx + 2), 16));

    const toLinear = (channel: number): number => {
        const srgb = channel / 255;
        return srgb <= 0.03928 ? (srgb / 12.92) : (((srgb + 0.055) / 1.055) ** 2.4);
    };

    const getRelativeLuminance = (red: number, green: number, blue: number): number =>
        (0.2126 * toLinear(red)) + (0.7152 * toLinear(green)) + (0.0722 * toLinear(blue));

    const backgroundLuminance = getRelativeLuminance(r, g, b);

    const darkText = '#000000';
    const lightText = '#ffffff';

    const parseHexChannels = (value: string): [number, number, number] => {
        const compact = value.replace('#', '');
        return [
            Number.parseInt(compact.slice(0, 2), 16),
            Number.parseInt(compact.slice(2, 4), 16),
            Number.parseInt(compact.slice(4, 6), 16),
        ];
    };

    const [darkR, darkG, darkB] = parseHexChannels(darkText);
    const [lightR, lightG, lightB] = parseHexChannels(lightText);
    const darkLuminance = getRelativeLuminance(darkR, darkG, darkB);
    const lightLuminance = getRelativeLuminance(lightR, lightG, lightB);

    const getContrastRatio = (a: number, b: number): number => {
        const lighter = Math.max(a, b);
        const darker = Math.min(a, b);
        return (lighter + 0.05) / (darker + 0.05);
    };

    const contrastWithDark = getContrastRatio(backgroundLuminance, darkLuminance);
    const contrastWithLight = getContrastRatio(backgroundLuminance, lightLuminance);
    return contrastWithDark >= contrastWithLight ? darkText : lightText;
};

export const isTailwindCityColorValue = (value?: string | null): boolean => {
    if (!value) return false;
    return value.includes('bg-') && value.includes('border-');
};

export const applyCityPaletteToItems = (
    items: ITimelineItem[],
    paletteId?: string | null
): ITimelineItem[] => {
    const palette = getCityColorPalette(paletteId);
    if (palette.colors.length === 0) return items;

    const colorByCity = new Map<string, string>();
    let cityColorIndex = 0;

    return items.map((item) => {
        if (item.type !== 'city') return item;

        const cityKey = getNormalizedCityName(item.title || item.location) || `__city-${item.id}`;
        if (!colorByCity.has(cityKey)) {
            colorByCity.set(cityKey, palette.colors[cityColorIndex % palette.colors.length]);
            cityColorIndex += 1;
        }

        const paletteColor = colorByCity.get(cityKey) || palette.colors[cityColorIndex % palette.colors.length];
        return item.color === paletteColor ? item : { ...item, color: paletteColor };
    });
};

export const getTripPrimaryCityColorHex = (items: ITimelineItem[]): string => {
    const firstCity = items
        .filter(item => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset)[0];
    if (!firstCity?.color) return '#4f46e5';
    return getHexFromColorClass(firstCity.color);
};

export const ALL_ACTIVITY_TYPES: ActivityType[] = [
    'general',
    'sightseeing',
    'food',
    'culture',
    'relaxation',
    'nightlife',
    'sports',
    'hiking',
    'wildlife',
    'nature',
    'shopping',
    'adventure',
    'beach',
];

const ACTIVITY_TYPE_SET = new Set<ActivityType>(ALL_ACTIVITY_TYPES);

const ACTIVITY_TYPE_ALIASES: Record<string, ActivityType[]> = {
    activity: ['general'],
    landmark: ['sightseeing'],
    sightseeing: ['sightseeing'],
    food: ['food'],
    dining: ['food'],
    restaurant: ['food'],
    cuisine: ['food'],
    culture: ['culture'],
    historical: ['culture'],
    history: ['culture'],
    museum: ['culture'],
    relaxation: ['relaxation'],
    relax: ['relaxation'],
    spa: ['relaxation'],
    nightlife: ['nightlife'],
    party: ['nightlife'],
    bar: ['nightlife'],
    sports: ['sports'],
    sport: ['sports'],
    hiking: ['hiking'],
    trek: ['hiking'],
    trekking: ['hiking'],
    wildlife: ['wildlife'],
    safari: ['wildlife'],
    nature: ['nature'],
    outdoors: ['nature'],
    shopping: ['shopping'],
    adventure: ['adventure'],
    beach: ['beach'],
};

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
    general: 'bg-slate-100 border-slate-300 text-slate-800',
    sightseeing: 'bg-sky-100 border-sky-300 text-sky-800',
    food: 'bg-amber-100 border-amber-300 text-amber-800',
    culture: 'bg-violet-100 border-violet-300 text-violet-800',
    relaxation: 'bg-teal-100 border-teal-300 text-teal-800',
    nightlife: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
    sports: 'bg-red-100 border-red-300 text-red-800',
    hiking: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    wildlife: 'bg-lime-100 border-lime-300 text-lime-800',
    nature: 'bg-green-100 border-green-300 text-green-800',
    shopping: 'bg-pink-100 border-pink-300 text-pink-800',
    adventure: 'bg-orange-100 border-orange-300 text-orange-800',
    beach: 'bg-cyan-100 border-cyan-300 text-cyan-800',
};

// Multi-type activities use a deterministic priority, so timeline color remains stable.
const ACTIVITY_TYPE_PRIORITY: ActivityType[] = [
    'nature',
    'hiking',
    'wildlife',
    'beach',
    'food',
    'culture',
    'sightseeing',
    'nightlife',
    'adventure',
    'sports',
    'shopping',
    'relaxation',
    'general',
];

const tokenizeActivityValue = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(tokenizeActivityValue);
    }
    if (typeof value !== 'string') return [];
    return value
        .split(/[,\|/;]+/)
        .map(v => v.trim().toLowerCase())
        .filter(Boolean);
};

const resolveActivityToken = (token: string): ActivityType[] => {
    if (ACTIVITY_TYPE_SET.has(token as ActivityType)) return [token as ActivityType];
    if (ACTIVITY_TYPE_ALIASES[token]) return ACTIVITY_TYPE_ALIASES[token];

    if (token.includes('food') || token.includes('dining') || token.includes('restaurant')) return ['food'];
    if (token.includes('museum') || token.includes('history') || token.includes('culture')) return ['culture'];
    if (token.includes('sight') || token.includes('view') || token.includes('landmark')) return ['sightseeing'];
    if (token.includes('hike') || token.includes('trek')) return ['hiking'];
    if (token.includes('wildlife') || token.includes('safari') || token.includes('animal')) return ['wildlife'];
    if (token.includes('nature') || token.includes('park') || token.includes('outdoor')) return ['nature'];
    if (token.includes('beach') || token.includes('sea') || token.includes('coast')) return ['beach'];
    if (token.includes('night') || token.includes('party') || token.includes('club') || token.includes('bar')) return ['nightlife'];
    if (token.includes('shop') || token.includes('market')) return ['shopping'];
    if (token.includes('adventure') || token.includes('adrenaline')) return ['adventure'];
    if (token.includes('sport')) return ['sports'];
    if (token.includes('relax') || token.includes('spa') || token.includes('wellness')) return ['relaxation'];
    if (token.includes('general') || token.includes('activity')) return ['general'];

    return [];
};

export const normalizeActivityTypes = (value: unknown, fallback: ActivityType[] = ['general']): ActivityType[] => {
    const tokens = tokenizeActivityValue(value);
    const resolved = new Set<ActivityType>();

    tokens.forEach(token => {
        resolveActivityToken(token).forEach(type => resolved.add(type));
    });

    const normalized = ALL_ACTIVITY_TYPES.filter(type => resolved.has(type));
    return normalized.length > 0 ? normalized : fallback;
};

export const pickPrimaryActivityType = (value: unknown): ActivityType => {
    const normalized = normalizeActivityTypes(value);
    return ACTIVITY_TYPE_PRIORITY.find(type => normalized.includes(type)) || normalized[0] || 'general';
};

export const getActivityColorByTypes = (value: unknown): string => {
    const primaryType = pickPrimaryActivityType(value);
    return ACTIVITY_TYPE_COLORS[primaryType];
};

export const TRAVEL_COLOR = 'bg-stone-800 border-stone-600 text-stone-100';
export const TRAVEL_EMPTY_COLOR = 'bg-white border-dashed border-stone-300 text-stone-400';

export const getRandomCityColor = (index: number) => CITY_COLORS[index % CITY_COLORS.length];
export const getRandomActivityColor = () => ACTIVITY_TYPE_COLORS.general;

export const getNormalizedCityName = (value?: string): string => {
    if (!value) return '';
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
};

// Keep repeated city stops visually linked (e.g., roundtrip start/end).
export const normalizeCityColors = (items: ITimelineItem[]): ITimelineItem[] => {
    const colorByCity = new Map<string, string>();
    let fallbackColorIndex = 0;

    return items.map(item => {
        if (item.type !== 'city') return item;

        const cityKey = getNormalizedCityName(item.title || item.location);
        const fallbackColor = item.color || getRandomCityColor(fallbackColorIndex++);

        if (!cityKey) {
            return item.color === fallbackColor ? item : { ...item, color: fallbackColor };
        }

        if (!colorByCity.has(cityKey)) {
            colorByCity.set(cityKey, fallbackColor);
        }

        const canonicalColor = colorByCity.get(cityKey) || fallbackColor;
        return item.color === canonicalColor ? item : { ...item, color: canonicalColor };
    });
};

// Resolves city color tokens (Tailwind class, hex, rgb) to a solid hex color.
export const getHexFromColorClass = (colorValue: string): string => {
    const directHex = normalizeCityColorInput(colorValue);
    if (directHex) return directHex;

    const presetMatch = PRESET_COLORS.find(c => c.class === colorValue);
    if (presetMatch) return presetMatch.hex;

    const tailwindHex = getTailwindBgHex(colorValue);
    if (tailwindHex) return tailwindHex;

    return '#4f46e5';
};

export const buildRouteCacheKey = (start: ICoordinates, end: ICoordinates, mode: string): string => {
    const round = (value: number) => value.toFixed(5);
    return `${round(start.lat)},${round(start.lng)}|${round(end.lat)},${round(end.lng)}|${mode}`;
};

// Comprehensive Countries Data
export const COUNTRIES = [
    { name: "Afghanistan", code: "AF", flag: "🇦🇫" },
    { name: "Albania", code: "AL", flag: "🇦🇱" },
    { name: "Algeria", code: "DZ", flag: "🇩🇿" },
    { name: "Andorra", code: "AD", flag: "🇦🇩" },
    { name: "Angola", code: "AO", flag: "🇦🇴" },
    { name: "Antigua and Barbuda", code: "AG", flag: "🇦🇬" },
    { name: "Argentina", code: "AR", flag: "🇦🇷" },
    { name: "Armenia", code: "AM", flag: "🇦🇲" },
    { name: "Australia", code: "AU", flag: "🇦🇺" },
    { name: "Austria", code: "AT", flag: "🇦🇹" },
    { name: "Azerbaijan", code: "AZ", flag: "🇦🇿" },
    { name: "Bahamas", code: "BS", flag: "🇧🇸" },
    { name: "Bahrain", code: "BH", flag: "🇧🇭" },
    { name: "Bangladesh", code: "BD", flag: "🇧🇩" },
    { name: "Barbados", code: "BB", flag: "🇧🇧" },
    { name: "Belarus", code: "BY", flag: "🇧🇾" },
    { name: "Belgium", code: "BE", flag: "🇧🇪" },
    { name: "Belize", code: "BZ", flag: "🇧🇿" },
    { name: "Benin", code: "BJ", flag: "🇧🇯" },
    { name: "Bhutan", code: "BT", flag: "🇧🇹" },
    { name: "Bolivia", code: "BO", flag: "🇧🇴" },
    { name: "Bosnia and Herzegovina", code: "BA", flag: "🇧🇦" },
    { name: "Botswana", code: "BW", flag: "🇧🇼" },
    { name: "Brazil", code: "BR", flag: "🇧🇷" },
    { name: "Brunei", code: "BN", flag: "🇧🇳" },
    { name: "Bulgaria", code: "BG", flag: "🇧🇬" },
    { name: "Burkina Faso", code: "BF", flag: "🇧🇫" },
    { name: "Burundi", code: "BI", flag: "🇧🇮" },
    { name: "Cambodia", code: "KH", flag: "🇰🇭" },
    { name: "Cameroon", code: "CM", flag: "🇨🇲" },
    { name: "Canada", code: "CA", flag: "🇨🇦" },
    { name: "Cape Verde", code: "CV", flag: "🇨🇻" },
    { name: "Central African Republic", code: "CF", flag: "🇨🇫" },
    { name: "Chad", code: "TD", flag: "🇹🇩" },
    { name: "Chile", code: "CL", flag: "🇨🇱" },
    { name: "China", code: "CN", flag: "🇨🇳" },
    { name: "Colombia", code: "CO", flag: "🇨🇴" },
    { name: "Comoros", code: "KM", flag: "🇰🇲" },
    { name: "Congo (Democratic Republic)", code: "CD", flag: "🇨🇩" },
    { name: "Congo (Republic)", code: "CG", flag: "🇨🇬" },
    { name: "Costa Rica", code: "CR", flag: "🇨🇷" },
    { name: "Croatia", code: "HR", flag: "🇭🇷" },
    { name: "Cuba", code: "CU", flag: "🇨🇺" },
    { name: "Cyprus", code: "CY", flag: "🇨🇾" },
    { name: "Czech Republic", code: "CZ", flag: "🇨🇿" },
    { name: "Denmark", code: "DK", flag: "🇩🇰" },
    { name: "Djibouti", code: "DJ", flag: "🇩🇯" },
    { name: "Dominica", code: "DM", flag: "🇩🇲" },
    { name: "Dominican Republic", code: "DO", flag: "🇩🇴" },
    { name: "East Timor", code: "TL", flag: "🇹🇱" },
    { name: "Ecuador", code: "EC", flag: "🇪🇨" },
    { name: "Egypt", code: "EG", flag: "🇪🇬" },
    { name: "El Salvador", code: "SV", flag: "🇸🇻" },
    { name: "Equatorial Guinea", code: "GQ", flag: "🇬🇶" },
    { name: "Eritrea", code: "ER", flag: "🇪🇷" },
    { name: "Estonia", code: "EE", flag: "🇪🇪" },
    { name: "Eswatini", code: "SZ", flag: "🇸🇿" },
    { name: "Ethiopia", code: "ET", flag: "🇪🇹" },
    { name: "Fiji", code: "FJ", flag: "🇫🇯" },
    { name: "Finland", code: "FI", flag: "🇫🇮" },
    { name: "France", code: "FR", flag: "🇫🇷" },
    { name: "Gabon", code: "GA", flag: "🇬🇦" },
    { name: "Gambia", code: "GM", flag: "🇬🇲" },
    { name: "Georgia", code: "GE", flag: "🇬🇪" },
    { name: "Germany", code: "DE", flag: "🇩🇪" },
    { name: "Ghana", code: "GH", flag: "🇬🇭" },
    { name: "Greece", code: "GR", flag: "🇬🇷" },
    { name: "Grenada", code: "GD", flag: "🇬🇩" },
    { name: "Guatemala", code: "GT", flag: "🇬🇹" },
    { name: "Guinea", code: "GN", flag: "🇬🇳" },
    { name: "Guinea-Bissau", code: "GW", flag: "🇬🇼" },
    { name: "Guyana", code: "GY", flag: "🇬🇾" },
    { name: "Haiti", code: "HT", flag: "🇭🇹" },
    { name: "Honduras", code: "HN", flag: "🇭🇳" },
    { name: "Hungary", code: "HU", flag: "🇭🇺" },
    { name: "Iceland", code: "IS", flag: "🇮🇸" },
    { name: "India", code: "IN", flag: "🇮🇳" },
    { name: "Indonesia", code: "ID", flag: "🇮🇩" },
    { name: "Iran", code: "IR", flag: "🇮🇷" },
    { name: "Iraq", code: "IQ", flag: "🇮🇶" },
    { name: "Ireland", code: "IE", flag: "🇮🇪" },
    { name: "Israel", code: "IL", flag: "🇮🇱" },
    { name: "Italy", code: "IT", flag: "🇮🇹" },
    { name: "Ivory Coast", code: "CI", flag: "🇨🇮" },
    { name: "Jamaica", code: "JM", flag: "🇯🇲" },
    { name: "Japan", code: "JP", flag: "🇯🇵" },
    { name: "Jordan", code: "JO", flag: "🇯🇴" },
    { name: "Kazakhstan", code: "KZ", flag: "🇰🇿" },
    { name: "Kenya", code: "KE", flag: "🇰🇪" },
    { name: "Kiribati", code: "KI", flag: "🇰🇮" },
    { name: "Kosovo", code: "XK", flag: "🇽🇰" },
    { name: "Kuwait", code: "KW", flag: "🇰🇼" },
    { name: "Kyrgyzstan", code: "KG", flag: "🇰🇬" },
    { name: "Laos", code: "LA", flag: "🇱🇦" },
    { name: "Latvia", code: "LV", flag: "🇱🇻" },
    { name: "Lebanon", code: "LB", flag: "🇱🇧" },
    { name: "Lesotho", code: "LS", flag: "🇱🇸" },
    { name: "Liberia", code: "LR", flag: "🇱🇷" },
    { name: "Libya", code: "LY", flag: "🇱🇾" },
    { name: "Liechtenstein", code: "LI", flag: "🇱🇮" },
    { name: "Lithuania", code: "LT", flag: "🇱🇹" },
    { name: "Luxembourg", code: "LU", flag: "🇱🇺" },
    { name: "Madagascar", code: "MG", flag: "🇲🇬" },
    { name: "Malawi", code: "MW", flag: "🇲🇼" },
    { name: "Malaysia", code: "MY", flag: "🇲🇾" },
    { name: "Maldives", code: "MV", flag: "🇲🇻" },
    { name: "Mali", code: "ML", flag: "🇲🇱" },
    { name: "Malta", code: "MT", flag: "🇲🇹" },
    { name: "Marshall Islands", code: "MH", flag: "🇲🇭" },
    { name: "Mauritania", code: "MR", flag: "🇲🇷" },
    { name: "Mauritius", code: "MU", flag: "🇲🇺" },
    { name: "Mexico", code: "MX", flag: "🇲🇽" },
    { name: "Micronesia", code: "FM", flag: "🇫🇲" },
    { name: "Moldova", code: "MD", flag: "🇲🇩" },
    { name: "Monaco", code: "MC", flag: "🇲🇨" },
    { name: "Mongolia", code: "MN", flag: "🇲🇳" },
    { name: "Montenegro", code: "ME", flag: "🇲🇪" },
    { name: "Morocco", code: "MA", flag: "🇲🇦" },
    { name: "Mozambique", code: "MZ", flag: "🇲🇿" },
    { name: "Myanmar", code: "MM", flag: "🇲🇲" },
    { name: "Namibia", code: "NA", flag: "🇳🇦" },
    { name: "Nauru", code: "NR", flag: "🇳🇷" },
    { name: "Nepal", code: "NP", flag: "🇳🇵" },
    { name: "Netherlands", code: "NL", flag: "🇳🇱" },
    { name: "New Zealand", code: "NZ", flag: "🇳🇿" },
    { name: "Nicaragua", code: "NI", flag: "🇳🇮" },
    { name: "Niger", code: "NE", flag: "🇳🇪" },
    { name: "Nigeria", code: "NG", flag: "🇳🇬" },
    { name: "North Korea", code: "KP", flag: "🇰🇵" },
    { name: "North Macedonia", code: "MK", flag: "🇲🇰" },
    { name: "Norway", code: "NO", flag: "🇳🇴" },
    { name: "Oman", code: "OM", flag: "🇴🇲" },
    { name: "Pakistan", code: "PK", flag: "🇵🇰" },
    { name: "Palau", code: "PW", flag: "🇵🇼" },
    { name: "Palestine", code: "PS", flag: "🇵🇸" },
    { name: "Panama", code: "PA", flag: "🇵🇦" },
    { name: "Papua New Guinea", code: "PG", flag: "🇵🇬" },
    { name: "Paraguay", code: "PY", flag: "🇵🇾" },
    { name: "Peru", code: "PE", flag: "🇵🇪" },
    { name: "Philippines", code: "PH", flag: "🇵🇭" },
    { name: "Poland", code: "PL", flag: "🇵🇱" },
    { name: "Portugal", code: "PT", flag: "🇵🇹" },
    { name: "Qatar", code: "QA", flag: "🇶🇦" },
    { name: "Romania", code: "RO", flag: "🇷🇴" },
    { name: "Russia", code: "RU", flag: "🇷🇺" },
    { name: "Rwanda", code: "RW", flag: "🇷🇼" },
    { name: "Saint Kitts and Nevis", code: "KN", flag: "🇰🇳" },
    { name: "Saint Lucia", code: "LC", flag: "🇱🇨" },
    { name: "Saint Vincent and the Grenadines", code: "VC", flag: "🇻🇨" },
    { name: "Samoa", code: "WS", flag: "🇼🇸" },
    { name: "San Marino", code: "SM", flag: "🇸🇲" },
    { name: "Sao Tome and Principe", code: "ST", flag: "🇸🇹" },
    { name: "Saudi Arabia", code: "SA", flag: "🇸🇦" },
    { name: "Senegal", code: "SN", flag: "🇸🇳" },
    { name: "Serbia", code: "RS", flag: "🇷🇸" },
    { name: "Seychelles", code: "SC", flag: "🇸🇨" },
    { name: "Sierra Leone", code: "SL", flag: "🇸🇱" },
    { name: "Singapore", code: "SG", flag: "🇸🇬" },
    { name: "Slovakia", code: "SK", flag: "🇸🇰" },
    { name: "Slovenia", code: "SI", flag: "🇸🇮" },
    { name: "Solomon Islands", code: "SB", flag: "🇸🇧" },
    { name: "Somalia", code: "SO", flag: "🇸🇴" },
    { name: "South Africa", code: "ZA", flag: "🇿🇦" },
    { name: "South Korea", code: "KR", flag: "🇰🇷" },
    { name: "South Sudan", code: "SS", flag: "🇸🇸" },
    { name: "Spain", code: "ES", flag: "🇪🇸" },
    { name: "Sri Lanka", code: "LK", flag: "🇱🇰" },
    { name: "Sudan", code: "SD", flag: "🇸🇩" },
    { name: "Suriname", code: "SR", flag: "🇸🇷" },
    { name: "Sweden", code: "SE", flag: "🇸🇪" },
    { name: "Switzerland", code: "CH", flag: "🇨🇭" },
    { name: "Syria", code: "SY", flag: "🇸🇾" },
    { name: "Taiwan", code: "TW", flag: "🇹🇼" },
    { name: "Tajikistan", code: "TJ", flag: "🇹🇯" },
    { name: "Tanzania", code: "TZ", flag: "🇹🇿" },
    { name: "Thailand", code: "TH", flag: "🇹🇭" },
    { name: "Togo", code: "TG", flag: "🇹🇬" },
    { name: "Tonga", code: "TO", flag: "🇹🇴" },
    { name: "Trinidad and Tobago", code: "TT", flag: "🇹🇹" },
    { name: "Tunisia", code: "TN", flag: "🇹🇳" },
    { name: "Turkey", code: "TR", flag: "🇹🇷" },
    { name: "Turkmenistan", code: "TM", flag: "🇹🇲" },
    { name: "Tuvalu", code: "TV", flag: "🇹🇻" },
    { name: "Uganda", code: "UG", flag: "🇺🇬" },
    { name: "Ukraine", code: "UA", flag: "🇺🇦" },
    { name: "United Arab Emirates", code: "AE", flag: "🇦🇪" },
    { name: "United Kingdom", code: "GB", flag: "🇬🇧" },
    { name: "United States", code: "US", flag: "🇺🇸" },
    { name: "Uruguay", code: "UY", flag: "🇺🇾" },
    { name: "Uzbekistan", code: "UZ", flag: "🇺🇿" },
    { name: "Vanuatu", code: "VU", flag: "🇻🇺" },
    { name: "Vatican City", code: "VA", flag: "🇻🇦" },
    { name: "Venezuela", code: "VE", flag: "🇻🇪" },
    { name: "Vietnam", code: "VN", flag: "🇻🇳" },
    { name: "Yemen", code: "YE", flag: "🇾🇪" },
    { name: "Zambia", code: "ZM", flag: "🇿🇲" },
    { name: "Zimbabwe", code: "ZW", flag: "🇿🇼" }
];

// --- COMPRESSION ---
export const compressTrip = (trip: ITrip, view?: IViewSettings): string => {
    try {
        const state: ISharedState = { trip, view };
        const json = JSON.stringify(state);
        return LZString.compressToEncodedURIComponent(json);
    } catch (e) {
        console.error("Compression failed", e);
        return "";
    }
};

export const decompressTrip = (encoded: string): ISharedState | null => {
    try {
        const json = LZString.decompressFromEncodedURIComponent(encoded);
        if (!json) return null;

        const parsed = JSON.parse(json);

        // Backward compatibility: If parsed object has 'id' and 'items', it's just a trip
        if (parsed.id && Array.isArray(parsed.items)) {
            return { trip: parsed as ITrip };
        }

        // precise check for ISharedState structure
        if (parsed.trip) {
            return parsed as ISharedState;
        }

        return null;
    } catch (e) {
        console.error("Decompression failed", e);
        return null; // Invalid data
    }
};

// --- TRIP PREFILL (URL-encoded create-trip parameters) ---

export const encodeTripPrefill = (data: TripPrefillData): string => {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const buildCreateTripUrl = (data: TripPrefillData): string => {
    const encoded = encodeTripPrefill(data);
    return `/create-trip?prefill=${encoded}`;
};
