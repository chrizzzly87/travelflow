import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { useSearchParams } from 'react-router-dom';
import {
    AirplaneTakeoff,
    ArrowsClockwise,
    Database,
    DotsThreeVertical,
    FloppyDisk,
    MapPin,
    MagnifyingGlass,
    PencilSimple,
    Plus,
    SpinnerGap,
    Tag,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';
import { useAppDialog } from '../components/AppDialogProvider';
import { GoogleMapsLoader, useGoogleMaps } from '../components/GoogleMapsLoader';
import { AdminAirportTesterMap } from '../components/admin/AdminAirportTesterMap';
import { AdminAirportTicketLab } from '../components/admin/AdminAirportTicketLab';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminShell } from '../components/admin/AdminShell';
import { ADMIN_TABLE_ROW_SURFACE_CLASS } from '../components/admin/AdminDataTableUtils';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminDetailSheet } from '../components/admin/AdminDetailSheet';
import { AdminSelectionBar } from '../components/admin/AdminSelectionBar';
import { AdminPagination } from '../components/admin/AdminPagination';
import {
    ADMIN_AIRPORTS_TABS,
    buildAirportBulkPatch,
    EMPTY_AIRPORT_BULK_EDIT,
    formatAirportCodes,
    hasNearbyTesterQueryState,
    resolveAdminAirportsTab,
    summarizeAirportServiceTiers,
    type AdminAirportsTab,
    type AirportBulkEditChoices,
    type BulkAirportTypeOption,
    type BulkScheduledServiceOption,
    type BulkTimezoneMode,
} from '../components/admin/adminAirportsModel';
import { formatAdminAbsoluteTime, formatAdminRelativeTime } from '../components/admin/adminContentEditorModel';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { showAppToast } from '../components/ui/appToast';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../lib/utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    adminBulkUpdateAirportCatalogRecords,
    adminCreateAirportCatalogRecord,
    adminDeleteAirportCatalogRecords,
    adminGetAirportCatalog,
    adminSyncAirportCatalog,
    adminUpdateAirportCatalogRecord,
    type AdminAirportBulkUpdatePatch,
    type AdminAirportCatalogResponse,
} from '../services/adminService';
import {
    fetchNearbyAirports,
} from '../services/nearbyAirportsService';
import {
    ensureRuntimeLocationLoaded,
    type RuntimeLocationStoreSnapshot,
} from '../services/runtimeLocationService';
import {
    getProfileCountryOptionByCode,
    normalizeProfileCountryCode,
} from '../services/profileCountryService';
import {
    reverseGeocodeCountry,
    resolveCitySuggestion,
    searchCitySuggestions,
    type CityLookupSuggestion,
} from '../services/locationSearchService';
import {
    clampNearbyAirportLimit,
    deriveAirportCommercialFlags,
    normalizeAirportReference,
    type AirportCommercialServiceTier,
    type AirportReference,
    type NearbyAirportsResponse,
} from '../shared/airportReference';

type AirportCatalogSource = AdminAirportCatalogResponse['source'];
type AirportTableTierFilter = 'all' | AirportCommercialServiceTier;

interface AirportEditorDraft {
    ident: string;
    iataCode: string;
    icaoCode: string;
    name: string;
    municipality: string;
    subdivisionName: string;
    regionCode: string;
    countryCode: string;
    countryName: string;
    latitude: string;
    longitude: string;
    timezone: string;
    airportType: AirportReference['airportType'];
    scheduledService: boolean;
}

interface TesterOrigin {
    label: string;
    lat: number;
    lng: number;
    countryCode: string | null;
    countryName: string | null;
}

type AirportTableColumnId = 'airport' | 'location' | 'tier' | 'type' | 'timezone';

interface AdminAirportTesterFilters {
    cityQuery: string;
    latitudeInput: string;
    longitudeInput: string;
    limitInput: string;
    minimumServiceTier: AirportCommercialServiceTier;
    countryFilter: string;
    sameCountryOnly: boolean;
    lookupActive: boolean;
}

type AdminAirportTesterSearchParams = Pick<URLSearchParams, 'get'>;

const AIRPORT_TABLE_PAGE_SIZE = 50;
const DEFAULT_ADMIN_AIRPORT_TESTER_LIMIT = '10';
const DEFAULT_ADMIN_AIRPORT_TESTER_SERVICE_TIER: AirportCommercialServiceTier = 'major';
const SERVICE_TIER_OPTIONS: Array<{ value: AirportCommercialServiceTier; label: string; helper: string }> = [
    { value: 'major', label: 'Major only', helper: 'Large airports used for big commercial traffic.' },
    { value: 'regional', label: 'Regional + major', helper: 'Typical passenger airports plus large hubs.' },
    { value: 'local', label: 'All commercial', helper: 'Includes smaller scheduled commercial fields.' },
];

const AIRPORT_TYPE_OPTIONS: Array<{ value: AirportReference['airportType']; label: string }> = [
    { value: 'large_airport', label: 'Large airport' },
    { value: 'medium_airport', label: 'Medium airport' },
    { value: 'small_airport', label: 'Small airport' },
];
const BULK_AIRPORT_TYPE_OPTIONS: Array<{ value: BulkAirportTypeOption; label: string }> = [
    { value: 'leave', label: 'Leave unchanged' },
    { value: 'large_airport', label: 'Set to large airport' },
    { value: 'medium_airport', label: 'Set to medium airport' },
    { value: 'small_airport', label: 'Set to small airport' },
];
const BULK_SCHEDULED_SERVICE_OPTIONS: Array<{ value: BulkScheduledServiceOption; label: string }> = [
    { value: 'leave', label: 'Leave unchanged' },
    { value: 'enabled', label: 'Set scheduled service on' },
    { value: 'disabled', label: 'Set scheduled service off' },
];
const BULK_TIMEZONE_MODE_OPTIONS: Array<{ value: BulkTimezoneMode; label: string }> = [
    { value: 'leave', label: 'Leave unchanged' },
    { value: 'set', label: 'Set timezone value' },
    { value: 'clear', label: 'Clear timezone' },
];
const AIRPORT_COLUMN_WIDTH_MIN: Record<AirportTableColumnId, number> = {
    airport: 240,
    location: 200,
    tier: 130,
    type: 120,
    timezone: 180,
};
const AIRPORT_COLUMN_WIDTH_DEFAULT: Record<AirportTableColumnId, number> = {
    airport: 320,
    location: 240,
    tier: 130,
    type: 120,
    timezone: 200,
};

const parseAirportTableTierFilter = (value: string | null): AirportTableTierFilter => (
    value === 'major' || value === 'regional' || value === 'local' ? value : 'all'
);

const parseAirportCommercialServiceTier = (
    value: string | null,
    fallback: AirportCommercialServiceTier,
): AirportCommercialServiceTier => (
    value === 'major' || value === 'regional' || value === 'local' ? value : fallback
);

