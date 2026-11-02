export interface DestinationWeatherDay {
  date: string;
  day: string;
  min_temp: number;
  max_temp: number;
  condition: string;
  weather_code?: number;
}

export interface DestinationCountryProfileSections {
  spf_recommendations?: Record<string, string>;
  electrical_info?: {
    voltage?: string;
    frequency?: string;
    plugTypes?: string[];
    ukAdapterNeeded?: boolean;
  };
  driving_info?: {
    side?: string;
    licenseRequirement?: string;
    speedLimitMotorway?: string;
    speedLimitUrban?: string;
    alcoholLimit?: string;
  };
  emergency_info?: Record<string, string>;
  tipping_info?: {
    summary?: string;
    categories?: Array<{ category: string; amount: string }>;
  };
  card_info?: {
    acceptance?: string;
    brands?: Array<{ name: string; acceptance: string }>;
    hotlines?: Array<{ brand: string; number: string }>;
  };
  mobile_info?: {
    roamingInfo?: string;
    dataPackage?: { size?: string; price?: string };
    networkTypes?: string[];
  };
  internet_info?: {
    summary?: string;
    wifiCoverage?: string;
    averageSpeed?: string;
  };
  health_info?: {
    summary?: string;
    insuranceSummary?: string;
    vaccinationRequired?: boolean;
  };
  entry_requirements?: {
    source_url?: string;
    tips?: string[];
    bonus_tips?: string[];
  };
  embassy_info?: {
    name?: string;
    phone?: string;
    address?: string;
    website?: string;
  };
}

export interface DestinationCountrySourceProfile {
  currencyCode: string | null;
  timezone: string | null;
  callingCode: string | null;
  popularity: number | null;
  summary: string | null;
  alertMessage: string | null;
  safetyTips: string[];
  bonusTips: string[];
  sections: DestinationCountryProfileSections;
  faqs: Array<{ question: string; answer: string }>;
  recentUpdates: Array<{ category?: string; messages?: string[]; timestamp?: string }>;
  airports: Array<{ iata: string; name: string }>;
  beaches: Array<{ name: string; image_url?: string }>;
  cities: Array<{ name: string; slug: string }>;
  weather: DestinationWeatherDay[];
  exchange: { rate: number | null; base: string | null };
}

export interface DestinationSourceProvenance {
  provider: string;
  originUrl: string;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  payloadHash: string;
}

export interface DestinationCountryProfileResult {
  profile: DestinationCountrySourceProfile;
  provenance: DestinationSourceProvenance | null;
}
