import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { useSearchParams } from 'react-router-dom';
import {
    AirplaneTakeoff,
    ArrowsClockwise,
    Database,
    FloppyDisk,
    MapPin,
    MagnifyingGlass,
    Plus,
    SpinnerGap,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';
import { useAppDialog } from '../components/AppDialogProvider';
import { GoogleMapsLoader, useGoogleMaps } from '../components/GoogleMapsLoader';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminShell } from '../components/admin/AdminShell';
import { ADMIN_TABLE_ROW_SURFACE_CLASS } from '../components/admin/AdminDataTable';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { showAppToast } from '../components/ui/appToast';
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
import { cn } from '../lib/utils';
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
import {
    buildFakeAirportTicket,
    type FakeAirportTicketCabinClass,
} from '../shared/fakeAirportTicket';

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

type BulkAirportTypeOption = 'leave' | AirportReference['airportType'];
type BulkScheduledServiceOption = 'leave' | 'enabled' | 'disabled';
type BulkTimezoneMode = 'leave' | 'set' | 'clear';
type AirportTableColumnId = 'code' | 'airport' | 'location' | 'tier' | 'type' | 'timezone';

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
const ADMIN_AIRPORT_MAP_ID = 'admin-airports-map';
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
const TICKET_CABIN_OPTIONS: Array<{ value: FakeAirportTicketCabinClass; label: string }> = [
    { value: 'economy', label: 'Economy' },
    { value: 'business', label: 'Business' },
    { value: 'first', label: 'First' },
];
const TICKET_DESTINATION_PRIORITY = ['JFK', 'LHR', 'CDG', 'DXB', 'SIN', 'HND', 'LAX', 'SFO'];
const AIRPORT_COLUMN_WIDTH_MIN: Record<AirportTableColumnId, number> = {
    code: 120,
    airport: 240,
    location: 200,
    tier: 130,
    type: 120,
    timezone: 180,
};
const AIRPORT_COLUMN_WIDTH_DEFAULT: Record<AirportTableColumnId, number> = {
    code: 130,
    airport: 280,
    location: 240,
    tier: 140,
    type: 130,
    timezone: 210,
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

const hasNearbyTesterQueryState = (searchParams: AdminAirportTesterSearchParams): boolean => (
    [
        'nearbyCity',
        'nearbyLat',
        'nearbyLng',
        'nearbyLimit',
        'nearbyTier',
        'nearbyCountry',
        'nearbySameCountry',
        'nearbyLookup',
    ].some((key) => Boolean(searchParams.get(key)?.trim()))
);

const formatRuntimeLocationTesterLabel = (
    location: RuntimeLocationStoreSnapshot['location'],
): string => [location.city, location.countryName].filter(Boolean).join(', ') || 'Runtime location';

const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(parsed));
};

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

const formatCabinClassLabel = (cabinClass: FakeAirportTicketCabinClass): string => {
    if (cabinClass === 'first') return 'First';
    if (cabinClass === 'business') return 'Business';
    return 'Economy';
};

const sortAirports = (airports: AirportReference[]): AirportReference[] => [...airports].sort((left, right) => (
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
    return airports[0] || null;
};

const AirportSourcePill: React.FC<{
    source: AirportCatalogSource;
    databaseAvailable: boolean;
}> = ({ source, databaseAvailable }) => {
    if (source === 'database') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <Database size={12} />
                Database-backed
            </span>
        );
    }

    return (
        <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
            databaseAvailable
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-slate-100 text-slate-700',
        )}>
            <WarningCircle size={12} />
            {databaseAvailable ? 'Snapshot fallback' : 'Snapshot only'}
        </span>
    );
};

const AirportSummaryMetric: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
}> = ({ label, value, hint }) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-black tracking-tight text-slate-900">{value}</div>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
);

const AdminAirportMapBridge: React.FC<{
    mapId: string;
    onMapInstanceChange: (map: google.maps.Map | null) => void;
}> = ({ mapId, onMapInstanceChange }) => {
    const map = useMap(mapId);

    useEffect(() => {
        onMapInstanceChange(map ?? null);
        return () => {
            onMapInstanceChange(null);
        };
    }, [map, onMapInstanceChange]);

    return null;
};

const AdminAirportTestMapCanvas: React.FC<{
    origin: TesterOrigin | null;
    result: NearbyAirportsResponse | null;
}> = ({ origin, result }) => {
    const { isLoaded, loadError } = useGoogleMaps();
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
    const overlayRefs = useRef<google.maps.OverlayView[]>([]);
    const lineRefs = useRef<google.maps.Polyline[]>([]);

    useEffect(() => {
        overlayRefs.current.forEach((overlay) => overlay.setMap(null));
        overlayRefs.current = [];
        lineRefs.current.forEach((line) => line.setMap(null));
        lineRefs.current = [];

        if (!mapInstance || !window.google?.maps?.OverlayView) return;

        const points: Array<{ lat: number; lng: number; label: string; isOrigin?: boolean; rank?: number }> = [];
        if (origin) {
            points.push({
                lat: origin.lat,
                lng: origin.lng,
                label: origin.label,
                isOrigin: true,
            });
        }

        (result?.airports || []).forEach((entry) => {
            points.push({
                lat: entry.airport.latitude,
                lng: entry.airport.longitude,
                label: entry.airport.iataCode || entry.airport.icaoCode || entry.airport.ident,
                rank: entry.rank,
            });
        });

        if (points.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            points.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
            mapInstance.fitBounds(bounds, 112);
            window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
                const nextZoom = mapInstance.getZoom();
                if (typeof nextZoom === 'number' && nextZoom > 7) {
                    mapInstance.setZoom(7);
                }
            });
        }

        if (origin) {
            (result?.airports || []).forEach((entry) => {
                const line = new window.google.maps.Polyline({
                    path: [
                        { lat: origin.lat, lng: origin.lng },
                        { lat: entry.airport.latitude, lng: entry.airport.longitude },
                    ],
                    geodesic: true,
                    strokeColor: '#2563eb',
                    strokeOpacity: 0.35,
                    strokeWeight: 2,
                    map: mapInstance,
                });
                lineRefs.current.push(line);
            });
        }

        points.forEach((point) => {
            const overlay = new window.google.maps.OverlayView();
            let markerNode: HTMLDivElement | null = null;

            overlay.onAdd = function onAdd() {
                markerNode = document.createElement('div');
                markerNode.style.position = 'absolute';
                markerNode.style.transform = 'translate(-50%, -100%)';
                markerNode.style.minWidth = point.isOrigin ? '44px' : '34px';
                markerNode.style.height = point.isOrigin ? '34px' : '30px';
                markerNode.style.padding = point.isOrigin ? '0 12px' : '0 8px';
                markerNode.style.borderRadius = '9999px';
                markerNode.style.display = 'inline-flex';
                markerNode.style.alignItems = 'center';
                markerNode.style.justifyContent = 'center';
                markerNode.style.whiteSpace = 'nowrap';
                markerNode.style.fontSize = point.isOrigin ? '11px' : '12px';
                markerNode.style.fontWeight = '700';
                markerNode.style.boxShadow = '0 10px 24px rgba(15,23,42,0.18)';
                markerNode.style.border = point.isOrigin ? '1px solid #0f172a' : '1px solid #cbd5e1';
                markerNode.style.background = point.isOrigin ? '#0f172a' : '#ffffff';
                markerNode.style.color = point.isOrigin ? '#ffffff' : '#0f172a';
                markerNode.style.zIndex = point.isOrigin ? '30' : '20';
                markerNode.textContent = point.isOrigin ? 'Origin' : point.label;

                const panes = overlay.getPanes();
                panes?.floatPane?.appendChild(markerNode);
            };

            overlay.draw = function draw() {
                if (!markerNode) return;
                const projection = overlay.getProjection();
                const position = projection?.fromLatLngToDivPixel(new window.google.maps.LatLng(point.lat, point.lng));
                if (!position) return;
                markerNode.style.left = `${position.x}px`;
                markerNode.style.top = `${position.y}px`;
            };

            overlay.onRemove = function onRemove() {
                markerNode?.remove();
                markerNode = null;
            };

            overlay.setMap(mapInstance);
            overlayRefs.current.push(overlay);
        });

        return () => {
            overlayRefs.current.forEach((overlay) => overlay.setMap(null));
            overlayRefs.current = [];
            lineRefs.current.forEach((line) => line.setMap(null));
            lineRefs.current = [];
        };
    }, [mapInstance, origin, result]);

    return (
        <div className="relative h-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {!loadError && (
                <GoogleMap
                    id={ADMIN_AIRPORT_MAP_ID}
                    defaultCenter={origin ? { lat: origin.lat, lng: origin.lng } : { lat: 20, lng: 0 }}
                    defaultZoom={origin ? 5 : 2}
                    disableDefaultUI
                    gestureHandling="cooperative"
                    clickableIcons={false}
                    reuseMaps
                    className="h-full w-full"
                >
                    <AdminAirportMapBridge mapId={ADMIN_AIRPORT_MAP_ID} onMapInstanceChange={setMapInstance} />
                </GoogleMap>
            )}
            {(!isLoaded || !origin) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 px-6 text-center text-sm text-slate-600">
                    {!isLoaded
                        ? 'Loading Google Maps for airport testing…'
                        : 'Pick a city or use manual coordinates to preview the nearest-airport map.'}
                </div>
            )}
            {loadError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 px-6 text-center text-sm text-slate-700">
                    Google Maps could not be loaded for this admin tester.
                </div>
            )}
        </div>
    );
};

