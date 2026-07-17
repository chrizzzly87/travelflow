import type {
  TravelEntityReference,
  TravelEvidenceLevel,
} from './travelKnowledge';

export const JOURNEY_DESTINATION_BRIEF_VERSION = 1 as const;

export const JOURNEY_AUDIENCE_SIGNAL_TAGS = [
  'family_activity_supply',
  'lgbtq_scene',
  'solo_travel_interest',
] as const;

export type JourneyAudienceSignalTag = (typeof JOURNEY_AUDIENCE_SIGNAL_TAGS)[number];

export interface JourneyBriefSourceSupport {
  sourceKey: string;
  sourceUrl?: string;
  confidence: number;
  observedAt: string;
  validUntil?: string;
}

export interface JourneyBriefValue<T> {
  value: T;
  unit?: string;
  support: JourneyBriefSourceSupport;
}

export interface JourneyAudienceSignal {
  tagKey: JourneyAudienceSignalTag;
  relevance: number;
  evidenceLevel: TravelEvidenceLevel;
  evidenceNote?: string;
  sourceKey: string;
  sourceUrl?: string;
  validUntil?: string;
}

export interface JourneyDestinationCandidate {
  entity: TravelEntityReference;
  summary?: JourneyBriefValue<string>;
  tags: string[];
  audienceSignals: JourneyAudienceSignal[];
  matchScore: number;
  popularityScore: number;
  hiddenGemScore: number;
  selectedByTraveler: boolean;
}

export interface JourneyDestinationBrief {
  version: typeof JOURNEY_DESTINATION_BRIEF_VERSION;
  datasetVersion: string;
  city: TravelEntityReference;
  summary?: JourneyBriefValue<string>;
  bestMonths?: JourneyBriefValue<number[]>;
  seasonalCaution?: JourneyBriefValue<string>;
  transportSummary?: JourneyBriefValue<string>;
  signatureDishes?: JourneyBriefValue<string[]>;
  relativeCostLevel?: JourneyBriefValue<number>;
  recommendedStay?: JourneyBriefValue<{ min: number; max: number }>;
  tags: string[];
  audienceSignals: JourneyAudienceSignal[];
  neighborhoods: JourneyDestinationCandidate[];
  activities: JourneyDestinationCandidate[];
}
