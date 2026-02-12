
import type { TransportMode as CanonicalTransportMode } from './shared/transportModes';

export type ItemType = 'city' | 'activity' | 'travel' | 'travel-empty';
export type TransportMode = CanonicalTransportMode;
export type ActivityType = 
    'general' | 'food' | 'culture' | 'sightseeing' | 'relaxation' | 'nightlife' | 
    'sports' | 'hiking' | 'wildlife' | 'shopping' | 'adventure' | 'beach' | 'nature';

export type MapStyle = 'minimal' | 'standard' | 'dark' | 'satellite' | 'clean';
export type RouteMode = 'simple' | 'realistic';
export type AppLanguage = 'en' | 'de' | 'fr' | 'it' | 'ru';
export type MapColorMode = 'brand' | 'trip';

export interface ICoordinates {
    lat: number;
    lng: number;
}

export interface IAiInsights {
    cost: string;
    bestTime: string;
    tips: string;
}

export interface ITripAiMeta {
    provider: string;
    model: string;
    generatedAt: string;
    benchmarkSessionId?: string | null;
    benchmarkRunId?: string | null;
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
  cost?: string;
  countryCode?: string;
  countryName?: string;
  
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

export interface ITrip {
  id: string;
  title: string;
  startDate: string; // ISO Date string
  items: ITimelineItem[];
  countryInfo?: ICountryInfo;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
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
    timelineView: 'horizontal' | 'vertical'; // Dashboard vs List
    mapStyle: MapStyle;
    zoomLevel: number;
    routeMode?: RouteMode;
    showCityNames?: boolean;
    sidebarWidth?: number;
    timelineHeight?: number;
}

export interface ISharedState {
    trip: ITrip;
    view?: IViewSettings;
}

export type ShareMode = 'view' | 'edit';

export interface ISharedTripResult {
    trip: ITrip;
    view?: IViewSettings | null;
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
    timelineView?: 'horizontal' | 'vertical';
    showCityNames?: boolean;
    zoomLevel?: number;
    sidebarWidth?: number;
    timelineHeight?: number;
}

export interface TripPrefillData {
    countries?: string[];
    startDate?: string;
    endDate?: string;
    budget?: string;
    pace?: string;
    cities?: string;
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