const parsePositivePage = (value: string | null): number => {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const parseQueryBoolean = (value: string | null): boolean => (
    value === '1' || value === 'true'
);

const buildAirportTesterFilterSignature = (filters: AdminAirportTesterFilters): string => (
    `${filters.limitInput.trim()}|${filters.minimumServiceTier}|${filters.countryFilter}|${filters.sameCountryOnly ? '1' : '0'}`
);

const buildAirportTesterLookupAttemptSignature = (filters: AdminAirportTesterFilters): string => (
    `${filters.latitudeInput.trim()}|${filters.longitudeInput.trim()}|${buildAirportTesterFilterSignature(filters)}`
);

const areTesterOriginsEqual = (left: TesterOrigin | null, right: TesterOrigin | null): boolean => {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return left.label === right.label
        && left.lat === right.lat
        && left.lng === right.lng
        && left.countryCode === right.countryCode
        && left.countryName === right.countryName;
};

const buildTesterOriginFromFilters = (
    filters: Pick<AdminAirportTesterFilters, 'cityQuery' | 'latitudeInput' | 'longitudeInput'>,
    currentOrigin: TesterOrigin | null,
): TesterOrigin | null => {
    const latitude = Number(filters.latitudeInput);
    const longitude = Number(filters.longitudeInput);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const sameCoordinates = currentOrigin
        && currentOrigin.lat === latitude
        && currentOrigin.lng === longitude;

    return {
        label: filters.cityQuery.trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        lat: latitude,
        lng: longitude,
        countryCode: sameCoordinates ? currentOrigin.countryCode : null,
        countryName: sameCoordinates ? currentOrigin.countryName : null,
    };
};

const buildAdminAirportTesterFiltersFromSearchParams = (
    searchParams: AdminAirportTesterSearchParams,
): AdminAirportTesterFilters => ({
    cityQuery: searchParams.get('nearbyCity') || '',
    latitudeInput: searchParams.get('nearbyLat') || '',
    longitudeInput: searchParams.get('nearbyLng') || '',
    limitInput: searchParams.get('nearbyLimit') || DEFAULT_ADMIN_AIRPORT_TESTER_LIMIT,
    minimumServiceTier: parseAirportCommercialServiceTier(searchParams.get('nearbyTier'), DEFAULT_ADMIN_AIRPORT_TESTER_SERVICE_TIER),
    countryFilter: normalizeProfileCountryCode(searchParams.get('nearbyCountry')),
    sameCountryOnly: parseQueryBoolean(searchParams.get('nearbySameCountry')),
    lookupActive: parseQueryBoolean(searchParams.get('nearbyLookup')),
});

const areAdminAirportTesterFiltersEqual = (
    left: AdminAirportTesterFilters,
    right: AdminAirportTesterFilters,
): boolean => left.cityQuery === right.cityQuery
    && left.latitudeInput === right.latitudeInput
    && left.longitudeInput === right.longitudeInput
    && left.limitInput === right.limitInput
    && left.minimumServiceTier === right.minimumServiceTier
    && left.countryFilter === right.countryFilter
    && left.sameCountryOnly === right.sameCountryOnly
    && left.lookupActive === right.lookupActive;

const formatRuntimeLocationTesterLabel = (
    location: RuntimeLocationStoreSnapshot['location'],
): string => [location.city, location.countryName].filter(Boolean).join(', ') || 'Runtime location';

const formatDistance = (value: number): string => `${value.toFixed(value >= 100 ? 0 : 1)} km`;

const formatAirportTypeLabel = (airportType: AirportReference['airportType']): string => {
    if (airportType === 'large_airport') return 'Large';
    if (airportType === 'medium_airport') return 'Medium';
    return 'Small';
};

const formatServiceTierLabel = (tier: AirportCommercialServiceTier): string => {
    if (tier === 'major') return 'Major';
    if (tier === 'regional') return 'Regional';
    return 'Local';
};

const sortAirports = (airports: AirportReference[]): AirportReference[] => Array.from(airports).sort((left, right) => (
    left.countryCode.localeCompare(right.countryCode)
    || (left.iataCode || left.icaoCode || left.ident).localeCompare(right.iataCode || right.icaoCode || right.ident)
    || left.name.localeCompare(right.name)
    || left.ident.localeCompare(right.ident)
));

const airportToDraft = (airport: AirportReference): AirportEditorDraft => ({
    ident: airport.ident,
    iataCode: airport.iataCode || '',
    icaoCode: airport.icaoCode || '',
    name: airport.name,
    municipality: airport.municipality || '',
    subdivisionName: airport.subdivisionName || '',
    regionCode: airport.regionCode || '',
    countryCode: airport.countryCode,
    countryName: airport.countryName,
    latitude: String(airport.latitude),
    longitude: String(airport.longitude),
    timezone: airport.timezone || '',
    airportType: airport.airportType,
    scheduledService: airport.scheduledService,
});

const buildEmptyAirportDraft = (): AirportEditorDraft => ({
    ident: '',
    iataCode: '',
    icaoCode: '',
    name: '',
    municipality: '',
    subdivisionName: '',
    regionCode: '',
    countryCode: '',
    countryName: '',
    latitude: '',
    longitude: '',
    timezone: '',
    airportType: 'medium_airport',
    scheduledService: true,
});

const updateDraftCountry = (draft: AirportEditorDraft, nextCountryCode: string): AirportEditorDraft => {
    const selectedCountry = getProfileCountryOptionByCode(nextCountryCode);
    return {
        ...draft,
        countryCode: selectedCountry?.code || '',
        countryName: selectedCountry?.name || '',
    };
};

const draftToAirport = (draft: AirportEditorDraft): AirportReference | null => {
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    const normalized = normalizeAirportReference({
        ident: draft.ident,
        iataCode: draft.iataCode || null,
        icaoCode: draft.icaoCode || null,
        name: draft.name,
        municipality: draft.municipality || null,
        subdivisionName: draft.subdivisionName || null,
        regionCode: draft.regionCode || null,
        countryCode: draft.countryCode,
        countryName: getProfileCountryOptionByCode(draft.countryCode)?.name || draft.countryName,
        latitude,
        longitude,
        timezone: draft.timezone || null,
        airportType: draft.airportType,
        scheduledService: draft.scheduledService,
        isCommercial: true,
        commercialServiceTier: draft.airportType === 'large_airport' ? 'major' : draft.airportType === 'medium_airport' ? 'regional' : 'local',
        isMajorCommercial: draft.airportType === 'large_airport',
    });
    if (!normalized) return null;

    const derived = deriveAirportCommercialFlags({
        airportType: normalized.airportType,
        scheduledService: normalized.scheduledService,
        iataCode: normalized.iataCode,
        icaoCode: normalized.icaoCode,
    });

    return {
        ...normalized,
        ...derived,
    };
};

const resolveSelectedAirport = (
    airports: AirportReference[],
    preferredIdent: string | null,
): AirportReference | null => {
    if (preferredIdent) {
        const preferredAirport = airports.find((airport) => airport.ident === preferredIdent) || null;
        if (preferredAirport) return preferredAirport;
    }
    // The editor is a sheet now: nothing opens until an admin picks a row.
    return null;
};

/** How the catalog is being served, for the status tile and the editor gate. */
const describeCatalogSource = (
    source: AirportCatalogSource,
    databaseAvailable: boolean,
): { label: string; hint: string; tone: 'positive' | 'warning' | 'negative' } => {
    if (source === 'database') {
        return { label: 'Database', hint: 'Edits are saved to the live catalog.', tone: 'positive' };
    }
    return databaseAvailable
        ? { label: 'Snapshot fallback', hint: 'The database catalog is empty. Sync to enable edits.', tone: 'warning' }
        : { label: 'Snapshot only', hint: 'The database is unavailable, so the catalog is read-only.', tone: 'negative' };
};

/** A small form label: sentence case, muted, no tracking (docs/DESIGN.md). */
const ADMIN_FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';

const AdminAirportTester: React.FC<{
    filters: AdminAirportTesterFilters;
    onFiltersChange: (patch: Partial<AdminAirportTesterFilters>) => void;
    onLookupContextChange?: (context: { origin: TesterOrigin | null; lookupResult: NearbyAirportsResponse | null }) => void;
    /**
     * The tester stays mounted behind its tab so the ticket lab keeps its
     * result, but the map only mounts while visible: a map laid out in a
     * hidden (0×0) panel fits its bounds to nothing.
     */
    mapVisible?: boolean;
}> = ({ filters, onFiltersChange, onLookupContextChange, mapVisible = true }) => {
    const { isLoaded } = useGoogleMaps();
    const lookupRequestIdRef = useRef(0);
    const manualLookupInFlightRef = useRef(false);
    const [suggestions, setSuggestions] = useState<CityLookupSuggestion[]>([]);
    const [searchingSuggestions, setSearchingSuggestions] = useState(false);
    const [origin, setOrigin] = useState<TesterOrigin | null>(() => buildTesterOriginFromFilters(filters, null));
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [lookupResult, setLookupResult] = useState<NearbyAirportsResponse | null>(null);
    const [lastLookupFilterSignature, setLastLookupFilterSignature] = useState('');
    const [lastLookupAttemptSignature, setLastLookupAttemptSignature] = useState('');
    const filterSignature = useMemo(
        () => buildAirportTesterFilterSignature(filters),
        [filters],
    );
    const lookupAttemptSignature = useMemo(
        () => buildAirportTesterLookupAttemptSignature(filters),
        [filters],
    );
    const effectiveDisplayCountryCode = filters.sameCountryOnly
        ? (origin?.countryCode || null)
        : (filters.countryFilter || null);
    const displayLookupResult = useMemo<NearbyAirportsResponse | null>(() => {
        if (!lookupResult) return null;

        const normalizedLimit = clampNearbyAirportLimit(Number(filters.limitInput));
        const filteredAirports = lookupResult.airports
            .filter((entry) => {
                if (filters.sameCountryOnly && !origin?.countryCode) return false;
                if (effectiveDisplayCountryCode && entry.airport.countryCode !== effectiveDisplayCountryCode) return false;
                if (filters.minimumServiceTier === 'major') {
                    return entry.airport.commercialServiceTier === 'major';
                }
                if (filters.minimumServiceTier === 'regional') {
                    return entry.airport.commercialServiceTier !== 'local';
                }
                return true;
            })
            .slice(0, normalizedLimit)
            .map((entry, index) => ({
                ...entry,
                rank: index + 1,
            }));

        return {
            ...lookupResult,
            airports: filteredAirports,
        };
    }, [
        effectiveDisplayCountryCode,
        filters.limitInput,
        filters.minimumServiceTier,
        filters.sameCountryOnly,
        lookupResult,
        origin?.countryCode,
    ]);

    useEffect(() => {
        const query = filters.cityQuery.trim();
        if (!isLoaded || query.length < 2) {
            setSuggestions([]);
            setSearchingSuggestions(false);
            return;
        }

        const requestId = lookupRequestIdRef.current + 1;
        lookupRequestIdRef.current = requestId;
        setSearchingSuggestions(true);
        const timeoutId = window.setTimeout(() => {
            void (async () => {
                const nextSuggestions = await searchCitySuggestions(query, { maxResults: 5 });
                if (lookupRequestIdRef.current !== requestId) return;
                setSuggestions(nextSuggestions);
                setSearchingSuggestions(false);
            })();
        }, 220);

        return () => window.clearTimeout(timeoutId);
    }, [filters.cityQuery, isLoaded]);

    useEffect(() => {
        onLookupContextChange?.({
            origin,
            lookupResult: displayLookupResult,
        });
    }, [displayLookupResult, onLookupContextChange, origin]);

    useEffect(() => {
        setOrigin((current) => {
            const nextOrigin = buildTesterOriginFromFilters(filters, current);
            return areTesterOriginsEqual(current, nextOrigin) ? current : nextOrigin;
        });
    }, [filters.cityQuery, filters.latitudeInput, filters.longitudeInput]);

    const selectOrigin = useCallback((label: string, lat: number, lng: number, countryCode?: string | null, countryName?: string | null) => {
        const nextOrigin = {
            label,
            lat,
            lng,
            countryCode: countryCode || null,
            countryName: countryName || null,
        };
        setOrigin(nextOrigin);
        onFiltersChange({
            cityQuery: label,
            latitudeInput: String(lat),
            longitudeInput: String(lng),
        });
        setLookupResult(null);
        setLookupError(null);
    }, [onFiltersChange]);

    const handleUseRuntimeLocation = useCallback(async () => {
        const snapshot = await ensureRuntimeLocationLoaded();
        const latitude = snapshot.location.latitude;
        const longitude = snapshot.location.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setLookupError('Runtime location is unavailable for this session.');
            return;
        }

        const label = [snapshot.location.city, snapshot.location.countryName].filter(Boolean).join(', ') || 'Runtime location';
        selectOrigin(label, latitude, longitude, snapshot.location.countryCode, snapshot.location.countryName);
    }, [selectOrigin]);

    const handleResolveCity = useCallback(async () => {
        const query = filters.cityQuery.trim();
        if (!query) return;
        setLookupError(null);
        const resolved = await resolveCitySuggestion(query);
        if (!resolved) {
            setLookupError('No city match found. Try “City, Country” or choose a suggestion.');
            return;
        }

        selectOrigin(
            resolved.label,
            resolved.coordinates.lat,
            resolved.coordinates.lng,
            resolved.countryCode || null,
            resolved.countryName || null,
        );
        setSuggestions([]);
    }, [filters.cityQuery, selectOrigin]);

    const handleLookup = useCallback(async (options?: { force?: boolean }) => {
        const lat = Number(filters.latitudeInput);
        const lng = Number(filters.longitudeInput);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            setLookupError('Valid latitude and longitude are required.');
            return;
        }
        if (!options?.force && lastLookupAttemptSignature === lookupAttemptSignature) {
            return;
        }

        setLookupLoading(true);
        setLookupError(null);
        setLastLookupAttemptSignature(lookupAttemptSignature);
        try {
            let effectiveCountryCode = filters.sameCountryOnly ? (origin?.countryCode || null) : (filters.countryFilter || null);
            let nextOrigin = origin || {
                label: filters.cityQuery.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                lat,
                lng,
                countryCode: null,
                countryName: null,
            };

            if (filters.sameCountryOnly && !effectiveCountryCode) {
                const countryMatch = await reverseGeocodeCountry(lat, lng);
                if (!countryMatch) {
                    throw new Error('Could not resolve an origin country from these coordinates. Pick a country manually or disable the same-country filter.');
                }
                effectiveCountryCode = countryMatch.code;
                nextOrigin = {
                    ...nextOrigin,
                    countryCode: countryMatch.code,
                    countryName: countryMatch.name,
                };
            }

            const response = await fetchNearbyAirports({
                lat,
                lng,
                limit: clampNearbyAirportLimit(Number(filters.limitInput)),
                minimumServiceTier: filters.minimumServiceTier,
                countryCode: effectiveCountryCode,
            });
            setLookupResult(response);
            setOrigin(nextOrigin);
            setLastLookupFilterSignature(filterSignature);
        } catch (error) {
            setLookupResult(null);
            setLookupError(toAdminErrorMessage(error, 'Airport lookup failed.', 'admin-airports'));
        } finally {
            setLookupLoading(false);
            manualLookupInFlightRef.current = false;
        }
    }, [filterSignature, filters, lastLookupAttemptSignature, lookupAttemptSignature, origin]);

    useEffect(() => {
        const lat = Number(filters.latitudeInput);
        const lng = Number(filters.longitudeInput);
        if (manualLookupInFlightRef.current || !filters.lookupActive || lookupLoading || lookupResult) return;
        if (lastLookupAttemptSignature === lookupAttemptSignature) return;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        void handleLookup();
    }, [filters.latitudeInput, filters.longitudeInput, filters.lookupActive, handleLookup, lastLookupAttemptSignature, lookupAttemptSignature, lookupLoading, lookupResult]);

    useEffect(() => {
        if (!filters.lookupActive || lookupLoading || !lookupResult) return;
        if (lastLookupFilterSignature === filterSignature) return;
        if (lastLookupAttemptSignature === lookupAttemptSignature) return;
        void handleLookup();
    }, [filterSignature, filters.lookupActive, handleLookup, lastLookupAttemptSignature, lastLookupFilterSignature, lookupAttemptSignature, lookupLoading, lookupResult]);

    return (
        <AdminSurfaceCard className="flex flex-col gap-4">
            <AdminSectionHeader
                title="Nearby airport tester"
                description="Run the nearby-airports lookup travellers get for any city or coordinate, and check the result on a map."
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="admin-airports-city-search" className={ADMIN_FIELD_LABEL_CLASS}>City search</label>
                        <div className="relative">
                            <Input
                                id="admin-airports-city-search"
                                value={filters.cityQuery}
                                onChange={(event) => {
                                    onFiltersChange({
                                        cityQuery: event.target.value,
                                    });
                                    setLookupError(null);
                                }}
                                placeholder="Berlin, Germany"
                                className="pe-11"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => void handleResolveCity()}
                                className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                                aria-label="Resolve city"
                                data-tooltip="Resolve city"
                            >
                                {searchingSuggestions ? <SpinnerGap className="size-4 animate-spin" /> : <MagnifyingGlass className="size-4" />}
                            </Button>
                        </div>
                        {(searchingSuggestions || suggestions.length > 0) && (
                            <div className="overflow-hidden rounded-md border border-border bg-card">
                                {searchingSuggestions && (
                                    <div className="px-3 py-2 text-sm text-muted-foreground" role="status">Searching city suggestions…</div>
                                )}
                                {!searchingSuggestions && suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => {
                                            selectOrigin(
                                                suggestion.label,
                                                suggestion.coordinates.lat,
                                                suggestion.coordinates.lng,
                                                suggestion.countryCode || null,
                                                suggestion.countryName || null,
                                            );
                                            setSuggestions([]);
                                        }}
                                        className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-start transition-colors last:border-b-0 hover:bg-muted/50"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-foreground">{suggestion.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{suggestion.label}</span>
                                        </span>
                                        <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="admin-airports-latitude" className={ADMIN_FIELD_LABEL_CLASS}>Latitude</label>
                            <Input
                                id="admin-airports-latitude"
                                type="number"
                                step="0.000001"
                                value={filters.latitudeInput}
                                onChange={(event) => onFiltersChange({ latitudeInput: event.target.value })}
                                placeholder="52.5200"
                                className="tabular-nums"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="admin-airports-longitude" className={ADMIN_FIELD_LABEL_CLASS}>Longitude</label>
                            <Input
                                id="admin-airports-longitude"
                                type="number"
                                step="0.000001"
                                value={filters.longitudeInput}
                                onChange={(event) => onFiltersChange({ longitudeInput: event.target.value })}
                                placeholder="13.4050"
                                className="tabular-nums"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <div id="admin-airports-passenger-filter-label" className={ADMIN_FIELD_LABEL_CLASS}>Passenger filter</div>
                            <Select value={filters.minimumServiceTier} onValueChange={(value) => onFiltersChange({ minimumServiceTier: value as AirportCommercialServiceTier })}>
                                <SelectTrigger aria-labelledby="admin-airports-passenger-filter-label" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SERVICE_TIER_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {SERVICE_TIER_OPTIONS.find((option) => option.value === filters.minimumServiceTier)?.helper}
                            </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="admin-airports-result-limit" className={ADMIN_FIELD_LABEL_CLASS}>Result limit</label>
                            <Input
                                id="admin-airports-result-limit"
                                type="number"
                                min={1}
                                max={10}
                                value={filters.limitInput}
                                onChange={(event) => onFiltersChange({ limitInput: event.target.value })}
                                className="tabular-nums"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <ProfileCountryRegionSelect
                                value={filters.countryFilter}
                                disabled={filters.sameCountryOnly}
                                ariaLabel="Nearby airport country filter"
                                placeholder="All countries"
                                emptyLabel="No matching countries"
                                toggleLabel="Toggle airport country filter"
                                onValueChange={(value) => onFiltersChange({ countryFilter: value })}
                            />
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>Filter nearby-airport results to one country.</span>
                                {filters.countryFilter && !filters.sameCountryOnly && (
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="xs"
                                        onClick={() => onFiltersChange({ countryFilter: '' })}
                                        className="h-auto px-0 text-foreground"
                                    >
                                        Clear country filter
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">Same-country only</div>
                                <div className="text-xs text-muted-foreground">
                                    {filters.sameCountryOnly
                                        ? `Using ${origin?.countryName || origin?.countryCode || 'the origin country'} as the country filter.`
                                        : 'Keep results in the same country as the selected city or runtime location when possible.'}
                                </div>
                            </div>
                            <Switch
                                checked={filters.sameCountryOnly}
                                onCheckedChange={(checked) => onFiltersChange({ sameCountryOnly: Boolean(checked) })}
                                aria-label="Same-country only"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleUseRuntimeLocation()}
                        >
                            <MapPin />
                            Use runtime location
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (!filters.lookupActive) {
                                    onFiltersChange({ lookupActive: true });
                                }
                                manualLookupInFlightRef.current = true;
                                void handleLookup({ force: true });
                            }}
                            disabled={lookupLoading}
                            aria-busy={lookupLoading || undefined}
                        >
                            {lookupLoading ? <SpinnerGap className="animate-spin" /> : <AirplaneTakeoff />}
                            Lookup nearby airports
                        </Button>
                    </div>

                    {origin && (
                        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground">
                            <div className="text-xs font-medium text-muted-foreground">Origin</div>
                            <div className="mt-0.5 font-medium">{origin.label}</div>
                            <div className="text-xs tabular-nums text-muted-foreground">
                                {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                                {origin.countryCode ? ` · ${origin.countryCode}` : ''}
                            </div>
                        </div>
                    )}

                    {lookupError && <AdminErrorAlert message={lookupError} />}

                    {displayLookupResult && (
                        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-foreground">Nearest airports</div>
                                <div className="text-xs text-muted-foreground">Data version {displayLookupResult.dataVersion}</div>
                            </div>
                            {displayLookupResult.airports.length === 0 && (
                                <p className="text-sm text-muted-foreground">No airports match these filters. Widen the passenger filter or raise the limit.</p>
                            )}
                            <ol className="flex flex-col gap-2">
                                {displayLookupResult.airports.map((entry) => (
                                    <li key={`${entry.airport.ident}-${entry.rank}`} className="rounded-md border border-border bg-muted/50 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-foreground">
                                                    {entry.rank}. {entry.airport.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {(entry.airport.iataCode || entry.airport.icaoCode || entry.airport.ident)} · {entry.airport.municipality || 'Unknown city'} · {entry.airport.countryName}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-sm font-medium tabular-nums text-foreground">{formatDistance(entry.airDistanceKm)}</div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <Badge variant="outline">{formatServiceTierLabel(entry.airport.commercialServiceTier)}</Badge>
                                            <Badge variant="outline">{formatAirportTypeLabel(entry.airport.airportType)}</Badge>
                                            {entry.airport.timezone && (
                                                <Badge variant="outline">{entry.airport.timezone}</Badge>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>

                {mapVisible ? <AdminAirportTesterMap origin={origin} result={displayLookupResult} /> : <div aria-hidden="true" />}
            </div>
        </AdminSurfaceCard>
    );
};

/**
 * The bulk editor, opened from the selection bar. It used to be a permanent
 * panel above the table with four always-zero tiles; now it only exists while
 * rows are selected, and the tier breakdown is one line.
 */
const AdminAirportBulkEditDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedAirports: AirportReference[];
    isApplying: boolean;
    /** Resolves true when the edit was applied (then the dialog closes). */
    onApply: (patch: AdminAirportBulkUpdatePatch) => Promise<boolean>;
}> = ({ open, onOpenChange, selectedAirports, isApplying, onApply }) => {
    const [choices, setChoices] = useState<AirportBulkEditChoices>(EMPTY_AIRPORT_BULK_EDIT);
    const bulkPatch = useMemo(() => buildAirportBulkPatch(choices), [choices]);
    const tiers = useMemo(() => summarizeAirportServiceTiers(selectedAirports), [selectedAirports]);
    const selectedCount = selectedAirports.length;

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) setChoices(EMPTY_AIRPORT_BULK_EDIT);
        onOpenChange(nextOpen);
    };

    const handleApply = async () => {
        if (!bulkPatch) return;
        const applied = await onApply(bulkPatch);
        if (applied) handleOpenChange(false);
    };

    const patchChoices = (patch: Partial<AirportBulkEditChoices>) => setChoices((current) => ({ ...current, ...patch }));

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent size="md" showCloseButton closeLabel="Close bulk edit">
                <DialogHeader divided>
                    <DialogTitle>Bulk edit {selectedCount.toLocaleString()} airport{selectedCount === 1 ? '' : 's'}</DialogTitle>
                    <DialogDescription>
                        <span className="tabular-nums">{tiers.major} major · {tiers.regional} regional · {tiers.local} local</span>.
                        {' '}Fields left unchanged keep each airport&apos;s own value.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-3 py-4">
                    <div className="flex flex-col gap-1.5">
                        <div id="admin-airports-bulk-airport-type-label" className={ADMIN_FIELD_LABEL_CLASS}>Airport type</div>
                        <Select value={choices.airportType} onValueChange={(value) => patchChoices({ airportType: value as BulkAirportTypeOption })}>
                            <SelectTrigger aria-labelledby="admin-airports-bulk-airport-type-label" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BULK_AIRPORT_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div id="admin-airports-bulk-scheduled-service-label" className={ADMIN_FIELD_LABEL_CLASS}>Scheduled service</div>
                        <Select value={choices.scheduledService} onValueChange={(value) => patchChoices({ scheduledService: value as BulkScheduledServiceOption })}>
                            <SelectTrigger aria-labelledby="admin-airports-bulk-scheduled-service-label" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BULK_SCHEDULED_SERVICE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div id="admin-airports-bulk-timezone-mode-label" className={ADMIN_FIELD_LABEL_CLASS}>Timezone action</div>
                        <Select value={choices.timezoneMode} onValueChange={(value) => patchChoices({ timezoneMode: value as BulkTimezoneMode })}>
                            <SelectTrigger aria-labelledby="admin-airports-bulk-timezone-mode-label" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BULK_TIMEZONE_MODE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {choices.timezoneMode === 'set' && (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="admin-airports-bulk-timezone-value" className={ADMIN_FIELD_LABEL_CLASS}>Timezone value</label>
                            <Input
                                id="admin-airports-bulk-timezone-value"
                                value={choices.timezoneValue}
                                onChange={(event) => patchChoices({ timezoneValue: event.target.value })}
                                placeholder="Europe/Berlin"
                            />
                        </div>
                    )}
                </DialogBody>
                <DialogFooter>
                    {!bulkPatch && <span className="me-auto text-xs text-muted-foreground">Choose at least one change.</span>}
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                    <Button
                        type="button"
                        onClick={() => void handleApply()}
                        disabled={!bulkPatch || isApplying}
                        aria-busy={isApplying || undefined}
                        {...getAnalyticsDebugAttributes('admin__airports--bulk_apply')}
                    >
                        {isApplying ? <SpinnerGap className="animate-spin" /> : <FloppyDisk />}
                        Apply bulk edit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/** A field label + control pair for the airport editor sheet. */
const EditorField: React.FC<{ htmlFor?: string; labelId?: string; label: string; className?: string; children: React.ReactNode }> = ({
    htmlFor,
    labelId,
    label,
    className,
    children,
}) => (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        {htmlFor
            ? <label htmlFor={htmlFor} className={ADMIN_FIELD_LABEL_CLASS}>{label}</label>
            : <div id={labelId} className={ADMIN_FIELD_LABEL_CLASS} aria-hidden={labelId ? undefined : true}>{label}</div>}
        {children}
    </div>
);

const TIER_TONE: Record<AirportCommercialServiceTier, 'success' | 'info' | 'neutral'> = {
    major: 'success',
    regional: 'info',
    local: 'neutral',
};

export const AdminAirportsPage: React.FC = () => {
    const { confirm: confirmDialog } = useAppDialog();
    const [searchParams, setSearchParams] = useSearchParams();
    const [catalog, setCatalog] = useState<AdminAirportCatalogResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AdminAirportsTab>(() => resolveAdminAirportsTab(searchParams));
    // The tester mounts the first time its tab (or the ticket lab, which reads
    // its result) opens, then stays mounted so the lookup survives tab switches.
    // Until then the catalog tab loads no maps and asks for no location.
    const [testerMounted, setTesterMounted] = useState(() => resolveAdminAirportsTab(searchParams) !== 'catalog');
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const deferredSearchValue = useDeferredValue(searchValue);
    const [countryFilter, setCountryFilter] = useState(() => normalizeProfileCountryCode(searchParams.get('country')));
    const [serviceTierFilter, setServiceTierFilter] = useState<AirportTableTierFilter>(() => parseAirportTableTierFilter(searchParams.get('catalogTier')));
    const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
    const [testerFilters, setTesterFilters] = useState<AdminAirportTesterFilters>(() => buildAdminAirportTesterFiltersFromSearchParams(searchParams));
    const [selectedAirportIdents, setSelectedAirportIdents] = useState<Set<string>>(() => new Set());
    const [selectedAirportIdent, setSelectedAirportIdent] = useState<string | null>(null);
    const [editorDraft, setEditorDraft] = useState<AirportEditorDraft | null>(null);
    const [editorDirty, setEditorDirty] = useState(false);
    const [editorMode, setEditorMode] = useState<'edit' | 'create'>('edit');
    const [ticketTesterOrigin, setTicketTesterOrigin] = useState<TesterOrigin | null>(null);
    const [ticketTesterResult, setTicketTesterResult] = useState<NearbyAirportsResponse | null>(null);
    const selectedAirportIdentRef = useRef<string | null>(null);
    // `?airport=<ident>` opens that airport's sheet once the catalog arrives.
    const pendingAirportParamRef = useRef<string | null>(searchParams.get('airport'));
    const runtimeTesterBootstrapAttemptedRef = useRef(false);
    const resizeStateRef = useRef<{
        columnId: AirportTableColumnId;
        startX: number;
        startWidth: number;
    } | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<AirportTableColumnId, number>>(AIRPORT_COLUMN_WIDTH_DEFAULT);
    const editorOpen = editorDraft !== null;

    useEffect(() => {
        selectedAirportIdentRef.current = selectedAirportIdent;
    }, [selectedAirportIdent]);

    const beginColumnResize = useCallback((columnId: AirportTableColumnId, clientX: number) => {
        resizeStateRef.current = {
            columnId,
            startX: clientX,
            startWidth: columnWidths[columnId],
        };

        const onPointerMove = (event: MouseEvent) => {
            if (!resizeStateRef.current) return;
            const resizeState = resizeStateRef.current;
            const delta = event.clientX - resizeState.startX;
            const minWidth = AIRPORT_COLUMN_WIDTH_MIN[resizeState.columnId];
            const nextWidth = Math.max(minWidth, Math.round(resizeState.startWidth + delta));
            setColumnWidths((current) => (
                current[resizeState.columnId] === nextWidth
                    ? current
                    : {
                        ...current,
                        [resizeState.columnId]: nextWidth,
                    }
            ));
        };

        const onPointerUp = () => {
            resizeStateRef.current = null;
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('mouseup', onPointerUp);
        };

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
    }, [columnWidths]);

    // Keyboard counterpart of the drag handle, so column resizing is not mouse-only.
    const nudgeColumnWidth = useCallback((columnId: AirportTableColumnId, delta: number) => {
        setColumnWidths((current) => {
            const nextWidth = Math.max(AIRPORT_COLUMN_WIDTH_MIN[columnId], current[columnId] + delta);
            return current[columnId] === nextWidth ? current : { ...current, [columnId]: nextWidth };
        });
    }, []);

    /** Puts the catalog in state and re-points the open sheet (if any) at the fresh row. */
    const applyCatalog = useCallback((nextCatalog: AdminAirportCatalogResponse, preferredIdent: string | null) => {
        const sortedAirports = sortAirports(nextCatalog.airports);
        const nextSelectedAirport = resolveSelectedAirport(sortedAirports, preferredIdent);
        setCatalog({
            ...nextCatalog,
            airports: sortedAirports,
        });
        setSelectedAirportIdents((current) => {
            const validIdents = new Set<string>(sortedAirports.map((airport) => airport.ident));
            const next = new Set<string>();
            current.forEach((ident) => { if (validIdents.has(ident)) next.add(ident); });
            return next;
        });
        setSelectedAirportIdent(nextSelectedAirport?.ident || null);
        setEditorDraft(nextSelectedAirport ? airportToDraft(nextSelectedAirport) : null);
        setEditorDirty(false);
        setEditorMode('edit');
    }, []);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const nextCatalog = await adminGetAirportCatalog();
            const preferredIdent = selectedAirportIdentRef.current ?? pendingAirportParamRef.current;
            pendingAirportParamRef.current = null;
            applyCatalog(nextCatalog, preferredIdent);
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not load airport catalog.', 'admin-airports'));
        } finally {
            setLoading(false);
        }
    }, [applyCatalog]);

    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);

    const selectedAirport = useMemo(
        () => catalog?.airports.find((airport) => airport.ident === selectedAirportIdent) || null,
        [catalog?.airports, selectedAirportIdent],
    );

    const filteredAirports = useMemo(() => {
        const normalizedSearch = deferredSearchValue.trim().toLowerCase();
        return (catalog?.airports || []).filter((airport) => {
            if (countryFilter && airport.countryCode !== countryFilter) return false;
            if (serviceTierFilter !== 'all' && airport.commercialServiceTier !== serviceTierFilter) return false;
            if (!normalizedSearch) return true;

            return [
                airport.ident,
                airport.iataCode || '',
                airport.icaoCode || '',
                airport.name,
                airport.municipality || '',
                airport.subdivisionName || '',
                airport.countryName,
                airport.countryCode,
            ].join(' ').toLowerCase().includes(normalizedSearch);
        });
    }, [catalog?.airports, countryFilter, deferredSearchValue, serviceTierFilter]);

    const pageCount = Math.max(1, Math.ceil(filteredAirports.length / AIRPORT_TABLE_PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const pagedAirports = useMemo(
        () => filteredAirports.slice((safePage - 1) * AIRPORT_TABLE_PAGE_SIZE, safePage * AIRPORT_TABLE_PAGE_SIZE),
        [filteredAirports, safePage],
    );
    const selectedAirports = useMemo(
        () => (catalog?.airports || []).filter((airport) => selectedAirportIdents.has(airport.ident)),
        [catalog?.airports, selectedAirportIdents],
    );
    const areAllVisibleAirportsSelected = pagedAirports.length > 0 && pagedAirports.every((airport) => selectedAirportIdents.has(airport.ident));
    const isVisibleAirportSelectionPartial = pagedAirports.some((airport) => selectedAirportIdents.has(airport.ident)) && !areAllVisibleAirportsSelected;
    const allFilteredSelected = filteredAirports.length > 0 && filteredAirports.every((airport) => selectedAirportIdents.has(airport.ident));

    useEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [page, safePage]);

    // URL → state, for back/forward and pasted links.
    useEffect(() => {
        const nextSearchValue = searchParams.get('q') || '';
        const nextCountryFilter = normalizeProfileCountryCode(searchParams.get('country'));
        const nextServiceTierFilter = parseAirportTableTierFilter(searchParams.get('catalogTier'));
        const nextPage = parsePositivePage(searchParams.get('page'));
        const nextTesterFilters = buildAdminAirportTesterFiltersFromSearchParams(searchParams);
        const nextTab = resolveAdminAirportsTab(searchParams);

        if (searchValue !== nextSearchValue) {
            setSearchValue(nextSearchValue);
        }
        if (countryFilter !== nextCountryFilter) {
            setCountryFilter(nextCountryFilter);
        }
        if (serviceTierFilter !== nextServiceTierFilter) {
            setServiceTierFilter(nextServiceTierFilter);
        }
        if (page !== nextPage) {
            setPage(nextPage);
        }
        if (!areAdminAirportTesterFiltersEqual(testerFilters, nextTesterFilters)) {
            setTesterFilters(nextTesterFilters);
        }
        if (activeTab !== nextTab) {
            setActiveTab(nextTab);
            if (nextTab !== 'catalog') setTesterMounted(true);
        }
    }, [searchParams]);

    // Runtime location is the tester's default origin; fetch it only once the
    // tester is actually open.
    useEffect(() => {
        if (!testerMounted || runtimeTesterBootstrapAttemptedRef.current) return;
        if (hasNearbyTesterQueryState(searchParams)) {
            runtimeTesterBootstrapAttemptedRef.current = true;
            return;
        }

        runtimeTesterBootstrapAttemptedRef.current = true;
        void (async () => {
            const snapshot = await ensureRuntimeLocationLoaded();
            const latitude = snapshot.location.latitude;
            const longitude = snapshot.location.longitude;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

            const runtimeDefaultFilters: AdminAirportTesterFilters = {
                cityQuery: formatRuntimeLocationTesterLabel(snapshot.location),
                latitudeInput: String(latitude),
                longitudeInput: String(longitude),
                limitInput: DEFAULT_ADMIN_AIRPORT_TESTER_LIMIT,
                minimumServiceTier: DEFAULT_ADMIN_AIRPORT_TESTER_SERVICE_TIER,
                countryFilter: '',
                sameCountryOnly: false,
                lookupActive: true,
            };

            setTesterFilters((current) => {
                const currentHasExplicitValue = Boolean(current.cityQuery.trim())
                    || Boolean(current.latitudeInput.trim())
                    || Boolean(current.longitudeInput.trim())
                    || current.limitInput.trim() !== DEFAULT_ADMIN_AIRPORT_TESTER_LIMIT
                    || current.minimumServiceTier !== DEFAULT_ADMIN_AIRPORT_TESTER_SERVICE_TIER
                    || current.lookupActive
                    || Boolean(current.countryFilter)
                    || current.sameCountryOnly;
                if (currentHasExplicitValue) return current;
                return areAdminAirportTesterFiltersEqual(current, runtimeDefaultFilters)
                    ? current
                    : runtimeDefaultFilters;
            });
        })();
    }, [searchParams, testerMounted]);

    // State → URL, so every filter, the tab and the open airport survive a reload.
    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        const trimmedNearbyCity = testerFilters.cityQuery.trim();
        const trimmedNearbyLat = testerFilters.latitudeInput.trim();
        const trimmedNearbyLng = testerFilters.longitudeInput.trim();
        const trimmedNearbyLimit = testerFilters.limitInput.trim();

        if (trimmedSearch) next.set('q', trimmedSearch);
        if (countryFilter) next.set('country', countryFilter);
        if (serviceTierFilter !== 'all') next.set('catalogTier', serviceTierFilter);
        if (safePage > 1) next.set('page', String(safePage));
        if (trimmedNearbyCity) next.set('nearbyCity', trimmedNearbyCity);
        if (trimmedNearbyLat) next.set('nearbyLat', trimmedNearbyLat);
        if (trimmedNearbyLng) next.set('nearbyLng', trimmedNearbyLng);
        if (trimmedNearbyLimit && trimmedNearbyLimit !== DEFAULT_ADMIN_AIRPORT_TESTER_LIMIT) next.set('nearbyLimit', trimmedNearbyLimit);
        if (testerFilters.minimumServiceTier !== DEFAULT_ADMIN_AIRPORT_TESTER_SERVICE_TIER) next.set('nearbyTier', testerFilters.minimumServiceTier);
        if (testerFilters.countryFilter) next.set('nearbyCountry', testerFilters.countryFilter);
        if (testerFilters.sameCountryOnly) next.set('nearbySameCountry', '1');
        if (testerFilters.lookupActive) next.set('nearbyLookup', '1');
        // Name the tab whenever leaving it out would resolve differently:
        // tester parameters alone open the tester (older shared links).
        if (activeTab !== 'catalog' || hasNearbyTesterQueryState(next)) next.set('tab', activeTab);
        if (editorOpen && editorMode === 'edit' && selectedAirportIdent) next.set('airport', selectedAirportIdent);
        else if (pendingAirportParamRef.current) next.set('airport', pendingAirportParamRef.current);

        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        activeTab,
        countryFilter,
        editorMode,
        editorOpen,
        safePage,
        searchParams,
        searchValue,
        selectedAirportIdent,
        serviceTierFilter,
        setSearchParams,
        testerFilters,
    ]);

    const handleTabChange = useCallback((value: string) => {
        const nextTab = (ADMIN_AIRPORTS_TABS as readonly string[]).includes(value) ? value as AdminAirportsTab : 'catalog';
        setActiveTab(nextTab);
        if (nextTab !== 'catalog') setTesterMounted(true);
        trackEvent('admin__airports--tab', { tab: nextTab });
    }, []);

    const confirmDiscardEdits = useCallback(async (message: string): Promise<boolean> => {
        if (!editorDirty) return true;
        return confirmDialog({
            title: 'Discard unsaved airport edits?',
            message,
            confirmLabel: 'Discard changes',
            cancelLabel: 'Keep editing',
            tone: 'danger',
        });
    }, [confirmDialog, editorDirty]);

    const handleOpenAirport = useCallback(async (ident: string) => {
        if (editorOpen && ident === selectedAirportIdent) return;
        if (!(await confirmDiscardEdits('Opening another airport will discard your unsaved changes.'))) return;
        const nextAirport = catalog?.airports.find((airport) => airport.ident === ident) || null;
        setSelectedAirportIdent(ident);
        setEditorDraft(nextAirport ? airportToDraft(nextAirport) : null);
        setEditorDirty(false);
        setEditorMode('edit');
        trackEvent('admin__airports--open_airport');
    }, [catalog?.airports, confirmDiscardEdits, editorOpen, selectedAirportIdent]);

    const closeEditor = useCallback(() => {
        setSelectedAirportIdent(null);
        setEditorDraft(null);
        setEditorDirty(false);
        setEditorMode('edit');
    }, []);

    const handleEditorOpenChange = useCallback(async (open: boolean) => {
        if (open) return;
        if (!(await confirmDiscardEdits('Closing the editor will discard your unsaved airport changes.'))) return;
        closeEditor();
    }, [closeEditor, confirmDiscardEdits]);

    const handleTesterContextChange = useCallback((context: { origin: TesterOrigin | null; lookupResult: NearbyAirportsResponse | null }) => {
        setTicketTesterOrigin(context.origin);
        setTicketTesterResult(context.lookupResult);
    }, []);

    const handleTesterFiltersChange = useCallback((patch: Partial<AdminAirportTesterFilters>) => {
        setTesterFilters((current) => ({
            ...current,
            ...patch,
        }));
    }, []);

    const handleSearchValueChange = useCallback((value: string) => {
        setSearchValue(value);
        setPage(1);
    }, []);

    const handleCountryFilterChange = useCallback((value: string) => {
        setCountryFilter(value);
        setPage(1);
    }, []);

    const handleServiceTierFilterChange = useCallback((value: string) => {
        setServiceTierFilter(value as AirportTableTierFilter);
        setPage(1);
    }, []);

    const hasActiveCatalogFilter = Boolean(countryFilter) || serviceTierFilter !== 'all' || searchValue.trim() !== '';
    const handleResetCatalogFilters = useCallback(() => {
        setCountryFilter('');
        setServiceTierFilter('all');
        setSearchValue('');
        setPage(1);
        trackEvent('admin__airports--reset_filters');
    }, []);

    const toggleAirportSelection = useCallback((ident: string, checked: boolean) => {
        setSelectedAirportIdents((current) => {
            const next = new Set(current);
            if (checked) next.add(ident);
            else next.delete(ident);
            return next;
        });
    }, []);

    const toggleSelectAllVisibleAirports = useCallback((checked: boolean) => {
        setSelectedAirportIdents((current) => {
            const next = new Set(current);
            pagedAirports.forEach((airport) => {
                if (checked) next.add(airport.ident);
                else next.delete(airport.ident);
            });
            return next;
        });
    }, [pagedAirports]);

    const handleSelectFilteredAirports = useCallback(() => {
        setSelectedAirportIdents(new Set(filteredAirports.map((airport) => airport.ident)));
        trackEvent('admin__airports--select_all_matching', { count: filteredAirports.length });
    }, [filteredAirports]);

    const handleClearAirportSelection = useCallback(() => {
        setSelectedAirportIdents(new Set());
    }, []);

    const handleSyncCatalog = useCallback(async () => {
        const sources = catalog?.metadata?.sources;
        const shouldSync = await confirmDialog({
            title: 'Sync airports from upstream sources?',
            message: `This will replace the database airport catalog with a fresh generated snapshot from the configured free upstream feeds${sources ? ` (${sources.primary} · ${sources.enrichment})` : ''}.`,
            confirmLabel: 'Sync now',
            cancelLabel: 'Cancel',
        });
        if (!shouldSync) return;
        trackEvent('admin__airports--sync');

        const loadingToastId = showAppToast({
            title: 'Syncing airports',
            description: 'Fetching upstream airport sources and replacing the database catalog.',
            tone: 'loading',
        });

        setSyncing(true);
        try {
            const nextCatalog = await adminSyncAirportCatalog();
            applyCatalog(nextCatalog, null);
            showAppToast({
                id: loadingToastId,
                title: 'Airport sync finished',
                description: `Loaded ${nextCatalog.airports.length} commercial airports into the database catalog.`,
                tone: 'add',
            });
        } catch (error) {
            showAppToast({
                id: loadingToastId,
                title: 'Airport sync failed',
                description: toAdminErrorMessage(error, 'Could not sync the airport catalog.', 'admin-airports'),
                tone: 'remove',
            });
        } finally {
            setSyncing(false);
        }
    }, [applyCatalog, catalog?.metadata?.sources, confirmDialog]);

    const handleStartCreateAirport = useCallback(async () => {
        if (!(await confirmDiscardEdits('Starting a new airport draft will discard the current unsaved changes.'))) return;

        setSelectedAirportIdent(null);
        setEditorDraft(buildEmptyAirportDraft());
        setEditorDirty(false);
        setEditorMode('create');
        trackEvent('admin__airports--new_airport');
    }, [confirmDiscardEdits]);

    const handleSaveAirport = useCallback(async () => {
        if (!editorDraft) return;
        const airport = draftToAirport(editorDraft);
        if (!airport) {
            showAppToast({
                title: 'Airport details are invalid',
                description: 'Check the required fields and make sure latitude and longitude are valid numbers.',
                tone: 'remove',
            });
            return;
        }

        if (editorMode === 'create' && catalog?.airports.some((entry) => entry.ident === airport.ident)) {
            showAppToast({
                title: 'Airport ident already exists',
                description: 'Choose a unique ident before creating a new airport row.',
                tone: 'remove',
            });
            return;
        }

        const loadingToastId = showAppToast({
            title: editorMode === 'create' ? 'Creating airport' : 'Saving airport',
            description: editorMode === 'create'
                ? `Creating ${airport.ident} in the database catalog.`
                : `Updating ${airport.ident} in the database catalog.`,
            tone: 'loading',
        });

        setSaving(true);
        try {
            const updatedAirport = editorMode === 'create'
                ? await adminCreateAirportCatalogRecord(airport)
                : await adminUpdateAirportCatalogRecord(airport);
            setCatalog((current) => {
                if (!current) return current;
                return {
                    ...current,
                    airports: sortAirports(
                        editorMode === 'create'
                            ? [...current.airports, updatedAirport]
                            : current.airports.map((entry) => entry.ident === updatedAirport.ident ? updatedAirport : entry),
                    ),
                };
            });
            setSelectedAirportIdent(updatedAirport.ident);
            setEditorDraft(airportToDraft(updatedAirport));
            setEditorDirty(false);
            setEditorMode('edit');
            trackEvent(editorMode === 'create' ? 'admin__airports--create_airport' : 'admin__airports--save_airport');
            showAppToast({
                id: loadingToastId,
                title: editorMode === 'create' ? 'Airport created' : 'Airport saved',
                description: editorMode === 'create'
                    ? `${updatedAirport.name} was added to the catalog.`
                    : `${updatedAirport.name} was updated successfully.`,
                tone: 'add',
            });
        } catch (error) {
            showAppToast({
                id: loadingToastId,
                title: editorMode === 'create' ? 'Airport create failed' : 'Airport save failed',
                description: toAdminErrorMessage(error, (editorMode === 'create' ? 'Could not create the airport.' : 'Could not update the airport.'), 'admin-airports'),
                tone: 'remove',
            });
        } finally {
            setSaving(false);
        }
    }, [catalog?.airports, editorDraft, editorMode]);

    /** Resolves true when the patch was applied; false when cancelled or failed. */
    const handleBulkUpdateAirports = useCallback(async (patch: AdminAirportBulkUpdatePatch): Promise<boolean> => {
        if (!catalog || selectedAirportIdents.size === 0) return false;

        const selectedCount = selectedAirportIdents.size;
        const shouldApply = await confirmDialog({
            title: 'Apply bulk airport edits?',
            message: `Update ${selectedCount} selected airport row${selectedCount === 1 ? '' : 's'} with the current bulk edit settings?`,
            confirmLabel: 'Apply bulk edit',
            cancelLabel: 'Cancel',
        });
        if (!shouldApply) return false;

        const loadingToastId = showAppToast({
            title: 'Applying bulk airport edits',
            description: `Updating ${selectedCount} selected airport row${selectedCount === 1 ? '' : 's'}.`,
            tone: 'loading',
        });

        setBulkSaving(true);
        try {
            const updatedAirports = await adminBulkUpdateAirportCatalogRecords({
                idents: Array.from(selectedAirportIdents),
                patch,
            });
            const updatedByIdent = new Map(updatedAirports.map((airport) => [airport.ident, airport] as const));
            const nextAirports = sortAirports(catalog.airports.map((airport) => updatedByIdent.get(airport.ident) || airport));

            setCatalog((current) => current ? {
                ...current,
                airports: nextAirports,
                metadata: current.metadata
                    ? {
                        ...current.metadata,
                        syncedAt: new Date().toISOString(),
                    }
                    : current.metadata,
            } : current);
            trackEvent('admin__airports--bulk_apply', { count: updatedAirports.length });
            showAppToast({
                id: loadingToastId,
                title: 'Bulk airport edit finished',
                description: `Updated ${updatedAirports.length} airport row${updatedAirports.length === 1 ? '' : 's'}.`,
                tone: 'add',
            });
            return true;
        } catch (error) {
            showAppToast({
                id: loadingToastId,
                title: 'Bulk airport edit failed',
                description: toAdminErrorMessage(error, 'Bulk airport update failed.', 'admin-airports'),
                tone: 'remove',
            });
            return false;
        } finally {
            setBulkSaving(false);
        }
    }, [catalog, confirmDialog, selectedAirportIdents]);

    const handleDeleteSelectedAirports = useCallback(async () => {
        if (!catalog || selectedAirportIdents.size === 0) return;

        const deleteCount = selectedAirportIdents.size;
        const shouldDelete = await confirmDialog({
            title: 'Delete selected airports?',
            message: `Remove ${deleteCount} selected airport row${deleteCount === 1 ? '' : 's'} from the database catalog?`,
            confirmLabel: 'Delete airports',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!shouldDelete) return;
        trackEvent('admin__airports--bulk_delete', { count: deleteCount });

        const loadingToastId = showAppToast({
            title: 'Deleting airports',
            description: `Removing ${deleteCount} selected airport row${deleteCount === 1 ? '' : 's'}.`,
            tone: 'loading',
        });

        setBulkDeleting(true);
        try {
            const deletedIdents = await adminDeleteAirportCatalogRecords(Array.from(selectedAirportIdents));
            const deletedIdentSet = new Set(deletedIdents);
            const nextAirports = sortAirports(catalog.airports.filter((airport) => !deletedIdentSet.has(airport.ident)));

            setCatalog((current) => current ? {
                ...current,
                airports: nextAirports,
                metadata: current.metadata
                    ? {
                        ...current.metadata,
                        syncedAt: new Date().toISOString(),
                    }
                    : current.metadata,
            } : current);
            setSelectedAirportIdents(new Set());
            showAppToast({
                id: loadingToastId,
                title: 'Airports deleted',
                description: `Removed ${deletedIdents.length} airport row${deletedIdents.length === 1 ? '' : 's'} from the catalog.`,
                tone: 'add',
            });
        } catch (error) {
            showAppToast({
                id: loadingToastId,
                title: 'Airport delete failed',
                description: toAdminErrorMessage(error, 'Could not delete the selected airports.', 'admin-airports'),
                tone: 'remove',
            });
        } finally {
            setBulkDeleting(false);
        }
    }, [catalog, confirmDialog, selectedAirportIdents]);

    /** Deletes one airport, from its row menu or from the open editor. */
    const handleDeleteAirport = useCallback(async (airport: AirportReference) => {
        if (!catalog) return;
        const isOpenInEditor = editorOpen && selectedAirportIdent === airport.ident;

        if (isOpenInEditor && !(await confirmDiscardEdits('Deleting this airport will discard the current unsaved changes.'))) return;

        const shouldDelete = await confirmDialog({
            title: 'Delete this airport?',
            message: `Remove ${airport.name} from the database catalog?`,
            confirmLabel: 'Delete airport',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!shouldDelete) return;
        trackEvent('admin__airports--delete_airport');

        const loadingToastId = showAppToast({
            title: 'Deleting airport',
            description: `Removing ${airport.ident} from the catalog.`,
            tone: 'loading',
        });

        setDeleting(true);
        try {
            const deletedIdents = await adminDeleteAirportCatalogRecords([airport.ident]);
            const deletedIdentSet = new Set(deletedIdents);
            const nextAirports = sortAirports(catalog.airports.filter((entry) => !deletedIdentSet.has(entry.ident)));

            setCatalog((current) => current ? {
                ...current,
                airports: nextAirports,
                metadata: current.metadata
                    ? {
                        ...current.metadata,
                        syncedAt: new Date().toISOString(),
                    }
                    : current.metadata,
            } : current);
            setSelectedAirportIdents((current) => {
                const next = new Set(current);
                deletedIdents.forEach((ident) => next.delete(ident));
                return next;
            });
            if (isOpenInEditor) closeEditor();
            showAppToast({
                id: loadingToastId,
                title: 'Airport deleted',
                description: `${airport.name} was removed from the catalog.`,
                tone: 'add',
            });
        } catch (error) {
            showAppToast({
                id: loadingToastId,
                title: 'Airport delete failed',
                description: toAdminErrorMessage(error, 'Could not delete the airport.', 'admin-airports'),
                tone: 'remove',
            });
        } finally {
            setDeleting(false);
        }
    }, [catalog, closeEditor, confirmDialog, confirmDiscardEdits, editorOpen, selectedAirportIdent]);

    const databaseBacked = catalog?.source === 'database';
    const catalogSource = catalog ? describeCatalogSource(catalog.source, catalog.databaseAvailable) : null;
    const editorPreviewAirport = editorDraft ? draftToAirport(editorDraft) : selectedAirport;
    const metadata = catalog?.metadata;

    const updateDraft = (patch: Partial<AirportEditorDraft>) => {
        setEditorDraft((current) => current ? { ...current, ...patch } : current);
        setEditorDirty(true);
    };

    const renderResizableHead = (columnId: AirportTableColumnId, label: string) => (
        <TableHead className="relative text-start text-muted-foreground">
            {label}
            <button
                type="button"
                onMouseDown={(event) => {
                    event.preventDefault();
                    beginColumnResize(columnId, event.clientX);
                }}
                onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                    event.preventDefault();
                    nudgeColumnWidth(columnId, event.key === 'ArrowRight' ? 16 : -16);
                }}
                className="absolute inset-y-0 end-0 w-2 cursor-col-resize outline-none hover:bg-border focus-visible:bg-ring/50"
                aria-label={`Resize ${label.toLowerCase()} column`}
                data-tooltip="Drag or use arrow keys to resize"
            />
        </TableHead>
    );

    return (
        <AdminShell
            title="Airports"
            description="Maintain the commercial airport catalog behind nearby-airport lookups, and test those lookups."
            searchValue={searchValue}
            onSearchValueChange={handleSearchValueChange}
            // The search filters the catalog table; the other tabs have their own inputs.
            showGlobalSearch={activeTab === 'catalog'}
            showDateRange={false}
            actions={(
                <>
                    <AdminReloadButton onClick={() => void loadCatalog()} isLoading={loading} label="Reload catalog" />
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label="More catalog actions" data-tooltip="More catalog actions">
                                {syncing ? <SpinnerGap className="animate-spin" /> : <DotsThreeVertical weight="bold" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[220px]">
                            <DropdownMenuItem
                                disabled={syncing}
                                onSelect={() => void handleSyncCatalog()}
                                {...getAnalyticsDebugAttributes('admin__airports--sync')}
                            >
                                <ArrowsClockwise /> Sync from upstream
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        type="button"
                        onClick={() => void handleStartCreateAirport()}
                        {...getAnalyticsDebugAttributes('admin__airports--new_airport')}
                    >
                        <Plus />
                        New airport
                    </Button>
                </>
            )}
        >
            <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
                <TabsList variant="line" className="w-full justify-start">
                    <TabsTrigger value="catalog" {...getAnalyticsDebugAttributes('admin__airports--tab', { tab: 'catalog' })}>
                        Catalog
                        {catalog && <span className="tabular-nums font-normal text-muted-foreground">{catalog.airports.length.toLocaleString()}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="tester" {...getAnalyticsDebugAttributes('admin__airports--tab', { tab: 'tester' })}>
                        Nearby tester
                    </TabsTrigger>
                    <TabsTrigger value="ticket" {...getAnalyticsDebugAttributes('admin__airports--tab', { tab: 'ticket' })}>
                        Ticket lab
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="catalog" forceMount className="flex flex-col gap-4 data-[state=inactive]:hidden">
                    {errorMessage && <AdminErrorAlert title="Could not load the airport catalog" message={errorMessage} />}

                    <div className="grid gap-4 sm:grid-cols-3">
                        <AdminStatCard
                            label="Airports in catalog"
                            icon={<Database />}
                            value={catalog ? catalog.airports.length.toLocaleString() : '—'}
                            hint={catalogSource?.hint}
                            hintTone={catalogSource?.tone}
                            isLoading={loading}
                        />
                        <AdminStatCard
                            label="Last synced"
                            icon={<ArrowsClockwise />}
                            value={(
                                <span className="block truncate text-xl" data-tooltip={metadata?.syncedAt ? formatAdminAbsoluteTime(metadata.syncedAt) : undefined}>
                                    {formatAdminRelativeTime(metadata?.syncedAt, Date.now(), '—')}
                                </span>
                            )}
                            hint={metadata?.syncedBy ? `By ${metadata.syncedBy}` : 'Not synced to the database yet.'}
                            isLoading={loading}
                        />
                        <AdminStatCard
                            label="Data version"
                            icon={<Tag />}
                            value={<span className="block truncate text-xl">{metadata?.dataVersion ?? 'Unknown'}</span>}
                            hint={(
                                <span data-tooltip={metadata?.generatedAt ? formatAdminAbsoluteTime(metadata.generatedAt) : undefined}>
                                    Generated {formatAdminRelativeTime(metadata?.generatedAt, Date.now(), 'at an unknown time')}
                                    {metadata?.sources ? ` from ${metadata.sources.primary} · ${metadata.sources.enrichment}` : ''}
                                </span>
                            )}
                            isLoading={loading}
                        />
                    </div>

                    {catalog && !databaseBacked && (
                        <Alert variant="warning">
                            <WarningCircle weight="fill" />
                            <AlertTitle>Edits are off until the database catalog is synced</AlertTitle>
                            <AlertDescription>
                                <p>The page is reading the bundled snapshot. Sync from upstream to load the catalog into the database; saving, bulk edits and deletes then work.</p>
                                <Button type="button" size="sm" className="mt-2" onClick={() => void handleSyncCatalog()} disabled={syncing} aria-busy={syncing || undefined}>
                                    {syncing ? <SpinnerGap className="animate-spin" /> : <ArrowsClockwise />}
                                    Sync from upstream
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-full min-w-0 sm:w-64">
                                <ProfileCountryRegionSelect
                                    value={countryFilter}
                                    ariaLabel="Airport catalog country filter"
                                    placeholder="All countries"
                                    emptyLabel="No matching countries"
                                    toggleLabel="Toggle country filter"
                                    onValueChange={handleCountryFilterChange}
                                />
                            </div>
                            <Select value={serviceTierFilter} onValueChange={handleServiceTierFilterChange}>
                                <SelectTrigger aria-label="Service tier" className="w-auto min-w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All tiers</SelectItem>
                                    {SERVICE_TIER_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {hasActiveCatalogFilter && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetCatalogFilters}
                                    {...getAnalyticsDebugAttributes('admin__airports--reset_filters')}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-border">
                            <Table className="min-w-[900px] table-fixed">
                                <colgroup>
                                    <col style={{ width: 44 }} />
                                    <col style={{ width: `${columnWidths.airport}px` }} />
                                    <col style={{ width: `${columnWidths.location}px` }} />
                                    <col style={{ width: `${columnWidths.tier}px` }} />
                                    <col style={{ width: `${columnWidths.type}px` }} />
                                    <col style={{ width: `${columnWidths.timezone}px` }} />
                                    <col style={{ width: 52 }} />
                                </colgroup>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>
                                            <Checkbox
                                                checked={areAllVisibleAirportsSelected ? true : (isVisibleAirportSelectionPartial ? 'indeterminate' : false)}
                                                onCheckedChange={(checked) => toggleSelectAllVisibleAirports(Boolean(checked))}
                                                aria-label="Select all airports on this page"
                                                disabled={pagedAirports.length === 0}
                                            />
                                        </TableHead>
                                        {renderResizableHead('airport', 'Airport')}
                                        {renderResizableHead('location', 'Location')}
                                        {renderResizableHead('tier', 'Tier')}
                                        {renderResizableHead('type', 'Type')}
                                        {renderResizableHead('timezone', 'Timezone')}
                                        <TableHead><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pagedAirports.map((airport) => (
                                        <TableRow
                                            key={airport.ident}
                                            data-state={selectedAirportIdents.has(airport.ident) || (editorOpen && airport.ident === selectedAirportIdent) ? 'selected' : undefined}
                                            className={cn(ADMIN_TABLE_ROW_SURFACE_CLASS, 'cursor-pointer')}
                                            onClick={() => void handleOpenAirport(airport.ident)}
                                        >
                                            <TableCell onClick={(event) => event.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedAirportIdents.has(airport.ident)}
                                                    onCheckedChange={(checked) => toggleAirportSelection(airport.ident, Boolean(checked))}
                                                    aria-label={`Select ${airport.name}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="truncate font-medium text-foreground" title={airport.name}>{airport.name}</div>
                                                <div className="truncate font-mono text-xs text-muted-foreground">{formatAirportCodes(airport)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="truncate text-foreground">{airport.municipality || 'Unknown city'}</div>
                                                <div className="truncate text-xs text-muted-foreground">{airport.countryName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <AdminStatusBadge tone={TIER_TONE[airport.commercialServiceTier]}>
                                                    {formatServiceTierLabel(airport.commercialServiceTier)}
                                                </AdminStatusBadge>
                                            </TableCell>
                                            <TableCell><div className="truncate">{formatAirportTypeLabel(airport.airportType)}</div></TableCell>
                                            <TableCell><div className="truncate" title={airport.timezone || undefined}>{airport.timezone || '—'}</div></TableCell>
                                            <TableCell className="px-1 text-end" onClick={(event) => event.stopPropagation()}>
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${airport.name}`} data-tooltip="Airport actions">
                                                            <DotsThreeVertical weight="bold" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-[180px]">
                                                        <DropdownMenuItem onSelect={() => void handleOpenAirport(airport.ident)}>
                                                            <PencilSimple /> Edit airport
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => toggleAirportSelection(airport.ident, !selectedAirportIdents.has(airport.ident))}>
                                                            {selectedAirportIdents.has(airport.ident) ? 'Remove from selection' : 'Add to selection'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            disabled={!databaseBacked || deleting}
                                                            onSelect={() => void handleDeleteAirport(airport)}
                                                        >
                                                            <Trash /> Delete airport
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {pagedAirports.length === 0 && (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={7} className="py-6">
                                                {loading ? (
                                                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status">
                                                        <SpinnerGap className="size-4 animate-spin" /> Loading airports…
                                                    </div>
                                                ) : (
                                                    <AdminEmptyState
                                                        className="border-0"
                                                        title={catalog?.airports.length ? 'No airports match these filters' : 'The catalog is empty'}
                                                        description={catalog?.airports.length
                                                            ? 'Search matches codes, names, cities, regions and countries. Reset the filters to see every airport.'
                                                            : 'Sync from upstream to load the commercial airport catalog.'}
                                                        action={hasActiveCatalogFilter ? (
                                                            <Button type="button" variant="outline" size="sm" onClick={handleResetCatalogFilters}>Reset filters</Button>
                                                        ) : undefined}
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <AdminPagination
                            page={safePage}
                            pageSize={AIRPORT_TABLE_PAGE_SIZE}
                            totalItems={filteredAirports.length}
                            onPageChange={setPage}
                            noun="airports"
                        />
                    </AdminSurfaceCard>

                    <AdminSelectionBar count={selectedAirports.length} noun="airport" onClear={handleClearAirportSelection}>
                        {!allFilteredSelected && (
                            <Button type="button" variant="ghost" size="sm" onClick={handleSelectFilteredAirports}>
                                Select all <span className="tabular-nums">{filteredAirports.length.toLocaleString()}</span> matching
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setBulkDialogOpen(true);
                                trackEvent('admin__airports--bulk_edit');
                            }}
                            disabled={!databaseBacked || bulkSaving || bulkDeleting}
                            data-tooltip={databaseBacked ? undefined : 'Sync the database catalog first'}
                            {...getAnalyticsDebugAttributes('admin__airports--bulk_edit')}
                        >
                            <PencilSimple /> Bulk edit
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDeleteSelectedAirports()}
                            disabled={!databaseBacked || bulkDeleting || bulkSaving}
                            aria-busy={bulkDeleting || undefined}
                            data-tooltip={databaseBacked ? undefined : 'Sync the database catalog first'}
                            {...getAnalyticsDebugAttributes('admin__airports--bulk_delete')}
                        >
                            {bulkDeleting ? <SpinnerGap className="animate-spin" /> : <Trash />}
                            Delete selected
                        </Button>
                    </AdminSelectionBar>
                </TabsContent>

                {testerMounted && (
                    <>
                        <TabsContent value="tester" forceMount className="data-[state=inactive]:hidden">
                            <GoogleMapsLoader>
                                <AdminAirportTester
                                    filters={testerFilters}
                                    onFiltersChange={handleTesterFiltersChange}
                                    onLookupContextChange={handleTesterContextChange}
                                    mapVisible={activeTab === 'tester'}
                                />
                            </GoogleMapsLoader>
                        </TabsContent>
                        <TabsContent value="ticket" forceMount className="data-[state=inactive]:hidden">
                            <AdminAirportTicketLab
                                catalogAirports={catalog?.airports || []}
                                origin={ticketTesterOrigin}
                                nearbyResult={ticketTesterResult}
                                onChangeOrigin={() => handleTabChange('tester')}
                            />
                        </TabsContent>
                    </>
                )}
            </Tabs>

            <AdminAirportBulkEditDialog
                open={bulkDialogOpen}
                onOpenChange={setBulkDialogOpen}
                selectedAirports={selectedAirports}
                isApplying={bulkSaving}
                onApply={handleBulkUpdateAirports}
            />

            <AdminDetailSheet
                open={editorOpen}
                onOpenChange={(open) => void handleEditorOpenChange(open)}
                size="md"
                title={editorMode === 'create' ? (editorDraft?.name.trim() || 'New airport') : (selectedAirport?.name || editorDraft?.name || 'Airport')}
                subtitle={editorMode === 'create'
                    ? 'New row in the database catalog'
                    : (selectedAirport ? `${formatAirportCodes(selectedAirport)} · ${[selectedAirport.municipality, selectedAirport.countryName].filter(Boolean).join(', ')}` : undefined)}
                meta={editorPreviewAirport ? (
                    <>
                        <AdminStatusBadge tone={TIER_TONE[editorPreviewAirport.commercialServiceTier]}>{formatServiceTierLabel(editorPreviewAirport.commercialServiceTier)}</AdminStatusBadge>
                        <AdminStatusBadge tone={editorPreviewAirport.isCommercial ? 'success' : 'warning'}>
                            {editorPreviewAirport.isCommercial ? 'In nearby results' : 'Excluded from nearby results'}
                        </AdminStatusBadge>
                    </>
                ) : null}
                footer={editorDraft ? (
                    <>
                        <Button
                            type="button"
                            onClick={() => void handleSaveAirport()}
                            disabled={!databaseBacked || saving || deleting}
                            aria-busy={saving || undefined}
                            {...getAnalyticsDebugAttributes(editorMode === 'create' ? 'admin__airports--create_airport' : 'admin__airports--save_airport')}
                        >
                            {saving ? <SpinnerGap className="animate-spin" /> : <FloppyDisk />}
                            {editorMode === 'create' ? 'Create airport' : 'Save airport'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setEditorDraft(editorMode === 'create' || !selectedAirport
                                    ? buildEmptyAirportDraft()
                                    : airportToDraft(selectedAirport));
                                setEditorDirty(false);
                            }}
                            disabled={!editorDirty}
                        >
                            {editorMode === 'create' ? 'Reset draft' : 'Reset changes'}
                        </Button>
                        {editorMode !== 'create' && selectedAirport && (
                            <Button
                                type="button"
                                variant="destructive"
                                className="ms-auto"
                                onClick={() => void handleDeleteAirport(selectedAirport)}
                                disabled={!databaseBacked || deleting}
                                aria-busy={deleting || undefined}
                                {...getAnalyticsDebugAttributes('admin__airports--delete_airport')}
                            >
                                {deleting ? <SpinnerGap className="animate-spin" /> : <Trash />}
                                Delete airport
                            </Button>
                        )}
                    </>
                ) : undefined}
            >
                {editorDraft && (
                    <>
                        {!databaseBacked && (
                            <Alert variant="warning">
                                <WarningCircle weight="fill" />
                                <AlertDescription><p>Saving is off until the database catalog is synced.</p></AlertDescription>
                            </Alert>
                        )}

                        <section className="flex flex-col gap-3">
                            <AdminSectionHeader as="h3" title="Identity" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <EditorField htmlFor="admin-airports-editor-ident" label="Ident">
                                    <Input
                                        id="admin-airports-editor-ident"
                                        value={editorDraft.ident}
                                        disabled={editorMode !== 'create'}
                                        onChange={(event) => updateDraft({ ident: event.target.value.toUpperCase() })}
                                    />
                                </EditorField>
                                <EditorField labelId="admin-airports-editor-type-label" label="Airport type">
                                    <Select
                                        value={editorDraft.airportType}
                                        onValueChange={(value) => updateDraft({ airportType: value as AirportReference['airportType'] })}
                                    >
                                        <SelectTrigger aria-labelledby="admin-airports-editor-type-label" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {AIRPORT_TYPE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-iata" label="IATA code">
                                    <Input id="admin-airports-editor-iata" value={editorDraft.iataCode} onChange={(event) => updateDraft({ iataCode: event.target.value.toUpperCase() })} />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-icao" label="ICAO code">
                                    <Input id="admin-airports-editor-icao" value={editorDraft.icaoCode} onChange={(event) => updateDraft({ icaoCode: event.target.value.toUpperCase() })} />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-name" label="Airport name" className="sm:col-span-2">
                                    <Input id="admin-airports-editor-name" value={editorDraft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
                                </EditorField>
                            </div>
                        </section>

                        <section className="flex flex-col gap-3">
                            <AdminSectionHeader as="h3" title="Location" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <EditorField htmlFor="admin-airports-editor-municipality" label="Municipality">
                                    <Input id="admin-airports-editor-municipality" value={editorDraft.municipality} onChange={(event) => updateDraft({ municipality: event.target.value })} />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-subdivision" label="Subdivision name">
                                    <Input id="admin-airports-editor-subdivision" value={editorDraft.subdivisionName} onChange={(event) => updateDraft({ subdivisionName: event.target.value })} />
                                </EditorField>
                                <EditorField label="Country or region">
                                    <ProfileCountryRegionSelect
                                        value={editorDraft.countryCode}
                                        ariaLabel="Country or region"
                                        placeholder="Select country or region"
                                        emptyLabel="No matching countries"
                                        toggleLabel="Toggle country options"
                                        onValueChange={(value) => {
                                            setEditorDraft((current) => current ? updateDraftCountry(current, value) : current);
                                            setEditorDirty(true);
                                        }}
                                    />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-region" label="Region code">
                                    <Input id="admin-airports-editor-region" value={editorDraft.regionCode} onChange={(event) => updateDraft({ regionCode: event.target.value.toUpperCase() })} />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-latitude" label="Latitude">
                                    <Input id="admin-airports-editor-latitude" type="number" step="0.000001" className="tabular-nums" value={editorDraft.latitude} onChange={(event) => updateDraft({ latitude: event.target.value })} />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-longitude" label="Longitude">
                                    <Input id="admin-airports-editor-longitude" type="number" step="0.000001" className="tabular-nums" value={editorDraft.longitude} onChange={(event) => updateDraft({ longitude: event.target.value })} />
                                </EditorField>
                                <EditorField htmlFor="admin-airports-editor-timezone" label="Timezone" className="sm:col-span-2">
                                    <Input id="admin-airports-editor-timezone" value={editorDraft.timezone} placeholder="Europe/Berlin" onChange={(event) => updateDraft({ timezone: event.target.value })} />
                                </EditorField>
                            </div>
                        </section>

                        <section className="flex flex-col gap-3">
                            <AdminSectionHeader
                                as="h3"
                                title="Nearby lookups"
                                description="Tier and eligibility follow from the airport type and scheduled service."
                            />
                            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-foreground">Scheduled passenger service</div>
                                    <div className="text-xs text-muted-foreground">Controls whether the airport stays eligible for nearby commercial lookups.</div>
                                </div>
                                <Switch
                                    checked={editorDraft.scheduledService}
                                    onCheckedChange={(checked) => updateDraft({ scheduledService: Boolean(checked) })}
                                    aria-label="Scheduled passenger service"
                                />
                            </div>
                        </section>
                    </>
                )}
            </AdminDetailSheet>
        </AdminShell>
    );
};
