import type { ActivityType } from '../types';
import type {
  TravelEntityCatalogItem,
  TravelEntityFact,
  TravelEntityReference,
} from './travelKnowledge';
import {
  getTravelEntityActivityTypes,
  getTravelEntitySourceKeys,
  toTravelEntityReference,
} from './travelKnowledgeProjection';

export const TRAVEL_ACTIVITY_KNOWLEDGE_VERSION = 1 as const;

export interface TravelKnowledgeSupport {
  sourceKey: string;
  sourceUrl?: string;
  confidence: number;
  reviewStatus: TravelEntityFact['reviewStatus'];
  observedAt: string;
  validUntil?: string;
}

export interface SupportedTravelValue<T> {
  value: T;
  support: TravelKnowledgeSupport;
}

export interface TravelActivityDuration {
  min: number;
  max: number;
  unit: 'minutes';
}

export interface TravelActivityOpeningHours {
  timezone: string;
  schedule: Array<{
    days: string[];
    opens: string;
    closes: string;
    scope?: string;
  }>;
  lastEntry?: string;
  notes?: string[];
  checkBeforeVisit: boolean;
}

export interface TravelActivityAdmission {
  currency: string;
  adultForeign?: number;
  childForeign?: number;
  adultLocal?: number;
  childLocal?: number;
  free?: boolean;
  notes?: string[];
  checkBeforeVisit: boolean;
}

export interface TravelActivityBooking {
  mode: 'walk_in' | 'optional_advance' | 'recommended_advance' | 'required_advance';
  bookingUrl?: string;
  notes?: string[];
}

export interface TravelActivityAudienceFit {
  audience: 'family' | 'lgbtq' | 'solo' | 'mobility';
  fit: 'good' | 'conditional' | 'limited' | 'unknown';
  notes: string[];
}

export interface TravelActivityFreshness {
  status: 'current' | 'expired' | 'undated';
  latestObservedAt?: string;
  earliestValidUntil?: string;
}

export interface TravelActivityKnowledge {
  version: typeof TRAVEL_ACTIVITY_KNOWLEDGE_VERSION;
  entity: TravelEntityReference;
  categories: ActivityType[];
  summary?: SupportedTravelValue<string>;
  recommendedDuration?: SupportedTravelValue<TravelActivityDuration>;
  bestTime?: SupportedTravelValue<string[]>;
  openingHours?: SupportedTravelValue<TravelActivityOpeningHours>;
  admission?: SupportedTravelValue<TravelActivityAdmission>;
  booking?: SupportedTravelValue<TravelActivityBooking>;
  dressCode?: SupportedTravelValue<string[]>;
  accessibility?: SupportedTravelValue<string[]>;
  audience: Array<SupportedTravelValue<TravelActivityAudienceFit>>;
  practicalNotes?: SupportedTravelValue<string[]>;
  sourceKeys: string[];
  freshness: TravelActivityFreshness;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const sourceUrlForFact = (fact: TravelEntityFact): string | undefined => (
  typeof fact.metadata.sourceUrl === 'string' ? fact.metadata.sourceUrl : undefined
);

const supportedValue = <T>(fact: TravelEntityFact, value: T): SupportedTravelValue<T> => ({
  value,
  support: {
    sourceKey: fact.sourceKey,
    sourceUrl: sourceUrlForFact(fact),
    confidence: fact.confidence,
    reviewStatus: fact.reviewStatus,
    observedAt: fact.observedAt,
    validUntil: fact.validUntil,
  },
});

const factByKey = (entity: TravelEntityCatalogItem, key: string): TravelEntityFact | undefined => (
  entity.facts.find((fact) => fact.factKey === key && fact.reviewStatus !== 'deprecated')
);

const stringValue = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const stringArray = (value: unknown): string[] | null => (
  Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim())
    ? value.map((entry) => entry.trim())
    : null
);

const numberValue = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const durationValue = (value: unknown): TravelActivityDuration | null => {
  if (!isRecord(value)) return null;
  const min = numberValue(value.min);
  const max = numberValue(value.max);
  if (min === undefined || max === undefined || min <= 0 || max < min) return null;
  return { min, max, unit: 'minutes' };
};

const openingHoursValue = (value: unknown): TravelActivityOpeningHours | null => {
  if (!isRecord(value) || !Array.isArray(value.schedule)) return null;
  const schedule = value.schedule.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const days = stringArray(entry.days);
    const opens = stringValue(entry.opens);
    const closes = stringValue(entry.closes);
    if (!days || !opens || !closes) return [];
    return [{
      days,
      opens,
      closes,
      scope: stringValue(entry.scope) ?? undefined,
    }];
  });
  const timezone = stringValue(value.timezone);
  if (!timezone || schedule.length === 0) return null;
  return {
    timezone,
    schedule,
    lastEntry: stringValue(value.lastEntry) ?? undefined,
    notes: stringArray(value.notes) ?? undefined,
    checkBeforeVisit: value.checkBeforeVisit !== false,
  };
};

const admissionValue = (value: unknown): TravelActivityAdmission | null => {
  if (!isRecord(value)) return null;
  const currency = stringValue(value.currency);
  if (!currency) return null;
  return {
    currency,
    adultForeign: numberValue(value.adultForeign),
    childForeign: numberValue(value.childForeign),
    adultLocal: numberValue(value.adultLocal),
    childLocal: numberValue(value.childLocal),
    free: value.free === true,
    notes: stringArray(value.notes) ?? undefined,
    checkBeforeVisit: value.checkBeforeVisit !== false,
  };
};

