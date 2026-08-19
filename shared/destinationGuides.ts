export type DestinationGuideKind = 'country' | 'city' | 'island';
export type DestinationSeason = 'ideal' | 'shoulder' | 'avoid';
export type DestinationSourcePurpose = 'catalog' | 'guide' | 'entry_requirements' | 'embassy' | 'event_calendar' | 'connectivity';

export interface DestinationSourceLink {
  label: string;
  url: string;
  purpose: DestinationSourcePurpose;
  isReferral: boolean;
  removedTrackingParameters: string[];
  accessedAt: string;
}

export interface DestinationCatalogEntry {
  name: string;
  code: string;
  slug: string;
  region: string;
  popularity: number;
  contentUpdatedAt: string | null;
  canonicalPath: string;
}

export interface DestinationSeasonality {
  idealMonths: number[];
  shoulderMonths: number[];
  avoidMonths: number[];
  note?: string;
}

/**
 * How an event repeats. Most festivals are NOT fixed to a Gregorian day:
 * - `fixed`     same calendar day(s) every year (Bastille Day, Songkran)
 * - `lunar`     tied to a lunar/lunisolar calendar (Lunar New Year, Diwali, Vesak)
 * - `movable`   tied to a movable anchor or an annually announced programme
 *               (Easter-linked carnivals, Oktoberfest, Edinburgh Fringe)
 * - `seasonal`  a season rather than an event with a start day (cherry blossom,
 *               Christmas markets, Vienna ball season)
 */
export type DestinationEventRecurrenceKind = 'fixed' | 'lunar' | 'movable' | 'seasonal';

/** Where inside the month a non-exact event usually lands. */
export type DestinationEventMonthQualifier = 'early' | 'mid' | 'late' | 'throughout';

export interface DestinationEventRecurrence {
  kind: DestinationEventRecurrenceKind;
  /** Plain-language rule, e.g. "Last Wednesday of August". Never a fabricated date. */
  rule?: string;
}

