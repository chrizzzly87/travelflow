import { buildClassicBenchmarkScenario } from '../services/aiBenchmarkClassicScenarioService.ts';
import {
    createSystemBenchmarkPresets,
    normalizeBenchmarkMaskScenario,
    type BenchmarkMaskScenario,
} from '../services/aiBenchmarkPreferencesService.ts';
import { buildTripEvalAssertions } from './tripEvalAssertions.ts';

const PRESET_START_DATE = '2026-04-10';
const PRESET_END_DATE = '2026-04-24';

export interface TripEvalExpectations {
    routeOrder?: string[];
    totalDays?: number;
    specificCities?: string[];
}

export interface TripEvalVars {
    scenarioId: string;
    destinationPrompt: string;
    startDate?: string;
    roundTrip: boolean;
    generationOptions: ReturnType<typeof buildClassicBenchmarkScenario>['generationOptions'];
    expectations: TripEvalExpectations;
    selectedDestinations: string[];
}

const SYSTEM_PRESETS_BY_ID = new Map(
    createSystemBenchmarkPresets(PRESET_START_DATE, PRESET_END_DATE)
        .map((preset) => [preset.id, preset]),
);

const getPresetScenario = (presetId: string): BenchmarkMaskScenario => {
    const preset = SYSTEM_PRESETS_BY_ID.get(presetId);
    if (!preset) {
        throw new Error(`Missing benchmark preset ${presetId}.`);
    }
    return preset.scenario;
};

const buildFixture = (
    scenarioId: string,
    description: string,
    scenario: BenchmarkMaskScenario,
    expectations: TripEvalExpectations = {},
) => {
    const runtimeScenario = buildClassicBenchmarkScenario(scenario);

    return {
        description,
        vars: {
            scenarioId,
            destinationPrompt: runtimeScenario.destinationPrompt,
            startDate: runtimeScenario.startDate,
            roundTrip: runtimeScenario.roundTrip,
            generationOptions: runtimeScenario.generationOptions,
            expectations,
            selectedDestinations: runtimeScenario.selectedDestinations,
        } satisfies TripEvalVars,
        metadata: {
            scenarioId,
            flow: 'classic',
            roundTrip: runtimeScenario.roundTrip,
        },
        assert: buildTripEvalAssertions({
            roundTrip: runtimeScenario.roundTrip,
            expectations,
        }),
    };
};

const FAMILY_ROUTE_LOCK_SCENARIO = normalizeBenchmarkMaskScenario({
    destinations: 'Munich, Salzburg, Vienna',
    dateInputMode: 'flex',
    startDate: PRESET_START_DATE,
    endDate: PRESET_END_DATE,
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

export const tripEvalTests = [
    buildFixture(
        'system-japan-classic',
        'Japan classic baseline stays valid and returns to origin',
        getPresetScenario('system-japan-classic'),
    ),
    buildFixture(
        'system-southeast-asia-loop',
        'Southeast Asia loop preserves a valid round-trip backpacking structure',
        getPresetScenario('system-southeast-asia-loop'),
    ),
    buildFixture(
        'system-northern-germany',
        'Northern Germany short route remains stable for compact regional plans',
        getPresetScenario('system-northern-germany'),
    ),
    buildFixture(
        'family-route-lock',
        'Family rail route respects a locked city order',
        FAMILY_ROUTE_LOCK_SCENARIO,
        {
            routeOrder: ['Munich', 'Salzburg', 'Vienna'],
            totalDays: 7,
        },
    ),
    buildFixture(
        'exact-date-specific-cities',
        'Exact-date Portugal trip includes requested cities and matches total days',
        EXACT_DATE_CITY_PAIR_SCENARIO,
        {
            totalDays: 8,
            specificCities: ['Lisbon', 'Porto'],
        },
    ),
];