const BOOKING_MODES = new Set<TravelActivityBooking['mode']>([
  'walk_in',
  'optional_advance',
  'recommended_advance',
  'required_advance',
]);

const bookingValue = (value: unknown): TravelActivityBooking | null => {
  if (!isRecord(value) || typeof value.mode !== 'string' || !BOOKING_MODES.has(value.mode as TravelActivityBooking['mode'])) {
    return null;
  }
  return {
    mode: value.mode as TravelActivityBooking['mode'],
    bookingUrl: stringValue(value.bookingUrl) ?? undefined,
    notes: stringArray(value.notes) ?? undefined,
  };
};

const audienceValue = (
  value: unknown,
  audience: TravelActivityAudienceFit['audience'],
): TravelActivityAudienceFit | null => {
  if (!isRecord(value) || !['good', 'conditional', 'limited', 'unknown'].includes(String(value.fit))) return null;
  return {
    audience,
    fit: value.fit as TravelActivityAudienceFit['fit'],
    notes: stringArray(value.notes) ?? [],
  };
};

const freshnessForFacts = (
  facts: readonly TravelEntityFact[],
  now: Date,
): TravelActivityFreshness => {
  const timestamps = facts.map((fact) => fact.observedAt).filter((value) => Number.isFinite(Date.parse(value)));
  const validUntilValues = facts.flatMap((fact) => (
    fact.validUntil && Number.isFinite(Date.parse(fact.validUntil)) ? [fact.validUntil] : []
  ));
  const latestObservedAt = timestamps.toSorted((left, right) => Date.parse(right) - Date.parse(left))[0];
  const earliestValidUntil = validUntilValues.toSorted((left, right) => Date.parse(left) - Date.parse(right))[0];
  return {
    status: earliestValidUntil
      ? Date.parse(earliestValidUntil) < now.getTime() ? 'expired' : 'current'
      : 'undated',
    latestObservedAt,
    earliestValidUntil,
  };
};

export const buildTravelActivityKnowledge = (
  entity: TravelEntityCatalogItem,
  now = new Date(),
): TravelActivityKnowledge | undefined => {
  if (entity.entityType !== 'poi') return undefined;
  const summaryFact = factByKey(entity, 'summary');
  const summary = summaryFact ? stringValue(summaryFact.valueJson) : null;
  const durationFact = factByKey(entity, 'visit.duration_minutes');
  const duration = durationFact ? durationValue(durationFact.valueJson) : null;
  const bestTimeFact = factByKey(entity, 'visit.best_time');
  const bestTime = bestTimeFact ? stringArray(bestTimeFact.valueJson) : null;
  const openingHoursFact = factByKey(entity, 'opening_hours.regular');
  const openingHours = openingHoursFact ? openingHoursValue(openingHoursFact.valueJson) : null;
  const admissionFact = factByKey(entity, 'pricing.admission');
  const admission = admissionFact ? admissionValue(admissionFact.valueJson) : null;
  const bookingFact = factByKey(entity, 'visit.booking');
  const booking = bookingFact ? bookingValue(bookingFact.valueJson) : null;
  const dressCodeFact = factByKey(entity, 'visit.dress_code');
  const dressCode = dressCodeFact ? stringArray(dressCodeFact.valueJson) : null;
  const accessibilityFact = factByKey(entity, 'visit.accessibility');
  const accessibility = accessibilityFact ? stringArray(accessibilityFact.valueJson) : null;
  const practicalNotesFact = factByKey(entity, 'visit.practical_notes');
  const practicalNotes = practicalNotesFact ? stringArray(practicalNotesFact.valueJson) : null;
  const audience = (['family', 'lgbtq', 'solo', 'mobility'] as const).flatMap((audienceKey) => {
    const fact = factByKey(entity, `audience.${audienceKey}_fit`);
    const fit = fact ? audienceValue(fact.valueJson, audienceKey) : null;
    return fact && fit ? [supportedValue(fact, fit)] : [];
  });
  const relevantFacts = [
    summaryFact,
    durationFact,
    bestTimeFact,
    openingHoursFact,
    admissionFact,
    bookingFact,
    dressCodeFact,
    accessibilityFact,
    practicalNotesFact,
    ...entity.facts.filter((fact) => fact.factKey.startsWith('audience.') && fact.reviewStatus !== 'deprecated'),
  ].filter((fact): fact is TravelEntityFact => Boolean(fact));

  return {
    version: TRAVEL_ACTIVITY_KNOWLEDGE_VERSION,
    entity: toTravelEntityReference(entity),
    categories: getTravelEntityActivityTypes(entity),
    summary: summaryFact && summary ? supportedValue(summaryFact, summary) : undefined,
    recommendedDuration: durationFact && duration ? supportedValue(durationFact, duration) : undefined,
    bestTime: bestTimeFact && bestTime ? supportedValue(bestTimeFact, bestTime) : undefined,
    openingHours: openingHoursFact && openingHours ? supportedValue(openingHoursFact, openingHours) : undefined,
    admission: admissionFact && admission ? supportedValue(admissionFact, admission) : undefined,
    booking: bookingFact && booking ? supportedValue(bookingFact, booking) : undefined,
    dressCode: dressCodeFact && dressCode ? supportedValue(dressCodeFact, dressCode) : undefined,
    accessibility: accessibilityFact && accessibility ? supportedValue(accessibilityFact, accessibility) : undefined,
    audience,
    practicalNotes: practicalNotesFact && practicalNotes ? supportedValue(practicalNotesFact, practicalNotes) : undefined,
    sourceKeys: getTravelEntitySourceKeys(entity),
    freshness: freshnessForFacts(relevantFacts, now),
  };
};