const AdminAirportTester: React.FC<{
    filters: AdminAirportTesterFilters;
    onFiltersChange: (patch: Partial<AdminAirportTesterFilters>) => void;
    onLookupContextChange?: (context: { origin: TesterOrigin | null; lookupResult: NearbyAirportsResponse | null }) => void;
}> = ({ filters, onFiltersChange, onLookupContextChange }) => {
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
    const filterSignature = useMemo(
        () => buildAirportTesterFilterSignature(filters),
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

    const handleLookup = useCallback(async () => {
        const lat = Number(filters.latitudeInput);
        const lng = Number(filters.longitudeInput);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            setLookupError('Valid latitude and longitude are required.');
            return;
        }

        setLookupLoading(true);
        setLookupError(null);
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
            setLookupError(error instanceof Error ? error.message : 'Airport lookup failed.');
        } finally {
            setLookupLoading(false);
            manualLookupInFlightRef.current = false;
        }
    }, [filterSignature, filters, origin]);

    useEffect(() => {
        const lat = Number(filters.latitudeInput);
        const lng = Number(filters.longitudeInput);
        if (manualLookupInFlightRef.current || !filters.lookupActive || lookupLoading || lookupResult) return;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        void handleLookup();
    }, [filters.latitudeInput, filters.longitudeInput, filters.lookupActive, handleLookup, lookupLoading, lookupResult]);

    useEffect(() => {
        if (!filters.lookupActive || lookupLoading || !lookupResult) return;
        if (lastLookupFilterSignature === filterSignature) return;
        void handleLookup();
    }, [filterSignature, filters.lookupActive, handleLookup, lastLookupFilterSignature, lookupLoading, lookupResult]);

    return (
        <AdminSurfaceCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Nearby Airport Tester</h2>
                    <p className="text-sm text-slate-600">
                        Search for a city with Google, run the shared nearby-airports endpoint, and preview the result set on a map.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="admin-airports-city-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">City Search</label>
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
                                className="pr-11"
                            />
                            <button
                                type="button"
                                onClick={() => void handleResolveCity()}
                                className="absolute inset-y-1.5 right-1.5 inline-flex w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                                aria-label="Resolve city"
                            >
                                {searchingSuggestions ? <SpinnerGap size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
                            </button>
                        </div>
                        {(searchingSuggestions || suggestions.length > 0) && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                {searchingSuggestions && (
                                    <div className="px-3 py-2 text-sm text-slate-500">Searching city suggestions…</div>
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
                                        className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50 last:border-b-0"
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-900">{suggestion.name}</span>
                                            <span className="block text-xs text-slate-500">{suggestion.label}</span>
                                        </span>
                                        <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label htmlFor="admin-airports-latitude" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Latitude</label>
                            <Input
                                id="admin-airports-latitude"
                                type="number"
                                step="0.000001"
                                value={filters.latitudeInput}
                                onChange={(event) => onFiltersChange({ latitudeInput: event.target.value })}
                                placeholder="52.5200"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="admin-airports-longitude" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Longitude</label>
                            <Input
                                id="admin-airports-longitude"
                                type="number"
                                step="0.000001"
                                value={filters.longitudeInput}
                                onChange={(event) => onFiltersChange({ longitudeInput: event.target.value })}
                                placeholder="13.4050"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <div id="admin-airports-passenger-filter-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Passenger Filter</div>
                            <Select value={filters.minimumServiceTier} onValueChange={(value) => onFiltersChange({ minimumServiceTier: value as AirportCommercialServiceTier })}>
                                <SelectTrigger aria-labelledby="admin-airports-passenger-filter-label" className="h-10">
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
                            <p className="text-xs text-slate-500">
                                {SERVICE_TIER_OPTIONS.find((option) => option.value === filters.minimumServiceTier)?.helper}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="admin-airports-result-limit" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Result Limit</label>
                            <Input
                                id="admin-airports-result-limit"
                                type="number"
                                min={1}
                                max={10}
                                value={filters.limitInput}
                                onChange={(event) => onFiltersChange({ limitInput: event.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                        <div className="space-y-2">
                            <ProfileCountryRegionSelect
                                value={filters.countryFilter}
                                disabled={filters.sameCountryOnly}
                                ariaLabel="Nearby airport country filter"
                                placeholder="All countries"
                                emptyLabel="No matching countries"
                                toggleLabel="Toggle airport country filter"
                                onValueChange={(value) => onFiltersChange({ countryFilter: value })}
                            />
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>Filter nearby-airport results to one country.</span>
                                {filters.countryFilter && !filters.sameCountryOnly && (
                                    <button
                                        type="button"
                                        onClick={() => onFiltersChange({ countryFilter: '' })}
                                        className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                                    >
                                        Clear country filter
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Same-country only</div>
                                <div className="text-xs text-slate-500">
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
                        <button
                            type="button"
                            onClick={() => void handleUseRuntimeLocation()}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                        >
                            <MapPin size={15} />
                            Use runtime location
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!filters.lookupActive) {
                                    onFiltersChange({ lookupActive: true });
                                }
                                manualLookupInFlightRef.current = true;
                                void handleLookup();
                            }}
                            disabled={lookupLoading}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {lookupLoading ? <SpinnerGap size={15} className="animate-spin" /> : <AirplaneTakeoff size={15} />}
                            Lookup nearby airports
                        </button>
                    </div>

                    {origin && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            <div className="font-semibold text-slate-900">Origin</div>
                            <div>{origin.label}</div>
                            <div className="text-xs text-slate-500">
                                {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                                {origin.countryCode ? ` · ${origin.countryCode}` : ''}
                            </div>
                        </div>
                    )}

                    {lookupError && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                            {lookupError}
                        </div>
                    )}

                    {displayLookupResult && (
                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-slate-900">Nearest airports</div>
                                <div className="text-xs text-slate-500">Data version {displayLookupResult.dataVersion}</div>
                            </div>
                            <div className="space-y-2">
                                {displayLookupResult.airports.map((entry) => (
                                    <div key={`${entry.airport.ident}-${entry.rank}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {entry.rank}. {entry.airport.name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {(entry.airport.iataCode || entry.airport.icaoCode || entry.airport.ident)} · {entry.airport.municipality || 'Unknown city'} · {entry.airport.countryName}
                                                </div>
                                            </div>
                                            <div className="text-sm font-semibold text-slate-900">{formatDistance(entry.airDistanceKm)}</div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                                {formatServiceTierLabel(entry.airport.commercialServiceTier)}
                                            </span>
                                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                                {formatAirportTypeLabel(entry.airport.airportType)}
                                            </span>
                                            {entry.airport.timezone && (
                                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                                    {entry.airport.timezone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <AdminAirportTestMapCanvas origin={origin} result={displayLookupResult} />
            </div>
        </AdminSurfaceCard>
    );
};

const AdminAirportBulkEditor: React.FC<{
    selectedAirports: AirportReference[];
    filteredAirportCount: number;
    databaseBacked: boolean;
    isApplying: boolean;
    isDeleting: boolean;
    onApply: (patch: AdminAirportBulkUpdatePatch) => Promise<void>;
    onDeleteSelected: () => Promise<void>;
    onSelectFiltered: () => void;
    onClearSelection: () => void;
}> = ({
    selectedAirports,
    filteredAirportCount,
    databaseBacked,
    isApplying,
    isDeleting,
    onApply,
    onDeleteSelected,
    onSelectFiltered,
    onClearSelection,
}) => {
    const [bulkAirportType, setBulkAirportType] = useState<BulkAirportTypeOption>('leave');
    const [bulkScheduledService, setBulkScheduledService] = useState<BulkScheduledServiceOption>('leave');
    const [bulkTimezoneMode, setBulkTimezoneMode] = useState<BulkTimezoneMode>('leave');
    const [bulkTimezoneValue, setBulkTimezoneValue] = useState('');

    const selectedCount = selectedAirports.length;
    const selectionSummary = useMemo(() => {
        let major = 0;
        let regional = 0;
        let local = 0;
        selectedAirports.forEach((airport) => {
            if (airport.commercialServiceTier === 'major') major += 1;
            else if (airport.commercialServiceTier === 'regional') regional += 1;
            else local += 1;
        });
        return { major, regional, local };
    }, [selectedAirports]);

    const bulkPatch = useMemo(() => {
        const nextPatch: AdminAirportBulkUpdatePatch = {};
        if (bulkAirportType !== 'leave') {
            nextPatch.airportType = bulkAirportType;
        }
        if (bulkScheduledService !== 'leave') {
            nextPatch.scheduledService = bulkScheduledService === 'enabled';
        }
        if (bulkTimezoneMode === 'set') {
            const trimmedTimezone = bulkTimezoneValue.trim();
            if (!trimmedTimezone) return null;
            nextPatch.timezone = trimmedTimezone;
        }
        if (bulkTimezoneMode === 'clear') {
            nextPatch.timezone = null;
        }
        return Object.keys(nextPatch).length > 0 ? nextPatch : null;
    }, [bulkAirportType, bulkScheduledService, bulkTimezoneMode, bulkTimezoneValue]);

    const canApply = databaseBacked && selectedCount > 0 && Boolean(bulkPatch) && !isApplying && !isDeleting;

    const handleApply = useCallback(async () => {
        if (!bulkPatch) {
            showAppToast({
                title: 'Choose at least one bulk change',
                description: 'Set an airport type, scheduled-service flag, or timezone action before applying bulk edits.',
                tone: 'info',
            });
            return;
        }
        try {
            await onApply(bulkPatch);
            setBulkAirportType('leave');
            setBulkScheduledService('leave');
            setBulkTimezoneMode('leave');
            setBulkTimezoneValue('');
        } catch {
            // The page-level handler already surfaced the failure state via toast.
        }
    }, [bulkPatch, onApply]);

    return (
        <AdminSurfaceCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Bulk Editor</h2>
                    <p className="text-sm text-slate-600">
                        Apply the same airport-type, scheduled-service, or timezone correction to many selected airports at once.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onSelectFiltered}
                        disabled={filteredAirportCount === 0}
                        className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Select filtered ({filteredAirportCount})
                    </button>
                    <button
                        type="button"
                        onClick={onClearSelection}
                        disabled={selectedCount === 0}
                        className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Clear selection
                    </button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <AirportSummaryMetric
                    label="Selected airports"
                    value={selectedCount}
                    hint={selectedCount > 0 ? 'Bulk edits apply to all selected rows.' : 'Pick rows from the table below.'}
                />
                <AirportSummaryMetric label="Major" value={selectionSummary.major} hint="Large commercial hubs." />
                <AirportSummaryMetric label="Regional" value={selectionSummary.regional} hint="Typical passenger airports." />
                <AirportSummaryMetric label="Local" value={selectionSummary.local} hint="Smaller scheduled commercial fields." />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                    <div id="admin-airports-bulk-airport-type-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Airport Type</div>
                    <Select value={bulkAirportType} onValueChange={(value) => setBulkAirportType(value as BulkAirportTypeOption)}>
                        <SelectTrigger aria-labelledby="admin-airports-bulk-airport-type-label" className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BULK_AIRPORT_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <div id="admin-airports-bulk-scheduled-service-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Scheduled Service</div>
                    <Select value={bulkScheduledService} onValueChange={(value) => setBulkScheduledService(value as BulkScheduledServiceOption)}>
                        <SelectTrigger aria-labelledby="admin-airports-bulk-scheduled-service-label" className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BULK_SCHEDULED_SERVICE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <div id="admin-airports-bulk-timezone-mode-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timezone Action</div>
                    <Select value={bulkTimezoneMode} onValueChange={(value) => setBulkTimezoneMode(value as BulkTimezoneMode)}>
                        <SelectTrigger aria-labelledby="admin-airports-bulk-timezone-mode-label" className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BULK_TIMEZONE_MODE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {bulkTimezoneMode === 'set' && (
                <div className="space-y-2">
                    <label htmlFor="admin-airports-bulk-timezone-value" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timezone Value</label>
                    <Input
                        id="admin-airports-bulk-timezone-value"
                        value={bulkTimezoneValue}
                        onChange={(event) => setBulkTimezoneValue(event.target.value)}
                        placeholder="Europe/Berlin"
                    />
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => void handleApply()}
                    disabled={!canApply}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isApplying ? <SpinnerGap size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
                    Apply bulk edit
                </button>
                <button
                    type="button"
                    onClick={() => void onDeleteSelected()}
                    disabled={!databaseBacked || selectedCount === 0 || isDeleting || isApplying}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 transition-colors hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isDeleting ? <SpinnerGap size={14} className="animate-spin" /> : <Trash size={14} />}
                    Delete selected
                </button>
                {!databaseBacked && (
                    <span className="text-xs text-amber-700">Sync the database catalog first to enable bulk edits.</span>
                )}
            </div>
        </AdminSurfaceCard>
    );
};

const AdminAirportTicketLab: React.FC<{
    catalogAirports: AirportReference[];
    origin: TesterOrigin | null;
    nearbyResult: NearbyAirportsResponse | null;
}> = ({ catalogAirports, origin, nearbyResult }) => {
    const [passengerName, setPassengerName] = useState('Alex Morgan');
    const [cabinClass, setCabinClass] = useState<FakeAirportTicketCabinClass>('economy');
    const [selectedDepartureIdent, setSelectedDepartureIdent] = useState<string>('');
    const [selectedDestinationIdent, setSelectedDestinationIdent] = useState<string>('');
    const [departureDate, setDepartureDate] = useState(() => {
        const next = new Date();
        next.setDate(next.getDate() + 14);
        return next.toISOString().slice(0, 10);
    });

    const departureOptions = useMemo(
        () => (nearbyResult?.airports || []).map((entry) => ({
            airport: entry.airport,
            airportAccessDistanceKm: entry.airDistanceKm,
        })),
        [nearbyResult],
    );

    const selectedDeparture = useMemo(
        () => departureOptions.find((entry) => entry.airport.ident === selectedDepartureIdent) || departureOptions[0] || null,
        [departureOptions, selectedDepartureIdent],
    );

    const destinationOptions = useMemo(() => {
        const excludedIdent = selectedDeparture?.airport.ident || null;
        const commercialOptions = catalogAirports.filter((airport) => (
            airport.isCommercial
            && airport.ident !== excludedIdent
            && airport.iataCode
            && (airport.commercialServiceTier === 'major' || airport.commercialServiceTier === 'regional')
        ));
        const byIdent = new Map<string, AirportReference>();
        commercialOptions.forEach((airport) => {
            byIdent.set(airport.ident, airport);
        });

        const prioritized: AirportReference[] = [];
        TICKET_DESTINATION_PRIORITY.forEach((iataCode) => {
            const match = commercialOptions.find((airport) => airport.iataCode === iataCode);
            if (match && !prioritized.some((airport) => airport.ident === match.ident)) {
                prioritized.push(match);
            }
        });

        commercialOptions.forEach((airport) => {
            if (!prioritized.some((entry) => entry.ident === airport.ident)) {
                prioritized.push(airport);
            }
        });

        return prioritized.slice(0, 16);
    }, [catalogAirports, selectedDeparture?.airport.ident]);

    const selectedDestination = useMemo(
        () => destinationOptions.find((airport) => airport.ident === selectedDestinationIdent) || destinationOptions[0] || null,
        [destinationOptions, selectedDestinationIdent],
    );

    const ticket = useMemo(() => {
        if (!selectedDeparture || !selectedDestination) return null;
        return buildFakeAirportTicket({
            passengerName,
            departureAirport: selectedDeparture.airport,
            arrivalAirport: selectedDestination,
            departureDate,
            cabinClass,
            originLabel: origin?.label || null,
            airportAccessDistanceKm: selectedDeparture.airportAccessDistanceKm,
        });
    }, [cabinClass, departureDate, origin?.label, passengerName, selectedDeparture, selectedDestination]);

    return (
        <AdminSurfaceCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Fake Ticket Lab</h2>
                    <p className="text-sm text-slate-600">
                        Build a digital boarding-pass preview from the nearest commercial airport so we can validate the future ticket experience against real airport data.
                    </p>
                </div>
                {ticket && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {formatCabinClassLabel(ticket.cabinClass)} preview
                    </span>
                )}
            </div>

            {!nearbyResult && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Run a nearby-airport lookup first, then this lab will use the closest commercial airport as the departure side of the fake ticket.
                </div>
            )}

            {nearbyResult && (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="admin-airports-ticket-passenger" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Passenger Name</label>
                                <Input
                                    id="admin-airports-ticket-passenger"
                                    value={passengerName}
                                    onChange={(event) => setPassengerName(event.target.value)}
                                    placeholder="Alex Morgan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="admin-airports-ticket-date" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Departure Date</label>
                                <Input
                                    id="admin-airports-ticket-date"
                                    type="date"
                                    value={departureDate}
                                    onChange={(event) => setDepartureDate(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <div id="admin-airports-ticket-departure-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Departure Airport</div>
                                <Select value={selectedDeparture?.airport.ident || ''} onValueChange={setSelectedDepartureIdent}>
                                    <SelectTrigger aria-labelledby="admin-airports-ticket-departure-label" className="h-10">
                                        <SelectValue placeholder="Choose a nearby airport" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departureOptions.map((entry) => (
                                            <SelectItem key={entry.airport.ident} value={entry.airport.ident}>
                                                {(entry.airport.iataCode || entry.airport.ident)} · {entry.airport.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div id="admin-airports-ticket-destination-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Destination Airport</div>
                                <Select value={selectedDestination?.ident || ''} onValueChange={setSelectedDestinationIdent}>
                                    <SelectTrigger aria-labelledby="admin-airports-ticket-destination-label" className="h-10">
                                        <SelectValue placeholder="Choose a destination hub" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinationOptions.map((airport) => (
                                            <SelectItem key={airport.ident} value={airport.ident}>
                                                {(airport.iataCode || airport.ident)} · {airport.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div id="admin-airports-ticket-cabin-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cabin Class</div>
                            <Select value={cabinClass} onValueChange={(value) => setCabinClass(value as FakeAirportTicketCabinClass)}>
                                <SelectTrigger aria-labelledby="admin-airports-ticket-cabin-label" className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TICKET_CABIN_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedDeparture && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                <div className="font-semibold text-slate-900">Departure context</div>
                                <div className="mt-1">
                                    {selectedDeparture.airport.name} · {selectedDeparture.airport.municipality || 'Unknown city'} · {formatDistance(selectedDeparture.airportAccessDistanceKm)}
                                </div>
                                {origin && (
                                    <div className="mt-1 text-xs text-slate-500">
                                        Based on {origin.label}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {ticket && (
                        <div className="overflow-hidden rounded-[28px] border border-slate-900/10 bg-[linear-gradient(135deg,#0f172a_0%,#155e75_48%,#f8fafc_48%,#f8fafc_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                            <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_148px]">
                                <div className="space-y-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">Digital Boarding Pass</div>
                                            <div className="mt-2 text-2xl font-black tracking-tight text-white">{ticket.airlineName}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right text-white backdrop-blur">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Flight</div>
                                            <div className="mt-1 text-lg font-black">{ticket.flightNumber}</div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 rounded-[24px] border border-white/15 bg-white/10 p-4 text-white backdrop-blur md:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">From</div>
                                            <div className="mt-2 text-4xl font-black tracking-tight">{ticket.departureAirport.iataCode || ticket.departureAirport.ident}</div>
                                            <div className="mt-1 text-sm text-cyan-50">{ticket.departureAirport.name}</div>
                                            <div className="text-xs text-cyan-100/80">{ticket.departureAirport.municipality || ticket.departureAirport.countryName}</div>
                                        </div>
                                        <div className="flex items-center justify-center text-2xl font-black text-cyan-100">→</div>
                                        <div className="text-right">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">To</div>
                                            <div className="mt-2 text-4xl font-black tracking-tight">{ticket.arrivalAirport.iataCode || ticket.arrivalAirport.ident}</div>
                                            <div className="mt-1 text-sm text-cyan-50">{ticket.arrivalAirport.name}</div>
                                            <div className="text-xs text-cyan-100/80">{ticket.arrivalAirport.municipality || ticket.arrivalAirport.countryName}</div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 text-sm text-slate-900 md:grid-cols-4">
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</div>
                                            <div className="mt-1 font-semibold">{ticket.departureDateLabel}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Boarding</div>
                                            <div className="mt-1 font-semibold">{ticket.boardingTimeLabel}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Departure</div>
                                            <div className="mt-1 font-semibold">{ticket.departureTimeLabel}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Arrival</div>
                                            <div className="mt-1 font-semibold">{ticket.arrivalTimeLabel}</div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 text-sm text-slate-900 md:grid-cols-5">
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Passenger</div>
                                            <div className="mt-1 font-semibold">{ticket.passengerName}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Seat</div>
                                            <div className="mt-1 font-semibold">{ticket.seat}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Gate</div>
                                            <div className="mt-1 font-semibold">T{ticket.terminal} · {ticket.gate}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cabin</div>
                                            <div className="mt-1 font-semibold">{formatCabinClassLabel(ticket.cabinClass)}</div>
                                        </div>
                                        <div className="rounded-2xl bg-white/95 p-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duration</div>
                                            <div className="mt-1 font-semibold">{ticket.durationLabel}</div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 text-xs text-cyan-100/85 md:grid-cols-2">
                                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                                            <div className="font-semibold uppercase tracking-[0.18em]">Booking Reference</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{ticket.bookingReference}</div>
                                            <div className="mt-2 font-semibold uppercase tracking-[0.18em]">Ticket Number</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{ticket.ticketNumber}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                                            <div className="font-semibold uppercase tracking-[0.18em]">Airport Access</div>
                                            <div className="mt-1 text-sm font-semibold text-white">
                                                {ticket.airportAccessDistanceKm !== null ? formatDistance(ticket.airportAccessDistanceKm) : 'Unknown'}
                                            </div>
                                            <div className="mt-2 font-semibold uppercase tracking-[0.18em]">Route Distance</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{formatDistance(ticket.routeDistanceKm)}</div>
                                            {ticket.originLabel && (
                                                <div className="mt-2 text-[11px] text-cyan-100/75">
                                                    Origin: {ticket.originLabel}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[24px] bg-white/95 p-4 text-slate-900">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Boarding Group</div>
                                    <div className="mt-1 text-lg font-black">{ticket.boardingGroup}</div>
                                    <div className="mt-5 grid grid-cols-7 gap-1">
                                        {Array.from({ length: 49 }, (_, cellIndex) => {
                                            const token = `${ticket.bookingReference}-${ticket.flightNumber}-${cellIndex}`;
                                            const fill = token.charCodeAt(cellIndex % token.length) % 3 === 0;
                                            const cellId = `ticket-cell-${cellIndex}`;
                                            return (
                                                <span
                                                    key={cellId}
                                                    className={cn(
                                                        'block h-3 w-3 rounded-[2px]',
                                                        fill ? 'bg-slate-900' : 'bg-slate-200',
                                                    )}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500">
                                        Fake preview only. This is a generated admin artifact powered by the nearby-airport data model.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </AdminSurfaceCard>
    );
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    const runtimeTesterBootstrapAttemptedRef = useRef(false);
    const resizeStateRef = useRef<{
        columnId: AirportTableColumnId;
        startX: number;
        startWidth: number;
    } | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<AirportTableColumnId, number>>(AIRPORT_COLUMN_WIDTH_DEFAULT);

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

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const nextCatalog = await adminGetAirportCatalog();
            const sortedAirports = sortAirports(nextCatalog.airports);
            const nextSelectedAirport = resolveSelectedAirport(sortedAirports, selectedAirportIdentRef.current);
            setCatalog({
                ...nextCatalog,
                airports: sortedAirports,
            });
            setSelectedAirportIdents((current) => {
                const validIdents = new Set(sortedAirports.map((airport) => airport.ident));
                return new Set(Array.from(current).filter((ident) => validIdents.has(ident)));
            });
            setSelectedAirportIdent(nextSelectedAirport?.ident || null);
            setEditorDraft(nextSelectedAirport ? airportToDraft(nextSelectedAirport) : null);
            setEditorDirty(false);
            setEditorMode('edit');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load airport catalog.');
        } finally {
            setLoading(false);
        }
    }, []);

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

    useEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [page, safePage]);

    useEffect(() => {
        const nextSearchValue = searchParams.get('q') || '';
        const nextCountryFilter = normalizeProfileCountryCode(searchParams.get('country'));
        const nextServiceTierFilter = parseAirportTableTierFilter(searchParams.get('catalogTier'));
        const nextPage = parsePositivePage(searchParams.get('page'));
        const nextTesterFilters = buildAdminAirportTesterFiltersFromSearchParams(searchParams);

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
    }, [searchParams]);

    useEffect(() => {
        if (runtimeTesterBootstrapAttemptedRef.current) return;
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
    }, [searchParams]);

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

        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        countryFilter,
        safePage,
        searchParams,
        searchValue,
        serviceTierFilter,
        setSearchParams,
        testerFilters,
    ]);

    const handleSelectAirport = useCallback(async (ident: string) => {
        if (ident === selectedAirportIdent) return;
        if (editorDirty) {
            const shouldDiscard = await confirmDialog({
                title: 'Discard unsaved airport edits?',
                message: 'Switching rows will discard your unsaved airport changes.',
                confirmLabel: 'Discard changes',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            if (!shouldDiscard) return;
        }
        const nextAirport = catalog?.airports.find((airport) => airport.ident === ident) || null;
        setSelectedAirportIdent(ident);
        setEditorDraft(nextAirport ? airportToDraft(nextAirport) : null);
        setEditorDirty(false);
        setEditorMode('edit');
    }, [catalog?.airports, confirmDialog, editorDirty, selectedAirportIdent]);

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
    }, [filteredAirports]);

    const handleClearAirportSelection = useCallback(() => {
        setSelectedAirportIdents(new Set());
    }, []);

    const handleSyncCatalog = useCallback(async () => {
        const shouldSync = await confirmDialog({
            title: 'Sync airports from upstream sources?',
            message: 'This will replace the database airport catalog with a fresh generated snapshot from the configured free upstream feeds.',
            confirmLabel: 'Sync now',
            cancelLabel: 'Cancel',
        });
        if (!shouldSync) return;

        const loadingToastId = showAppToast({
            title: 'Syncing airports',
            description: 'Fetching upstream airport sources and replacing the database catalog.',
            tone: 'info',
            persist: true,
        });

        setSyncing(true);
        try {
            const nextCatalog = await adminSyncAirportCatalog();
            const sortedAirports = sortAirports(nextCatalog.airports);
            const nextSelectedAirport = resolveSelectedAirport(sortedAirports, selectedAirportIdent);
            setCatalog({
                ...nextCatalog,
                airports: sortedAirports,
            });
            setSelectedAirportIdents((current) => {
                const validIdents = new Set(sortedAirports.map((airport) => airport.ident));
                return new Set(Array.from(current).filter((ident) => validIdents.has(ident)));
            });
            setSelectedAirportIdent(nextSelectedAirport?.ident || null);
            setEditorDraft(nextSelectedAirport ? airportToDraft(nextSelectedAirport) : null);
            setEditorDirty(false);
            setEditorMode('edit');
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
                description: error instanceof Error ? error.message : 'Could not sync the airport catalog.',
                tone: 'remove',
            });
        } finally {
            setSyncing(false);
        }
    }, [confirmDialog, selectedAirportIdent]);

    const handleStartCreateAirport = useCallback(async () => {
        if (editorDirty) {
            const shouldDiscard = await confirmDialog({
                title: 'Discard unsaved airport edits?',
                message: 'Starting a new airport draft will discard the current unsaved changes.',
                confirmLabel: 'Discard changes',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            if (!shouldDiscard) return;
        }

        setSelectedAirportIdent(null);
        setEditorDraft(buildEmptyAirportDraft());
        setEditorDirty(false);
        setEditorMode('create');
    }, [confirmDialog, editorDirty]);

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
            tone: 'info',
            persist: true,
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
                description: error instanceof Error ? error.message : (editorMode === 'create' ? 'Could not create the airport.' : 'Could not update the airport.'),
                tone: 'remove',
            });
        } finally {
            setSaving(false);
        }
    }, [catalog?.airports, editorDraft, editorMode]);

    const handleBulkUpdateAirports = useCallback(async (patch: AdminAirportBulkUpdatePatch) => {
        if (!catalog || selectedAirportIdents.size === 0) return;

        if (editorDirty && selectedAirportIdent && selectedAirportIdents.has(selectedAirportIdent)) {
            const shouldDiscard = await confirmDialog({
                title: 'Discard unsaved airport edits?',
                message: 'The selected airport is also part of this bulk edit, so your unsaved single-row changes would be replaced.',
                confirmLabel: 'Discard and continue',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            if (!shouldDiscard) {
                throw new Error('Bulk airport edit canceled.');
            }
        }

        const selectedCount = selectedAirportIdents.size;
        const shouldApply = await confirmDialog({
            title: 'Apply bulk airport edits?',
            message: `Update ${selectedCount} selected airport row${selectedCount === 1 ? '' : 's'} with the current bulk edit settings?`,
            confirmLabel: 'Apply bulk edit',
            cancelLabel: 'Cancel',
        });
        if (!shouldApply) {
            throw new Error('Bulk airport edit canceled.');
        }

        const loadingToastId = showAppToast({
            title: 'Applying bulk airport edits',
            description: `Updating ${selectedCount} selected airport row${selectedCount === 1 ? '' : 's'}.`,
            tone: 'info',
            persist: true,
        });

        setBulkSaving(true);
        try {
            const updatedAirports = await adminBulkUpdateAirportCatalogRecords({
                idents: Array.from(selectedAirportIdents),
                patch,
            });
            const updatedByIdent = new Map(updatedAirports.map((airport) => [airport.ident, airport] as const));
            const nextAirports = sortAirports(catalog.airports.map((airport) => updatedByIdent.get(airport.ident) || airport));
            const nextSelectedAirport = resolveSelectedAirport(nextAirports, selectedAirportIdent);

            setCatalog({
                ...catalog,
                airports: nextAirports,
                metadata: catalog.metadata
                    ? {
                        ...catalog.metadata,
                        syncedAt: new Date().toISOString(),
                    }
                    : catalog.metadata,
            });
            setSelectedAirportIdent(nextSelectedAirport?.ident || null);
            setEditorDraft(nextSelectedAirport ? airportToDraft(nextSelectedAirport) : null);
            setEditorDirty(false);
            setEditorMode('edit');
            showAppToast({
                id: loadingToastId,
                title: 'Bulk airport edit finished',
                description: `Updated ${updatedAirports.length} airport row${updatedAirports.length === 1 ? '' : 's'}.`,
                tone: 'add',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Bulk airport update failed.';
            showAppToast({
                id: loadingToastId,
                title: message === 'Bulk airport edit canceled.' ? 'Bulk airport edit canceled' : 'Bulk airport edit failed',
                description: message === 'Bulk airport edit canceled.' ? 'No airport rows were changed.' : message,
                tone: message === 'Bulk airport edit canceled.' ? 'info' : 'remove',
            });
            if (message !== 'Bulk airport edit canceled.') {
                throw error;
            }
        } finally {
            setBulkSaving(false);
        }
    }, [catalog, confirmDialog, editorDirty, selectedAirportIdent, selectedAirportIdents]);

    const handleDeleteSelectedAirports = useCallback(async () => {
        if (!catalog || selectedAirportIdents.size === 0) return;

        if (editorDirty && selectedAirportIdent && selectedAirportIdents.has(selectedAirportIdent)) {
            const shouldDiscard = await confirmDialog({
                title: 'Discard unsaved airport edits?',
                message: 'The active editor row is part of this delete selection, so your unsaved changes would be discarded.',
                confirmLabel: 'Discard and continue',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            if (!shouldDiscard) return;
        }

        const deleteCount = selectedAirportIdents.size;
        const shouldDelete = await confirmDialog({
            title: 'Delete selected airports?',
            message: `Remove ${deleteCount} selected airport row${deleteCount === 1 ? '' : 's'} from the database catalog?`,
            confirmLabel: 'Delete airports',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!shouldDelete) return;

        const loadingToastId = showAppToast({
            title: 'Deleting airports',
            description: `Removing ${deleteCount} selected airport row${deleteCount === 1 ? '' : 's'}.`,
            tone: 'info',
            persist: true,
        });

        setBulkDeleting(true);
        try {
            const deletedIdents = await adminDeleteAirportCatalogRecords(Array.from(selectedAirportIdents));
            const deletedIdentSet = new Set(deletedIdents);
            const nextAirports = sortAirports(catalog.airports.filter((airport) => !deletedIdentSet.has(airport.ident)));
            const preferredIdent = selectedAirportIdent && !deletedIdentSet.has(selectedAirportIdent) ? selectedAirportIdent : null;
            const nextSelectedAirport = resolveSelectedAirport(nextAirports, preferredIdent);

            setCatalog({
                ...catalog,
                airports: nextAirports,
                metadata: catalog.metadata
                    ? {
                        ...catalog.metadata,
                        syncedAt: new Date().toISOString(),
                    }
                    : catalog.metadata,
            });
            setSelectedAirportIdents(new Set());
            setSelectedAirportIdent(nextSelectedAirport?.ident || null);
            setEditorDraft(nextSelectedAirport ? airportToDraft(nextSelectedAirport) : null);
            setEditorDirty(false);
            setEditorMode('edit');
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
                description: error instanceof Error ? error.message : 'Could not delete the selected airports.',
                tone: 'remove',
            });
        } finally {
            setBulkDeleting(false);
        }
    }, [catalog, confirmDialog, editorDirty, selectedAirportIdents, selectedAirportIdent]);

    const handleDeleteAirport = useCallback(async () => {
        if (!catalog || !selectedAirport) return;

        if (editorDirty) {
            const shouldDiscard = await confirmDialog({
                title: 'Discard unsaved airport edits?',
                message: 'Deleting this airport will discard the current unsaved changes.',
                confirmLabel: 'Discard and continue',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            if (!shouldDiscard) return;
        }

        const shouldDelete = await confirmDialog({
            title: 'Delete this airport?',
            message: `Remove ${selectedAirport.name} from the database catalog?`,
            confirmLabel: 'Delete airport',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!shouldDelete) return;

        const loadingToastId = showAppToast({
            title: 'Deleting airport',
            description: `Removing ${selectedAirport.ident} from the catalog.`,
            tone: 'info',
            persist: true,
        });

        setDeleting(true);
        try {
            const deletedIdents = await adminDeleteAirportCatalogRecords([selectedAirport.ident]);
            const deletedIdentSet = new Set(deletedIdents);
            const nextAirports = sortAirports(catalog.airports.filter((airport) => !deletedIdentSet.has(airport.ident)));
            const nextSelectedAirport = resolveSelectedAirport(nextAirports, null);

            setCatalog({
                ...catalog,
                airports: nextAirports,
                metadata: catalog.metadata
                    ? {
                        ...catalog.metadata,
                        syncedAt: new Date().toISOString(),
                    }
                    : catalog.metadata,
            });
            setSelectedAirportIdents((current) => {
                const next = new Set(current);
                deletedIdents.forEach((ident) => next.delete(ident));
                return next;
            });
            setSelectedAirportIdent(nextSelectedAirport?.ident || null);
            setEditorDraft(nextSelectedAirport ? airportToDraft(nextSelectedAirport) : null);
            setEditorDirty(false);
            setEditorMode('edit');
            showAppToast({
                id: loadingToastId,
                title: 'Airport deleted',
                description: `${selectedAirport.name} was removed from the catalog.`,
                tone: 'add',
            });
        } catch (error) {
            showAppToast({
                id: loadingToastId,
                title: 'Airport delete failed',
                description: error instanceof Error ? error.message : 'Could not delete the airport.',
                tone: 'remove',
            });
        } finally {
            setDeleting(false);
        }
    }, [catalog, confirmDialog, editorDirty, selectedAirport]);

    const databaseBacked = catalog?.source === 'database';
    const editorPreviewAirport = editorDraft ? draftToAirport(editorDraft) : selectedAirport;

    return (
        <AdminShell
            title="Airports"
            description="Manage the commercial airport catalog, sync the Supabase table from upstream free datasets, and test nearby-airport lookups with a map-based city search."
            searchValue={searchValue}
            onSearchValueChange={handleSearchValueChange}
            showDateRange={false}
            actions={(
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void handleStartCreateAirport()}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                    >
                        <Plus size={14} />
                        New airport
                    </button>
                    <AdminReloadButton onClick={() => void loadCatalog()} isLoading={loading} label="Reload catalog" />
                    <button
                        type="button"
                        onClick={() => void handleSyncCatalog()}
                        disabled={syncing}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {syncing ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
                        Sync from upstream
                    </button>
                </div>
            )}
        >
            <div className="space-y-4">
                {errorMessage && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {errorMessage}
                    </div>
                )}

                <AdminSurfaceCard className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-slate-900">Catalog Status</h2>
                                {catalog && (
                                    <AirportSourcePill source={catalog.source} databaseAvailable={catalog.databaseAvailable} />
                                )}
                            </div>
                            <p className="max-w-3xl text-sm text-slate-600">
                                Service tiers are derived from airport size so we can distinguish smaller local commercial airports from regional passenger airports and major commercial hubs.
                            </p>
                        </div>
                        {editorPreviewAirport && (
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {formatServiceTierLabel(editorPreviewAirport.commercialServiceTier)}
                                </span>
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {formatAirportTypeLabel(editorPreviewAirport.airportType)}
                                </span>
                                <span className={cn(
                                    'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                                    editorPreviewAirport.isCommercial
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-800',
                                )}>
                                    {editorPreviewAirport.isCommercial ? 'Commercial lookup eligible' : 'Excluded from commercial lookup'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <AirportSummaryMetric
                            label="Catalog airports"
                            value={catalog?.airports.length ?? '—'}
                            hint="Current rows available to the admin UI."
                        />
                        <AirportSummaryMetric
                            label="Data version"
                            value={catalog?.metadata?.dataVersion ?? 'unknown'}
                            hint="Version string returned by nearby-airport responses."
                        />
                        <AirportSummaryMetric
                            label="Generated"
                            value={formatDateTime(catalog?.metadata?.generatedAt)}
                            hint="When the upstream generator snapshot was built."
                        />
                        <AirportSummaryMetric
                            label="Last synced"
                            value={formatDateTime(catalog?.metadata?.syncedAt)}
                            hint="When the database catalog was last touched."
                        />
                        <AirportSummaryMetric
                            label="Synced by"
                            value={catalog?.metadata?.syncedBy || '—'}
                            hint="Actor or source that last wrote the database catalog."
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">Upstream sources:</span>{' '}
                        {catalog?.metadata
                            ? `${catalog.metadata.sources.primary} · ${catalog.metadata.sources.enrichment}`
                            : 'Waiting for airport metadata.'}
                    </div>
                </AdminSurfaceCard>

                <GoogleMapsLoader>
                    <div className="space-y-4">
                        <AdminAirportTester
                            filters={testerFilters}
                            onFiltersChange={handleTesterFiltersChange}
                            onLookupContextChange={handleTesterContextChange}
                        />
                        <AdminAirportTicketLab
                            catalogAirports={catalog?.airports || []}
                            origin={ticketTesterOrigin}
                            nearbyResult={ticketTesterResult}
                        />
                    </div>
                </GoogleMapsLoader>

                <AdminAirportBulkEditor
                    selectedAirports={selectedAirports}
                    filteredAirportCount={filteredAirports.length}
                    databaseBacked={Boolean(databaseBacked)}
                    isApplying={bulkSaving}
                    isDeleting={bulkDeleting}
                    onApply={handleBulkUpdateAirports}
                    onDeleteSelected={handleDeleteSelectedAirports}
                    onSelectFiltered={handleSelectFilteredAirports}
                    onClearSelection={handleClearAirportSelection}
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
                    <AdminSurfaceCard className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Airport Catalog</h2>
                                <p className="text-sm text-slate-600">
                                    Browse the full commercial-airport table, filter it by tier or country, and pick a row to edit.
                                </p>
                            </div>
                            <div className="space-y-1 text-right text-sm text-slate-500">
                                <div>
                                    Showing {(safePage - 1) * AIRPORT_TABLE_PAGE_SIZE + 1}-{Math.min(safePage * AIRPORT_TABLE_PAGE_SIZE, filteredAirports.length)} of {filteredAirports.length}
                                </div>
                                <div>{selectedAirports.length} selected</div>
                                <div>Drag column handles to resize</div>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2">
                                <ProfileCountryRegionSelect
                                    value={countryFilter}
                                    ariaLabel="Airport catalog country filter"
                                    placeholder="All countries"
                                    emptyLabel="No matching countries"
                                    toggleLabel="Toggle country filter"
                                    onValueChange={handleCountryFilterChange}
                                />
                                <div className="text-xs text-slate-500">
                                    {countryFilter ? (
                                        <button
                                            type="button"
                                            onClick={() => handleCountryFilterChange('')}
                                            className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                                        >
                                            Clear country filter
                                        </button>
                                    ) : 'Filter the table by country with the shared flag picker.'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div id="admin-airports-service-tier-filter-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Service Tier</div>
                                <Select value={serviceTierFilter} onValueChange={handleServiceTierFilterChange}>
                                    <SelectTrigger aria-labelledby="admin-airports-service-tier-filter-label" className="h-10">
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
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                Search matches IATA, ICAO, ident, airport name, city, subdivision, and country.
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                            <Table className="min-w-[980px] table-fixed">
                                <colgroup>
                                    <col style={{ width: 52 }} />
                                    <col style={{ width: `${columnWidths.code}px` }} />
                                    <col style={{ width: `${columnWidths.airport}px` }} />
                                    <col style={{ width: `${columnWidths.location}px` }} />
                                    <col style={{ width: `${columnWidths.tier}px` }} />
                                    <col style={{ width: `${columnWidths.type}px` }} />
                                    <col style={{ width: `${columnWidths.timezone}px` }} />
                                </colgroup>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[52px]">
                                            <Checkbox
                                                checked={areAllVisibleAirportsSelected ? true : (isVisibleAirportSelectionPartial ? 'indeterminate' : false)}
                                                onCheckedChange={(checked) => toggleSelectAllVisibleAirports(Boolean(checked))}
                                                aria-label="Select all visible airports"
                                            />
                                        </TableHead>
                                        <TableHead className="relative">
                                            Code
                                            <button
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    beginColumnResize('code', event.clientX);
                                                }}
                                                className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                                aria-label="Resize code column"
                                            />
                                        </TableHead>
                                        <TableHead className="relative">
                                            Airport
                                            <button
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    beginColumnResize('airport', event.clientX);
                                                }}
                                                className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                                aria-label="Resize airport column"
                                            />
                                        </TableHead>
                                        <TableHead className="relative">
                                            Location
                                            <button
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    beginColumnResize('location', event.clientX);
                                                }}
                                                className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                                aria-label="Resize location column"
                                            />
                                        </TableHead>
                                        <TableHead className="relative">
                                            Tier
                                            <button
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    beginColumnResize('tier', event.clientX);
                                                }}
                                                className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                                aria-label="Resize tier column"
                                            />
                                        </TableHead>
                                        <TableHead className="relative">
                                            Type
                                            <button
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    beginColumnResize('type', event.clientX);
                                                }}
                                                className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                                aria-label="Resize type column"
                                            />
                                        </TableHead>
                                        <TableHead className="relative">
                                            Timezone
                                            <button
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    beginColumnResize('timezone', event.clientX);
                                                }}
                                                className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                                aria-label="Resize timezone column"
                                            />
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pagedAirports.map((airport) => (
                                        <TableRow
                                            key={airport.ident}
                                            data-state={airport.ident === selectedAirportIdent ? 'selected' : undefined}
                                            className={cn(ADMIN_TABLE_ROW_SURFACE_CLASS, 'cursor-pointer')}
                                            onClick={() => void handleSelectAirport(airport.ident)}
                                        >
                                            <TableCell onClick={(event) => event.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedAirportIdents.has(airport.ident)}
                                                    onCheckedChange={(checked) => toggleAirportSelection(airport.ident, Boolean(checked))}
                                                    aria-label={`Select ${airport.name}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-slate-900">{airport.iataCode || airport.ident}</div>
                                                <div className="text-xs text-slate-500">{airport.icaoCode || 'No ICAO'}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-slate-900">{airport.name}</div>
                                                <div className="text-xs text-slate-500">{airport.ident}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{airport.municipality || 'Unknown city'}</div>
                                                <div className="text-xs text-slate-500">{airport.countryName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold',
                                                    airport.commercialServiceTier === 'major'
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                        : airport.commercialServiceTier === 'regional'
                                                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                                                            : 'border-slate-200 bg-white text-slate-700',
                                                )}>
                                                    {formatServiceTierLabel(airport.commercialServiceTier)}
                                                </span>
                                            </TableCell>
                                            <TableCell>{formatAirportTypeLabel(airport.airportType)}</TableCell>
                                            <TableCell>{airport.timezone || '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {pagedAirports.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                                                No airports match the current filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-slate-500">
                                Page {safePage} of {pageCount}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                    disabled={safePage <= 1}
                                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                                    disabled={safePage >= pageCount}
                                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Airport Editor</h2>
                                <p className="text-sm text-slate-600">
                                    {editorMode === 'create'
                                        ? 'Create a new airport row in the database catalog. Commercial flags are derived automatically.'
                                        : 'Edit a selected row and save it back to the database catalog. Commercial flags are derived automatically.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {editorMode === 'create' && (
                                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                        New row draft
                                    </span>
                                )}
                                {!databaseBacked && (
                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                        Sync DB first to enable saves
                                    </span>
                                )}
                            </div>
                        </div>

                        {!editorDraft && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                Select an airport row to inspect and edit its catalog details, or start a new airport draft from the toolbar.
                            </div>
                        )}

                        {editorDraft && (
                            <>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-ident" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ident</label>
                                        <Input
                                            id="admin-airports-editor-ident"
                                            value={editorDraft.ident}
                                            disabled={editorMode !== 'create'}
                                            onChange={(event) => {
                                                setEditorDraft((current) => current ? { ...current, ident: event.target.value.toUpperCase() } : current);
                                                setEditorDirty(true);
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div id="admin-airports-editor-type-label" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Airport Type</div>
                                        <Select
                                            value={editorDraft.airportType}
                                            onValueChange={(value) => {
                                                setEditorDraft((current) => current ? {
                                                    ...current,
                                                    airportType: value as AirportReference['airportType'],
                                                } : current);
                                                setEditorDirty(true);
                                            }}
                                        >
                                            <SelectTrigger aria-labelledby="admin-airports-editor-type-label" className="h-10">
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
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-iata" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">IATA code</label>
                                        <Input id="admin-airports-editor-iata" value={editorDraft.iataCode} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, iataCode: event.target.value.toUpperCase() } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-icao" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">ICAO code</label>
                                        <Input id="admin-airports-editor-icao" value={editorDraft.icaoCode} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, icaoCode: event.target.value.toUpperCase() } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="admin-airports-editor-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Airport name</label>
                                    <Input id="admin-airports-editor-name" value={editorDraft.name} onChange={(event) => {
                                        setEditorDraft((current) => current ? { ...current, name: event.target.value } : current);
                                        setEditorDirty(true);
                                    }} />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-municipality" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Municipality</label>
                                        <Input id="admin-airports-editor-municipality" value={editorDraft.municipality} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, municipality: event.target.value } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-subdivision" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Subdivision name</label>
                                        <Input id="admin-airports-editor-subdivision" value={editorDraft.subdivisionName} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, subdivisionName: event.target.value } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-region" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Region code</label>
                                        <Input id="admin-airports-editor-region" value={editorDraft.regionCode} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, regionCode: event.target.value.toUpperCase() } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-timezone" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timezone</label>
                                        <Input id="admin-airports-editor-timezone" value={editorDraft.timezone} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, timezone: event.target.value } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Country or region</div>
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
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-country-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Country name</label>
                                        <Input
                                            id="admin-airports-editor-country-name"
                                            value={editorDraft.countryName}
                                            readOnly
                                            className="bg-slate-50 text-slate-600"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-latitude" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Latitude</label>
                                        <Input id="admin-airports-editor-latitude" type="number" step="0.000001" value={editorDraft.latitude} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, latitude: event.target.value } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="admin-airports-editor-longitude" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Longitude</label>
                                        <Input id="admin-airports-editor-longitude" type="number" step="0.000001" value={editorDraft.longitude} onChange={(event) => {
                                            setEditorDraft((current) => current ? { ...current, longitude: event.target.value } : current);
                                            setEditorDirty(true);
                                        }} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Scheduled passenger service</div>
                                        <div className="text-xs text-slate-500">Controls whether the airport stays eligible for nearby commercial lookups.</div>
                                    </div>
                                    <Switch
                                        checked={editorDraft.scheduledService}
                                        onCheckedChange={(checked) => {
                                            setEditorDraft((current) => current ? { ...current, scheduledService: Boolean(checked) } : current);
                                            setEditorDirty(true);
                                        }}
                                        aria-label="Scheduled passenger service"
                                    />
                                </div>

                                {editorPreviewAirport && (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                        <div className="font-semibold text-slate-900">Derived commercial status</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                                {formatServiceTierLabel(editorPreviewAirport.commercialServiceTier)}
                                            </span>
                                            <span className={cn(
                                                'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold',
                                                editorPreviewAirport.isCommercial
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : 'border-amber-200 bg-amber-50 text-amber-800',
                                            )}>
                                                {editorPreviewAirport.isCommercial ? 'Included in nearby-airport results' : 'Excluded from nearby-airport results'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditorDraft(editorMode === 'create' || !selectedAirport
                                                ? buildEmptyAirportDraft()
                                                : airportToDraft(selectedAirport));
                                            setEditorDirty(false);
                                        }}
                                        disabled={!editorDirty}
                                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {editorMode === 'create' ? 'Reset draft' : 'Reset changes'}
                                    </button>
                                    {editorMode !== 'create' && (
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteAirport()}
                                            disabled={!databaseBacked || deleting}
                                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 transition-colors hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {deleting ? <SpinnerGap size={16} className="animate-spin" /> : <Trash size={16} />}
                                            Delete airport
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void handleSaveAirport()}
                                        disabled={!databaseBacked || saving || deleting}
                                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {saving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                                        {editorMode === 'create' ? 'Create airport' : 'Save airport'}
                                    </button>
                                </div>
                            </>
                        )}
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
