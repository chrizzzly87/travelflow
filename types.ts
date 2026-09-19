
import type { TransportMode as CanonicalTransportMode } from './shared/transportModes';
import type { ActivityType as CanonicalActivityType } from './shared/activityTypes';
import type { CreateTripPrefillDraft } from './shared/createTripPreferences';
import type { SavedRecommendation } from './shared/recommendations';

export type ItemType = 'city' | 'activity' | 'travel' | 'travel-empty';
export type TransportMode = CanonicalTransportMode;
export type CityPlanStatus = 'confirmed' | 'uncertain';
export type ActivityType = CanonicalActivityType;

export type MapStyle = 'minimal' | 'standard' | 'dark' | 'satellite' | 'clean' | 'cleanDark';
export type RouteMode = 'simple' | 'realistic';
export type RouteStatus = 'calculating' | 'ready' | 'failed' | 'idle';
export type RouteFailureReason =
  | 'unsupported_mode'
  | 'invalid_distance'
  | 'distance_cap_exceeded'
  | 'zero_results'
  | 'no_route_path'
  | 'straight_path'
  | 'api_unavailable'
  | 'request_error';
export type AppLanguage = 'en' | 'es' | 'de' | 'fr' | 'pt' | 'ru' | 'it' | 'pl' | 'ko' | 'fa' | 'ur';
export type MapColorMode = 'brand' | 'trip';

/**
 * Which basemap the traveller wants to look at. `auto` defers to whatever the
 * deploy's preset resolves to, which is the only value that follows an
 * administrator changing the default later.
 *
 * `apple` is a handoff, not a basemap: Apple has no embeddable renderer here, so
 * choosing it keeps the current basemap and promotes the "open in Apple Maps"
 * action. See `docs/superpowers/specs/2026-09-18-map-provider-customization-design.md`.
 */
export type MapRendererChoice = 'auto' | 'google' | 'mapbox';

export type MapHandoffTarget = 'google' | 'apple';

/**
 * The three axes a map look actually has. The six named `MapStyle` values were
 * only ever combinations of these two, plus a satellite base:
 *
 *   standard = default + day     dark      = default + dusk
 *   minimal  = monochrome + day  cleanDark = monochrome + night
 *   clean    = faded + day       satellite = satellite base
 *
 * Exposing the axes gives dawn and dusk, which no named style reached, and
 * removes the duplication between `minimal` and `clean`. `MapStyle` stays as
 * the stored legacy field and as what the Google renderer understands.
 */
export type MapBaseSurface = 'map' | 'satellite';
export type MapColorTheme = 'default' | 'faded' | 'monochrome';
/** `auto` follows the device's light/dark setting. */
export type MapLightPreset = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';

export type MapRouteThickness = 'thin' | 'normal' | 'thick';

/**
 * Everything the map customize sheet writes that did not already have a home on
 * `IViewSettings`. The pre-existing flat fields — `mapStyle`, `routeMode`,
 * `showCityNames`, `zoomLevel`, `mapDockMode` — deliberately stay where they
 * are; only `shared/mapPreferences.ts` knows about both shapes.
 */
export interface IMapCustomization {
    renderer?: MapRendererChoice;
    /** Preferred "open in" app for places and for the whole trip. */
    handoffTarget?: MapHandoffTarget;

    // Look, as three axes rather than six named styles.
    base?: MapBaseSurface;
    colorTheme?: MapColorTheme;
    lightPreset?: MapLightPreset;

    /** Frame a selected city on its own plan and drop the rest of the journey. */
    cityFocusMode?: boolean;

    // What the basemap draws.
    showPlaceLabels?: boolean;
    showRoadLabels?: boolean;
    showTransitLabels?: boolean;
    showPoiLabels?: boolean;
    showRoadsAndTransit?: boolean;
    showPedestrianRoads?: boolean;
    showAdminBoundaries?: boolean;
    /** Extruded buildings. Mapbox only, and the reason tilt is worth having. */
    show3dObjects?: boolean;
    showTerrain?: boolean;
    /** Live traffic. Google only. */
    showTraffic?: boolean;
    /** Transit lines and stations. Google only. */
    showTransitLines?: boolean;

    // What the trip draws on top.
    showActivityMarkers?: boolean;
    /** Fade days already behind you so the rest of the trip reads first. */
    dimPastDays?: boolean;
    routeThickness?: MapRouteThickness;
    /** Direction arrows along the connecting lines. */
    showRouteArrows?: boolean;
    /** Dashed rather than solid connecting lines. */
    dashedRoutes?: boolean;

    // Camera.
    /** Globe reads well on a long-haul trip and badly in a small pane. */
    useGlobeProjection?: boolean;
    /** Degrees of camera tilt. Mapbox only — a Google raster map cannot tilt. */
    pitch?: number;
}

export type SystemRole = 'admin' | 'user';
export type PlanTierKey = 'tier_free' | 'tier_mid' | 'tier_premium';
export type TripAccessClassKey = 'free' | 'pro';
export type ZoomBehavior = 'fit' | 'manual';