export interface DestinationEvent {
  id: string;
  name: string;
  /** Month the event usually falls in (1-12). Always present, even for movable events. */
  month: number;
  type: string;
  summary: string;
  sourceUrl?: string;
  /** Fixed single-day events (1-31). */
  day?: number;
  /** Fixed multi-day events inside one month (1-31). */
  startDay?: number;
  endDay?: number;
  /** Length of the celebration window in days, used with `knownDates`. */
  durationDays?: number;
  recurrence?: DestinationEventRecurrence;
  /**
   * Confirmed start dates for specific years, keyed by 4-digit year with an
   * ISO `YYYY-MM-DD` value. Only populate with sourced dates — a missing year
   * degrades to an honest "usually in <month>" rendering.
   */
  knownDates?: Record<string, string>;
  /** Used when no exact date can be resolved, e.g. "usually late August". */
  monthQualifier?: DestinationEventMonthQualifier;
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECURRENCE_KINDS: DestinationEventRecurrenceKind[] = ['fixed', 'lunar', 'movable', 'seasonal'];
const MONTH_QUALIFIERS: DestinationEventMonthQualifier[] = ['early', 'mid', 'late', 'throughout'];

const isValidDayOfMonth = (value: number): boolean => Number.isInteger(value) && value >= 1 && value <= 31;

export const validateDestinationEventDates = (event: DestinationEvent): string[] => {
  const errors: string[] = [];

  ([['day', event.day], ['startDay', event.startDay], ['endDay', event.endDay]] as const).forEach(([label, value]) => {
    if (value === undefined) return;
    if (!isValidDayOfMonth(value)) errors.push(`event ${event.id}: ${label} must be between 1 and 31`);
  });

  if (event.startDay !== undefined && event.endDay === undefined) errors.push(`event ${event.id}: startDay requires endDay`);
  if (event.endDay !== undefined && event.startDay === undefined) errors.push(`event ${event.id}: endDay requires startDay`);
  if (event.startDay !== undefined && event.endDay !== undefined && event.endDay < event.startDay) {
    errors.push(`event ${event.id}: endDay must not be before startDay`);
  }
  if (event.day !== undefined && event.startDay !== undefined) {
    errors.push(`event ${event.id}: use either day or startDay/endDay, not both`);
  }
  if (event.durationDays !== undefined && (!Number.isInteger(event.durationDays) || event.durationDays < 1)) {
    errors.push(`event ${event.id}: durationDays must be a positive integer`);
  }
  if (event.recurrence && !RECURRENCE_KINDS.includes(event.recurrence.kind)) {
    errors.push(`event ${event.id}: unknown recurrence kind ${event.recurrence.kind}`);
  }
  if (event.monthQualifier && !MONTH_QUALIFIERS.includes(event.monthQualifier)) {
    errors.push(`event ${event.id}: unknown monthQualifier ${event.monthQualifier}`);
  }

  Object.entries(event.knownDates || {}).forEach(([year, isoDate]) => {
    if (!/^\d{4}$/.test(year)) errors.push(`event ${event.id}: knownDates key ${year} must be a 4-digit year`);
    if (!ISO_DAY_PATTERN.test(isoDate)) {
      errors.push(`event ${event.id}: knownDates.${year} must be an ISO YYYY-MM-DD date`);
      return;
    }
    if (!isoDate.startsWith(`${year}-`)) {
      errors.push(`event ${event.id}: knownDates.${year} must fall inside year ${year}`);
    }
  });

  return errors;
};

export interface DestinationGuideFacts {
  currencyCode?: string;
  callingCode?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  drivingSide?: 'left' | 'right';
  voltage?: string;
  frequency?: string;
  plugTypes?: string[];
  cardAcceptance?: string;
  networkTypes?: string[];
  averageInternetSpeed?: string;
  emergencyNumbers?: Record<string, string>;
}

export interface DestinationGuideEntry {
  id: string;
  name: string;
  slug: string;
  kind: DestinationGuideKind;
  countryCode: string;
  region: string;
  parentSlug?: string;
  priorityRank?: number;
  tags: string[];
  summary?: string;
  suggestedTripDays?: { min: number; max: number; recommended: number };
  seasonality?: DestinationSeasonality;
  facts?: DestinationGuideFacts;
  airports: Array<{ iata: string; name: string }>;
  beaches: string[];
  highlights: string[];
  events: DestinationEvent[];
  sourceLinks: DestinationSourceLink[];
  sourceUpdatedAt: string | null;
  reviewedAt: string;
}

export interface DestinationGuideDocument {
  schemaVersion: 1;
  generatedAt: string;
  selection: {
    countryCount: number;
    method: string;
    countryCodes: string[];
  };
  sourceCatalog: DestinationCatalogEntry[];
  guides: DestinationGuideEntry[];
}

const TRACKING_PARAMETER_PATTERNS = [
  /^utm_/i,
  /^ref$/i,
  /^referrer$/i,
  /^affiliate$/i,
  /^affiliate_id$/i,
  /^aff$/i,
  /^aff_id$/i,
  /^campaign$/i,
  /^campaign_id$/i,
  /^click_id$/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
];

export const isTrackingParameter = (name: string): boolean => (
  TRACKING_PARAMETER_PATTERNS.some((pattern) => pattern.test(name))
);

export const cleanDestinationSourceUrl = (rawUrl: string): {
  url: string;
  removedTrackingParameters: string[];
} => {
  const parsed = new URL(rawUrl);
  const removedTrackingParameters: string[] = [];

  Array.from(parsed.searchParams.keys()).forEach((name) => {
    if (!isTrackingParameter(name)) return;
    removedTrackingParameters.push(name);
    parsed.searchParams.delete(name);
  });

  parsed.hash = '';
  return {
    url: parsed.toString(),
    removedTrackingParameters: Array.from(new Set(removedTrackingParameters)).sort(),
  };
};

export const buildDestinationSourceLink = ({
  label,
  rawUrl,
  purpose,
  accessedAt,
  referralHint = false,
}: {
  label: string;
  rawUrl: string;
  purpose: DestinationSourcePurpose;
  accessedAt: string;
  referralHint?: boolean;
}): DestinationSourceLink => {
  const cleaned = cleanDestinationSourceUrl(rawUrl);
  return {
    label,
    url: cleaned.url,
    purpose,
    isReferral: referralHint || cleaned.removedTrackingParameters.length > 0,
    removedTrackingParameters: cleaned.removedTrackingParameters,
    accessedAt,
  };
};

const validateMonthList = (
  guide: DestinationGuideEntry,
  label: string,
  months: number[],
  errors: string[],
): void => {
  const invalid = months.filter((month) => !Number.isInteger(month) || month < 1 || month > 12);
  if (invalid.length > 0) errors.push(`${guide.id}: ${label} contains invalid months (${invalid.join(', ')})`);
  if (new Set(months).size !== months.length) errors.push(`${guide.id}: ${label} contains duplicate months`);
};

export const validateDestinationGuideDocument = (
  document: DestinationGuideDocument,
): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  const canonicalPaths = new Set<string>();
  const countriesBySlug = new Map<string, DestinationGuideEntry>();
  const countryGuides = document.guides.filter((guide) => guide.kind === 'country');

