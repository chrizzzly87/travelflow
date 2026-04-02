import {
    normalizeBenchmarkMaskScenario,
} from '../services/aiBenchmarkPreferencesService.ts';
import { buildTripEvalAssertions } from './tripEvalAssertions.ts';
import { buildTripEvalFixture, getPresetScenario } from './tripEvalFixtures.ts';

const FAMILY_ROUTE_LOCK_SCENARIO = normalizeBenchmarkMaskScenario({
    destinations: 'Munich, Salzburg, Vienna',
    dateInputMode: 'flex',
    startDate: '2026-04-10',
    endDate: '2026-04-24',
    flexWeeks: 1,
    flexWindow: 'summer',
    budget: 'Medium',
    pace: 'Balanced',
    specificCities: '',
    notes: 'family museums, easy rail hops, playground breaks',
    numCities: 3,
    roundTrip: false,
    routeLock: true,
    travelerSetup: 'family',
    tripStyleMask: 'culture_focused',
    transportMask: 'train',
});

const EXACT_DATE_CITY_PAIR_SCENARIO = normalizeBenchmarkMaskScenario({
    destinations: 'Portugal',
    dateInputMode: 'exact',
    startDate: '2026-06-03',
    endDate: '2026-06-10',
    flexWeeks: 1,
    flexWindow: 'summer',
    budget: 'Medium',
    pace: 'Balanced',
    specificCities: 'Lisbon, Porto',
    notes: 'train-friendly pacing, pastries, riverside walks',
    numCities: 2,
    roundTrip: false,
    routeLock: false,
    travelerSetup: 'couple',
    tripStyleMask: 'food_focused',
    transportMask: 'train',
});

export type { TripEvalVars } from './tripEvalFixtures.ts';

export const tripEvalTests = [
    buildTripEvalFixture(
        'system-japan-classic',
        'Japan classic baseline stays valid and returns to origin',
        getPresetScenario('system-japan-classic'),
        {},
        buildTripEvalAssertions,
    ),
    buildTripEvalFixture(
        'system-southeast-asia-loop',
        'Southeast Asia loop preserves a valid round-trip backpacking structure',
        getPresetScenario('system-southeast-asia-loop'),
        {},
        buildTripEvalAssertions,
    ),
    buildTripEvalFixture(
        'system-northern-germany',
        'Northern Germany short route remains stable for compact regional plans',
        getPresetScenario('system-northern-germany'),
        {},
        buildTripEvalAssertions,
    ),
    buildTripEvalFixture(
        'family-route-lock',
        'Family rail route respects a locked city order',
        FAMILY_ROUTE_LOCK_SCENARIO,
        {
            routeOrder: ['Munich', 'Salzburg', 'Vienna'],
            totalDays: 7,
        },
        buildTripEvalAssertions,
    ),
    buildTripEvalFixture(
        'exact-date-specific-cities',
        'Exact-date Portugal trip includes requested cities and matches total days',
        EXACT_DATE_CITY_PAIR_SCENARIO,
        {
            totalDays: 8,
            specificCities: ['Lisbon', 'Porto'],
        },
        buildTripEvalAssertions,
    ),
];
