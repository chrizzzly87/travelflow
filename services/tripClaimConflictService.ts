import { buildLocalizedCreateTripPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE } from '../config/locales';
import { getDestinationOptionByName } from './destinationService';
import { encodeTripPrefill } from '../utils';
import type { ITrip, TripGenerationFlow, TripGenerationInputSnapshot, TripPrefillData } from '../types';
import type { CreateTripPrefillDraft, CreateTripTravelerDetails } from '../shared/createTripPreferences';

export const TRIP_CLAIM_CONFLICT_QUERY_KEY = 'claim_conflict';
export const TRIP_CLAIM_CONFLICT_ALREADY_CLAIMED = 'already_claimed';

const LOCAL_BASE_URL = 'https://travelflow.local';

const asRecord = (value: unknown): Record<string, unknown> | null => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const asBoolean = (value: unknown): boolean | undefined => (
    typeof value === 'boolean' ? value : undefined
);

const asNumber = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const asStringArray = (value: unknown): string[] => (
    Array.isArray(value)
        ? value.map((entry) => asString(entry)).filter((entry): entry is string => Boolean(entry))
        : []
);

const parseRelativePath = (path: string): URL => new URL(path || '/', LOCAL_BASE_URL);

const buildRelativePath = (url: URL): string => `${url.pathname}${url.search}${url.hash}`;

const dedupeStrings = (values: string[]): string[] => {
    const seen = new Set<string>();
    const unique: string[] = [];

    values.forEach((value) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const key = trimmed.toLocaleLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(trimmed);
    });

    return unique;
};

const normalizeDestinationValue = (value: unknown): string | null => {
    const candidate = asString(value);
    if (!candidate) return null;

    const direct = getDestinationOptionByName(candidate);
    if (direct) return direct.name;

    const [primaryCandidate] = candidate.split(',').map((part) => part.trim()).filter(Boolean);
    if (primaryCandidate) {
        const primary = getDestinationOptionByName(primaryCandidate);
        if (primary) return primary.name;
    }

    return candidate;
};

const normalizeDestinationList = (value: unknown): string[] => dedupeStrings(
    Array.isArray(value)
        ? value.map((entry) => normalizeDestinationValue(entry)).filter((entry): entry is string => Boolean(entry))
        : [],
);

const buildTravelerDetails = (options: Record<string, unknown>): CreateTripTravelerDetails | undefined => {
    const nested = asRecord(options.travelerDetails) || {};
    const merged: CreateTripTravelerDetails = {
        ...(asString(nested.soloGender) ? { soloGender: nested.soloGender as CreateTripTravelerDetails['soloGender'] } : {}),
        ...(asString(nested.soloAge) ? { soloAge: nested.soloAge as string } : {}),
        ...(asString(nested.soloComfort) ? { soloComfort: nested.soloComfort as CreateTripTravelerDetails['soloComfort'] } : {}),
        ...(asString(nested.coupleTravelerA) ? { coupleTravelerA: nested.coupleTravelerA as CreateTripTravelerDetails['coupleTravelerA'] } : {}),
        ...(asString(nested.coupleTravelerB) ? { coupleTravelerB: nested.coupleTravelerB as CreateTripTravelerDetails['coupleTravelerB'] } : {}),
        ...(asString(nested.coupleOccasion) ? { coupleOccasion: nested.coupleOccasion as CreateTripTravelerDetails['coupleOccasion'] } : {}),
        ...(asNumber(nested.friendsCount) !== undefined ? { friendsCount: asNumber(nested.friendsCount) } : {}),
        ...(asString(nested.friendsEnergy) ? { friendsEnergy: nested.friendsEnergy as CreateTripTravelerDetails['friendsEnergy'] } : {}),
        ...(asNumber(nested.familyAdults) !== undefined ? { familyAdults: asNumber(nested.familyAdults) } : {}),
        ...(asNumber(nested.familyChildren) !== undefined ? { familyChildren: asNumber(nested.familyChildren) } : {}),
        ...(asNumber(nested.familyBabies) !== undefined ? { familyBabies: asNumber(nested.familyBabies) } : {}),
    };

    const fallbackKeys: Array<keyof CreateTripTravelerDetails> = [
        'soloGender',
        'soloAge',
        'soloComfort',
        'coupleTravelerA',
        'coupleTravelerB',
        'coupleOccasion',
        'friendsCount',
        'friendsEnergy',
        'familyAdults',
        'familyChildren',
        'familyBabies',
    ];

    fallbackKeys.forEach((key) => {
        if (merged[key] !== undefined) return;
        const fallbackValue = options[key as string];
        if (typeof fallbackValue === 'string') {
            (merged as Record<string, unknown>)[key] = fallbackValue;
        } else if (typeof fallbackValue === 'number' && Number.isFinite(fallbackValue)) {
            (merged as Record<string, unknown>)[key] = fallbackValue;
        }
    });

    return Object.keys(merged).length > 0 ? merged : undefined;
};

