
export type ItemType = 'city' | 'activity' | 'travel' | 'travel-empty';
export type TransportMode = 'plane' | 'train' | 'bus' | 'boat' | 'car';
export type ActivityType = 
    'general' | 'food' | 'culture' | 'sightseeing' | 'relaxation' | 'nightlife' | 
    'sports' | 'hiking' | 'wildlife' | 'shopping' | 'adventure' | 'beach' | 'nature';

export interface ICoordinates {
    lat: number;
    lng: number;
}

export interface IAiInsights {
    cost: string;
    bestTime: string;
    tips: string;
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
  
  // Specific properties
  transportMode?: TransportMode; 
  activityType?: ActivityType[]; // Array for multi-select
  aiInsights?: IAiInsights;
  hotels?: IHotel[];
  
  // Travel Specifics
  bufferBefore?: number; // Minutes
  bufferAfter?: number; // Minutes
  departureTime?: string; // HH:MM
}

export interface ITrip {
  id: string;
  title: string;
  startDate: string; // ISO Date string
  items: ITimelineItem[];
  countryInfo?: ICountryInfo;
  createdAt: number;
  updatedAt: number;
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