  if (document.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (document.selection.countryCount !== countryGuides.length) {
    errors.push(`selection.countryCount (${document.selection.countryCount}) does not match country guides (${countryGuides.length})`);
  }
  if (document.selection.countryCodes.length !== new Set(document.selection.countryCodes).size) {
    errors.push('selection.countryCodes contains duplicates');
  }

  countryGuides.forEach((guide) => countriesBySlug.set(guide.slug, guide));

  document.guides.forEach((guide) => {
    if (ids.has(guide.id)) errors.push(`duplicate guide id: ${guide.id}`);
    ids.add(guide.id);

    const canonicalPath = guide.kind === 'country'
      ? guide.slug
      : `${guide.parentSlug || 'missing-parent'}/${guide.slug}`;
    if (canonicalPaths.has(canonicalPath)) errors.push(`duplicate guide path: ${canonicalPath}`);
    canonicalPaths.add(canonicalPath);

    if (guide.kind === 'country' && guide.parentSlug) {
      errors.push(`${guide.id}: country guide cannot have parentSlug`);
    }
    if (guide.kind !== 'country') {
      const parent = guide.parentSlug ? countriesBySlug.get(guide.parentSlug) : undefined;
      if (!parent) errors.push(`${guide.id}: child guide has missing country parent ${guide.parentSlug || '(none)'}`);
      if (parent && parent.countryCode !== guide.countryCode) {
        errors.push(`${guide.id}: child countryCode does not match parent`);
      }
    }

    if (guide.seasonality) {
      validateMonthList(guide, 'idealMonths', guide.seasonality.idealMonths, errors);
      validateMonthList(guide, 'shoulderMonths', guide.seasonality.shoulderMonths, errors);
      validateMonthList(guide, 'avoidMonths', guide.seasonality.avoidMonths, errors);
      const allMonths = [
        ...guide.seasonality.idealMonths,
        ...guide.seasonality.shoulderMonths,
        ...guide.seasonality.avoidMonths,
      ];
      if (new Set(allMonths).size !== allMonths.length) errors.push(`${guide.id}: seasonality month groups overlap`);
    }

    guide.events.forEach((event) => {
      if (!Number.isInteger(event.month) || event.month < 1 || event.month > 12) {
        errors.push(`${guide.id}: event ${event.id} has invalid month ${event.month}`);
      }
      validateDestinationEventDates(event).forEach((error) => errors.push(`${guide.id}: ${error}`));
    });

    guide.sourceLinks.forEach((link) => {
      let parsed: URL;
      try {
        parsed = new URL(link.url);
      } catch {
        errors.push(`${guide.id}: invalid source URL ${link.url}`);
        return;
      }
      const remainingTrackingParameters = Array.from(parsed.searchParams.keys()).filter(isTrackingParameter);
      if (remainingTrackingParameters.length > 0) {
        errors.push(`${guide.id}: source URL still contains tracking parameters (${remainingTrackingParameters.join(', ')})`);
      }
      if (link.removedTrackingParameters.length > 0 && !link.isReferral) {
        errors.push(`${guide.id}: stripped tracking parameters must retain referral metadata`);
      }
    });
  });

  document.selection.countryCodes.forEach((countryCode) => {
    if (!countryGuides.some((guide) => guide.countryCode === countryCode)) {
      errors.push(`selected country ${countryCode} has no country guide`);
    }
  });

  return errors;
};