const buildDraftFromSnapshot = (snapshot: TripGenerationInputSnapshot): CreateTripPrefillDraft | null => {
    const payload = asRecord(snapshot.payload);
    const options = asRecord(payload?.options);
    if (!options) return null;

    const baseDraft: CreateTripPrefillDraft = {
        version: 2,
        ...(asString(payload?.wizardBranch) ? { wizardBranch: payload?.wizardBranch as CreateTripPrefillDraft['wizardBranch'] } : {}),
        ...(asString(options.dateInputMode) ? { dateInputMode: options.dateInputMode as CreateTripPrefillDraft['dateInputMode'] } : {}),
        ...(asNumber(options.flexWeeks) !== undefined ? { flexWeeks: asNumber(options.flexWeeks) } : {}),
        ...(asString(options.flexWindow) ? { flexWindow: options.flexWindow as CreateTripPrefillDraft['flexWindow'] } : {}),
        ...(normalizeDestinationValue(options.startDestination) ? { startDestination: normalizeDestinationValue(options.startDestination) || undefined } : {}),
        ...(normalizeDestinationList(options.destinationOrder).length > 0 ? { destinationOrder: normalizeDestinationList(options.destinationOrder) } : {}),
        ...(asBoolean(options.routeLock) !== undefined ? { routeLock: asBoolean(options.routeLock) } : {}),
        ...(asString(options.travelerType) ? { travelerType: options.travelerType as CreateTripPrefillDraft['travelerType'] } : {}),
        ...(buildTravelerDetails(options) ? { travelerDetails: buildTravelerDetails(options) } : {}),
        ...(asStringArray(options.tripStyleTags).length > 0 ? { tripStyleTags: asStringArray(options.tripStyleTags) } : {}),
        ...(asStringArray(options.tripVibeTags).length > 0 ? { tripVibeTags: asStringArray(options.tripVibeTags) } : {}),
        ...(asStringArray(options.transportPreferences).length > 0 ? { transportPreferences: asStringArray(options.transportPreferences) as CreateTripPrefillDraft['transportPreferences'] } : {}),
        ...(asBoolean(options.hasTransportOverride) !== undefined ? { hasTransportOverride: asBoolean(options.hasTransportOverride) } : {}),
        ...(asString(options.specificCities) ? { specificCities: asString(options.specificCities) || undefined } : {}),
        ...(asString(options.notes) ? { notes: asString(options.notes) || undefined } : {}),
        ...(asStringArray(options.idealMonths).length > 0 ? { idealMonths: asStringArray(options.idealMonths) } : {}),
        ...(asStringArray(options.shoulderMonths).length > 0 ? { shoulderMonths: asStringArray(options.shoulderMonths) } : {}),
        ...(asNumber(options.recommendedDurationDays) !== undefined ? { recommendedDurationDays: asNumber(options.recommendedDurationDays) } : {}),
        ...(normalizeDestinationList(options.selectedIslandNames).length > 0 ? { selectedIslandNames: normalizeDestinationList(options.selectedIslandNames) } : {}),
        ...(asBoolean(options.enforceIslandOnly) !== undefined ? { enforceIslandOnly: asBoolean(options.enforceIslandOnly) } : {}),
    };

    return baseDraft;
};