export interface Entitlements {
    maxActiveTrips: number | null;
    maxTotalTrips: number | null;
    tripExpirationDays: number | null;
    canShare: boolean;
    canCreateEditableShares: boolean;
    canViewProTrips: boolean;
    canCreateProTrips: boolean;
    canUseTripAgent?: boolean;
    tripAgentRequestsPerDay?: number | null;
}

export type UserBillingLifecycleState =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'paused'
  | 'canceled_grace'
  | 'inactive'
  | 'none'
  | 'unknown';

export interface UserBillingSummary {
    providerSubscriptionId: string | null;
    providerStatus: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    cancelAt: string | null;
    canceledAt: string | null;
    graceEndsAt: string | null;
    accessUntil: string | null;
    lifecycleState: UserBillingLifecycleState;
}

export interface UserAccessContext {
    userId: string | null;
    email: string | null;
    isAnonymous: boolean;
    role: SystemRole;
    tierKey: PlanTierKey;
    entitlements: Entitlements;
    onboardingCompleted: boolean;
    accountStatus: 'active' | 'disabled' | 'deleted';
    termsCurrentVersion: string | null;
    termsRequiresReaccept: boolean;
    termsAcceptedVersion: string | null;
    termsAcceptedAt: string | null;
    termsAcceptanceRequired: boolean;
    termsNoticeRequired: boolean;
    billing: UserBillingSummary;
}

export interface ICoordinates {
    lat: number;
    lng: number;
}

/**
 * Provenance of a stored coordinate pair. `user` outranks everything: once a
 * traveller picks a place by hand the resolver leaves it alone.
 */
export type CoordinatesSource = 'ai' | 'agent' | 'places' | 'user';

export interface IAiInsights {
    cost: string;
    bestTime: string;
    tips: string;
}

export type TripGenerationFlow = 'classic' | 'wizard' | 'surprise';
export type TripGenerationState = 'queued' | 'running' | 'succeeded' | 'failed';
export type TripGenerationFailureKind = 'timeout' | 'abort' | 'quality' | 'provider' | 'network' | 'unknown';
export type TripGenerationJobState = 'queued' | 'leased' | 'completed' | 'failed' | 'dead';

export interface TripGenerationInputSnapshot {
    flow: TripGenerationFlow;
    destinationLabel?: string;
    startDate?: string;
    endDate?: string;
    payload: Record<string, unknown>;
    createdAt: string;
}

export interface TripGenerationAttemptSummary {
    id: string;
    flow: TripGenerationFlow;
    source: string;
    state: TripGenerationState;
    startedAt: string;
    finishedAt?: string | null;
    durationMs?: number | null;
    requestId?: string | null;
    provider?: string | null;
    model?: string | null;
    providerModel?: string | null;
    statusCode?: number | null;
    failureKind?: TripGenerationFailureKind | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface TripGenerationMeta {
    state: TripGenerationState;
    latestAttempt?: TripGenerationAttemptSummary | null;
    attempts?: TripGenerationAttemptSummary[];
    inputSnapshot?: TripGenerationInputSnapshot | null;
    retryCount?: number;
    retryRequestedAt?: string | null;
    lastSucceededAt?: string | null;
    lastFailedAt?: string | null;
}

export interface TripGenerationJobSummary {
    id: string;
    tripId: string;
    ownerId: string;
    attemptId: string;
    state: TripGenerationJobState;
    priority: number;
    retryCount: number;
    maxRetries: number;
    runAfter: string;
    leaseExpiresAt?: string | null;
    leasedBy?: string | null;
    payload?: Record<string, unknown> | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ITripAiMeta {
    provider: string;
    model: string;
    generatedAt: string;
    benchmarkSessionId?: string | null;
    benchmarkRunId?: string | null;
    generation?: TripGenerationMeta;
}

export interface IHotel {
    id: string;
    name: string;
    address: string;
    coordinates?: ICoordinates;
    notes?: string;
}

export interface ICountryInfo {
    currencyCode: string; // e.g. "JPY"
    currencyName: string; // e.g. "Japanese Yen"
    exchangeRate: number; // 1 EUR = X Local Currency
    languages: string[];
    electricSockets: string; // Description e.g. "Type A, Type B"
    visaInfoUrl?: string; // Link to info
    auswaertigesAmtUrl?: string; // Link to German Foreign Office
}

export interface ITimelineItem {
  id: string;
  type: ItemType;
  title: string;
  startDateOffset: number; // Days from trip start (0-indexed, can be float)
  duration: number; // In days
  color: string;
  description?: string;
  link?: string;
  location?: string;
  coordinates?: ICoordinates; 
  /** Where `coordinates` came from, so a user pick is never overwritten by a lookup. */
  coordinatesSource?: CoordinatesSource;
  /**
   * Normalized location string the stored coordinates were resolved from. The
   * resolver re-runs only when this no longer matches the current location, so
   * an unchanged activity never calls the location service twice.
   */
  coordinatesQuery?: string;
  /** Google Place ID, when resolution matched an exact place. */
  placeId?: string;
  imageUrl?: string;
  cost?: string;
  countryCode?: string;
  countryName?: string;

