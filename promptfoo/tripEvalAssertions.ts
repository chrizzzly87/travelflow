import { normalizeCityName, validateModelData } from '../shared/aiBenchmarkValidation.ts';
import { TRIP_ITINERARY_JSON_SCHEMA } from '../shared/aiTripItinerarySchema.ts';

interface TripEvalAssertionContext {
    vars?: {
        roundTrip?: boolean;
        expectations?: {
            routeOrder?: string[];
            totalDays?: number;
            specificCities?: string[];
        };
    };
}

const REQUIRED_TOP_LEVEL_KEYS = ['tripTitle', 'cities', 'travelSegments', 'activities'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const parseTripOutput = (output: string): { ok: true; trip: Record<string, unknown> } | { ok: false; reason: string } => {
    try {
        const parsed = JSON.parse(output);
        if (!isRecord(parsed)) {
            return { ok: false, reason: 'Output was valid JSON but not an object.' };
        }
        return { ok: true, trip: parsed };
    } catch (error) {
        return {
            ok: false,
            reason: error instanceof Error ? `Output was not valid JSON: ${error.message}` : 'Output was not valid JSON.',
        };
    }
};

const getCityNames = (trip: Record<string, unknown>): string[] => {
    if (!Array.isArray(trip.cities)) return [];
    return trip.cities
        .map((city) => (isRecord(city) && typeof city.name === 'string' ? city.name.trim() : ''))
        .filter(Boolean);
};

const getNormalizedCityNames = (trip: Record<string, unknown>): string[] => (
    getCityNames(trip).map((city) => normalizeCityName(city))
);

const sumCityDays = (trip: Record<string, unknown>): number => {
    if (!Array.isArray(trip.cities)) return 0;
    return trip.cities.reduce((total, city) => {
        if (!isRecord(city)) return total;
        const days = Number(city.days);
        return Number.isFinite(days) ? total + days : total;
    }, 0);
};

const pass = (reason: string) => ({ pass: true, score: 1, reason });
const fail = (reason: string) => ({ pass: false, score: 0, reason });

export const assertValidTripJsonObject = (output: string) => {
    const parsed = parseTripOutput(output);
    return parsed.ok ? pass('Output was a valid itinerary JSON object.') : fail(parsed.reason);
};

export const assertRequiredTopLevelContract = (output: string) => {
    const parsed = parseTripOutput(output);
    if (!parsed.ok) return fail(parsed.reason);

    const missingKeys = REQUIRED_TOP_LEVEL_KEYS.filter((key) => !(key in parsed.trip));
    if (missingKeys.length > 0) {
        return fail(`Missing required top-level keys: ${missingKeys.join(', ')}.`);
    }

    return pass('Required top-level itinerary keys were present.');
};

export const assertSharedValidatorPasses = (output: string, context?: TripEvalAssertionContext) => {
    const parsed = parseTripOutput(output);
    if (!parsed.ok) return fail(parsed.reason);

    const validation = validateModelData(parsed.trip, {
        roundTrip: Boolean(context?.vars?.roundTrip),
    });

    if (!validation.schemaValid) {
        return fail(`Shared validator failed: ${validation.errors.join(' | ')}`);
    }

    return pass(
        validation.warnings.length > 0
            ? `Shared validator passed with warnings: ${validation.warnings.join(' | ')}`
            : 'Shared validator passed.',
    );
};

export const assertExpectedRouteOrder = (output: string, context?: TripEvalAssertionContext) => {
    const expectedRoute = context?.vars?.expectations?.routeOrder || [];
    if (expectedRoute.length === 0) return pass('No fixed route-order expectation configured.');

    const parsed = parseTripOutput(output);
    if (!parsed.ok) return fail(parsed.reason);

    const actualRoute = getNormalizedCityNames(parsed.trip);
    const normalizedExpected = expectedRoute.map((city) => normalizeCityName(city));

    if (actualRoute.length !== normalizedExpected.length) {
        return fail(`Expected exactly ${normalizedExpected.length} cities in fixed order, got ${actualRoute.length}.`);
    }

    const sameOrder = normalizedExpected.every((city, index) => actualRoute[index] === city);
    if (!sameOrder) {
        return fail(`Expected route order ${expectedRoute.join(' -> ')}, got ${getCityNames(parsed.trip).join(' -> ')}.`);
    }

    return pass(`Returned cities matched fixed route order: ${expectedRoute.join(' -> ')}.`);
};

export const assertExpectedTotalDays = (output: string, context?: TripEvalAssertionContext) => {
    const expectedTotalDays = context?.vars?.expectations?.totalDays;
    if (!Number.isFinite(expectedTotalDays)) return pass('No exact total-day expectation configured.');

    const parsed = parseTripOutput(output);
    if (!parsed.ok) return fail(parsed.reason);

    const actualTotalDays = sumCityDays(parsed.trip);
    if (actualTotalDays !== expectedTotalDays) {
        return fail(`Expected ${expectedTotalDays} total days, got ${actualTotalDays}.`);
    }

    return pass(`Returned itinerary matched expected total days (${expectedTotalDays}).`);
};

export const assertExpectedSpecificCities = (output: string, context?: TripEvalAssertionContext) => {
    const expectedCities = context?.vars?.expectations?.specificCities || [];
    if (expectedCities.length === 0) return pass('No specific-city expectation configured.');

    const parsed = parseTripOutput(output);
    if (!parsed.ok) return fail(parsed.reason);

    const actualCities = new Set(getNormalizedCityNames(parsed.trip));
    const missing = expectedCities.filter((city) => !actualCities.has(normalizeCityName(city)));

    if (missing.length > 0) {
        return fail(`Missing requested cities: ${missing.join(', ')}.`);
    }

    return pass(`Returned itinerary included requested cities: ${expectedCities.join(', ')}.`);
};

export const assertRoundTripReturnsToOrigin = (output: string, context?: TripEvalAssertionContext) => {
    if (!context?.vars?.roundTrip) return pass('Round-trip check skipped for non-round-trip scenario.');

    const parsed = parseTripOutput(output);
    if (!parsed.ok) return fail(parsed.reason);

    const cities = getCityNames(parsed.trip);
    const firstCity = cities[0];
    const lastCity = cities[cities.length - 1];

    if (!firstCity || !lastCity) {
        return fail('Round-trip check could not read the first and last city.');
    }

    if (normalizeCityName(firstCity) !== normalizeCityName(lastCity)) {
        return fail(`Expected round-trip return to ${firstCity}, got ${lastCity}.`);
    }

    return pass(`Round-trip returned to origin city ${firstCity}.`);
};

export const buildTripEvalAssertions = (options: {
    roundTrip?: boolean;
    expectations?: {
        routeOrder?: string[];
        totalDays?: number;
        specificCities?: string[];
    };
}) => {
    const assertions = [
        { type: 'is-json' as const, value: TRIP_ITINERARY_JSON_SCHEMA },
        { type: 'javascript' as const, value: assertSharedValidatorPasses },
    ];

    if ((options.expectations?.routeOrder || []).length > 0) {
        assertions.push({ type: 'javascript' as const, value: assertExpectedRouteOrder });
    }
    if (Number.isFinite(options.expectations?.totalDays)) {
        assertions.push({ type: 'javascript' as const, value: assertExpectedTotalDays });
    }
    if ((options.expectations?.specificCities || []).length > 0) {
        assertions.push({ type: 'javascript' as const, value: assertExpectedSpecificCities });
    }
    if (options.roundTrip) {
        assertions.push({ type: 'javascript' as const, value: assertRoundTripReturnsToOrigin });
    }

    return assertions;
};