const getSnapshotOptions = (snapshot: TripGenerationInputSnapshot | null | undefined): Record<string, unknown> | null => {
    if (!snapshot) return null;
    const payload = asRecord(snapshot.payload);
    return asRecord(payload?.options);
};

const buildBaseCreateTripPath = (pathname: string, flow: TripGenerationFlow | null | undefined): string => {
    const locale = extractLocaleFromPath(pathname) || DEFAULT_LOCALE;
    const basePath = buildLocalizedCreateTripPath(locale);
    return flow === 'wizard' ? `${basePath}/wizard` : basePath;
};

export const readTripClaimConflictQuery = (search: string): string | null => {
    const value = new URLSearchParams(search).get(TRIP_CLAIM_CONFLICT_QUERY_KEY);
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
};

export const buildTripClaimConflictPath = (path: string): string => {
    const url = parseRelativePath(path);
    url.searchParams.delete('claim');
    url.searchParams.set(TRIP_CLAIM_CONFLICT_QUERY_KEY, TRIP_CLAIM_CONFLICT_ALREADY_CLAIMED);
    return buildRelativePath(url);
};

export const buildTripClaimLoginReturnPath = (path: string, claimId?: string | null): string => {
    const url = parseRelativePath(path);
    url.searchParams.delete(TRIP_CLAIM_CONFLICT_QUERY_KEY);
    if (claimId) {
        url.searchParams.set('claim', claimId);
    } else {
        url.searchParams.delete('claim');
    }
    return buildRelativePath(url);
};

export const buildCreateSimilarTripPath = (params: {
    trip: ITrip;
    pathname: string;
    source?: string;
}): string => {
    const snapshot = params.trip.aiMeta?.generation?.inputSnapshot || null;
    const flow = snapshot?.flow || params.trip.aiMeta?.generation?.latestAttempt?.flow || null;
    const basePath = buildBaseCreateTripPath(params.pathname, flow);

    if (!snapshot) return basePath;

    const options = getSnapshotOptions(snapshot);
    const draft = buildDraftFromSnapshot(snapshot);
    const countriesSource = flow === 'wizard'
        ? options?.countries
        : (Array.isArray(options?.destinationOrder) ? options?.destinationOrder : null);
    const countries = normalizeDestinationList(countriesSource);
    const styles = asStringArray(options?.tripStyleTags);
    const vibes = asStringArray(options?.tripVibeTags);
    const notes = asString(options?.notes);
    const cities = asString(options?.specificCities);
    const budget = asString(options?.budget);
    const pace = asString(options?.pace);
    const roundTrip = asBoolean(options?.roundTrip);
    const label = asString(snapshot.destinationLabel) || params.trip.title || 'Trip';

    const prefill: TripPrefillData = {
        ...(countries.length > 0 ? { countries } : {}),
        ...(asString(snapshot.startDate) ? { startDate: snapshot.startDate } : {}),
        ...(asString(snapshot.endDate) ? { endDate: snapshot.endDate } : {}),
        ...(budget ? { budget } : {}),
        ...(pace ? { pace } : {}),
        ...(cities ? { cities } : {}),
        ...(notes ? { notes } : {}),
        ...(typeof roundTrip === 'boolean' ? { roundTrip } : {}),
        ...(flow === 'wizard' || flow === 'classic' ? { mode: flow } : {}),
        ...(styles.length > 0 ? { styles } : {}),
        ...(vibes.length > 0 ? { vibes } : {}),
        meta: {
            source: params.source || 'trip_claim_conflict',
            label,
            ...(draft ? { draft } : {}),
        },
    };

    return `${basePath}?prefill=${encodeTripPrefill(prefill)}`;
};