  // Optional city planning metadata for tentative/alternative stops.
  cityPlanStatus?: CityPlanStatus;
  cityPlanGroupId?: string;
  cityPlanOptionIndex?: number;
  isApproved?: boolean;
  
  // Specific properties
  transportMode?: TransportMode; 
  activityType?: ActivityType[]; // Array for multi-select
  aiInsights?: IAiInsights;
  hotels?: IHotel[];
  
  // Travel Specifics
  bufferBefore?: number; // Minutes
  bufferAfter?: number; // Minutes
  departureTime?: string; // HH:MM
  routeDistanceKm?: number; // Cached route distance (mode-specific)
  routeDurationHours?: number; // Cached route duration (mode-specific)
  loading?: boolean;
}

export interface ITripRecommendationState {
    /** Kept, not yet placed on a day. */
    saved: SavedRecommendation[];
    /** Swiped away; never offered again for this trip. */
    dismissedIds: string[];
}

export interface ITrip {
  id: string;
  title: string;
  startDate: string; // ISO Date string
  items: ITimelineItem[];
  countryInfo?: ICountryInfo;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  pinnedAt?: number;
  showOnPublicProfile?: boolean;
  forkedFromTripId?: string;
  forkedFromShareToken?: string;
  forkedFromShareVersionId?: string;
  roundTrip?: boolean;
  cityColorPaletteId?: string;
  mapColorMode?: MapColorMode;
  aiMeta?: ITripAiMeta;
  defaultView?: IViewSettings;
  status?: 'active' | 'archived' | 'expired';
  tripExpiresAt?: string | null;
  sourceKind?: 'created' | 'duplicate_shared' | 'duplicate_trip' | 'example' | 'ai_benchmark';
  sourceTemplateId?: string | null;
  sourceOwnerType?: 'user' | 'system_catalog';
  sourceOwnerHandle?: string | null;
  /**
   * Recommendations kept or rejected for this trip.
   *
   * Lives on the trip because a trip already persists as a JSON document and
   * the pool is meaningless without it; keeping it here also means a dismissal
   * follows the traveller across devices instead of living in one browser.
   */
  recommendationState?: ITripRecommendationState;
  requiredTierKey?: TripAccessClassKey;
  isExample?: boolean;
  exampleTemplateId?: string;
  exampleTemplateCountries?: string[];
  forkedFromExampleTemplateId?: string;
}

export interface IDragState {
  isDragging: boolean;
  itemId: string | null;
  action: 'move' | 'resize-left' | 'resize-right' | null;
  startX: number;
  originalOffset: number;
  originalDuration: number;
}

export type DeleteStrategy = 'extend-prev' | 'extend-next' | 'move-rest';

export interface IViewSettings {
    layoutMode: 'vertical' | 'horizontal';
    timelineMode?: 'calendar' | 'timeline';
    timelineView: 'horizontal' | 'vertical'; // Calendar orientation
    mapStyle: MapStyle;
    zoomLevel: number;
    zoomBehavior?: ZoomBehavior;
    mapDockMode?: 'docked' | 'floating';
    routeMode?: RouteMode;
    showCityNames?: boolean;
    sidebarWidth?: number;
    detailsWidth?: number;
    timelineHeight?: number;
    mapCustomization?: IMapCustomization;
}

export interface ISharedState {
    trip: ITrip;
    view?: IViewSettings;
}

export type ShareMode = 'view' | 'edit';

export interface ISharedTripResult {
    trip: ITrip;
    view?: IViewSettings | null;
    shareView?: IViewSettings | null;
    mode: ShareMode;
    allowCopy?: boolean;
    latestVersionId?: string | null;
}

export interface ISharedTripVersionResult extends ISharedTripResult {
    versionId: string;
}

export interface IUserSettings {
    language?: AppLanguage;
    mapStyle?: MapStyle;
    routeMode?: RouteMode;
    layoutMode?: 'vertical' | 'horizontal';
    timelineMode?: 'calendar' | 'timeline';
    timelineView?: 'horizontal' | 'vertical';
    showCityNames?: boolean;
    zoomLevel?: number;
    sidebarWidth?: number;
    detailsWidth?: number;
    timelineHeight?: number;
    /** The traveller's default map look, applied to trips that carry none. */
    mapCustomization?: IMapCustomization;
}

export interface TripPrefillData {
    countries?: string[];
    startDate?: string;
    endDate?: string;
    budget?: string;
    pace?: string;
    /** Legacy comma-separated city list. Still written for backward compatibility. */
    cities?: string;
    /** Ordered, structured city list. Preferred over `cities` when both are present. */
    cityList?: string[];
    notes?: string;
    roundTrip?: boolean;
    mode?: 'classic' | 'wizard';
    styles?: string[];
    vibes?: string[];
    logistics?: string[];
    meta?: {
        source?: string;
        author?: string;
        label?: string;
        draft?: CreateTripPrefillDraft | Record<string, unknown>;
        [key: string]: unknown;
    };
}

export interface ITripShareRecord {
    id: string;
    tripId: string;
    token: string;
    mode: ShareMode;
    allowCopy: boolean;
    createdAt: string;
    expiresAt?: string | null;
    revokedAt?: string | null;
    isActive: boolean;
}
