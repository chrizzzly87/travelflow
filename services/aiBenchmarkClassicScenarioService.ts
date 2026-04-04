import { buildClassicItineraryPrompt, type GenerateOptions } from './aiService';
import type { BenchmarkMaskScenario } from './aiBenchmarkPreferencesService';
import { getDestinationPromptLabel, resolveDestinationName } from './destinationService';
import { getEstimatedTripNightsFromTotalDays, getExactTripDateSpan } from '../shared/tripSpan';

export interface ClassicBenchmarkScenarioBuildResult {
    prompt: string;
    startDate?: string;
    roundTrip: boolean;
    destinationPrompt: string;
    selectedDestinations: string[];
    totalDays: number;
    totalNights: number;
    generationOptions: GenerateOptions;
    input: {
        destinations: string[];
        dateInputMode: BenchmarkMaskScenario['dateInputMode'];
        flexWeeks: number | null;
        flexWindow: BenchmarkMaskScenario['flexWindow'] | null;
        budget: string;
        pace: string;
        notes: string;
        specificCities: string;
        numCities: number | null;
        totalDays: number;
        totalNights: number;
        roundTrip: boolean;
        routeLock: boolean;
        preferenceSignals: {
            travelerSetup: BenchmarkMaskScenario['travelerSetup'];
            tripStyle: BenchmarkMaskScenario['tripStyleMask'];
            transportPreference: BenchmarkMaskScenario['transportMask'];
        };
        execution: {
            compactOutput: boolean;
        };
    };
}

const DEFAULT_FLEX_TOTAL_DAYS = 14;

const parseBenchmarkDestinations = (value: string): string[] => {
    const seen = new Set<string>();
    return value
        .split(',')
        .map((token) => resolveDestinationName(token))
        .filter(Boolean)
        .filter((entry) => {
            const key = entry.toLocaleLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const getFlexTotalDays = (flexWeeks: number): number => {
    if (!Number.isFinite(flexWeeks) || flexWeeks <= 0) return DEFAULT_FLEX_TOTAL_DAYS;
    return Math.max(7, Math.round(flexWeeks) * 7);
};

export const buildClassicBenchmarkScenario = (
    scenario: BenchmarkMaskScenario,
    options: { compactOutput?: boolean } = {},
): ClassicBenchmarkScenarioBuildResult => {
    const selectedDestinations = parseBenchmarkDestinations(scenario.destinations);
    if (selectedDestinations.length === 0) {
        throw new Error('Benchmark scenario must include at least one destination.');
    }

    const destinationPrompt = selectedDestinations.map((entry) => getDestinationPromptLabel(entry)).join(', ');
    const exactTripSpan = scenario.dateInputMode === 'exact'
        ? getExactTripDateSpan(scenario.startDate || '', scenario.endDate || '')
        : null;
    const totalDays = scenario.dateInputMode === 'flex'
        ? getFlexTotalDays(scenario.flexWeeks)
        : exactTripSpan?.days || getFlexTotalDays(scenario.flexWeeks);
    const totalNights = exactTripSpan?.nights ?? getEstimatedTripNightsFromTotalDays(totalDays);

    const generationOptions: GenerateOptions = {
        budget: scenario.budget,
        pace: scenario.pace,
        interests: scenario.notes.split(',').map((token) => token.trim()).filter(Boolean),
        specificCities: scenario.specificCities.trim() || undefined,
        roundTrip: scenario.roundTrip,
        totalDays,
        totalNights,
        numCities: typeof scenario.numCities === 'number' ? scenario.numCities : undefined,
        destinationOrder: selectedDestinations,
        routeLock: scenario.routeLock,
        promptMode: options.compactOutput ? 'benchmark_compact' : 'default',
    };

    return {
        prompt: buildClassicItineraryPrompt(destinationPrompt, generationOptions),
        startDate: scenario.startDate || undefined,
        roundTrip: scenario.roundTrip,
        destinationPrompt,
        selectedDestinations,
        totalDays,
        totalNights,
        generationOptions,
        input: {
            destinations: selectedDestinations,
            dateInputMode: scenario.dateInputMode,
            flexWeeks: scenario.dateInputMode === 'flex' ? scenario.flexWeeks : null,
            flexWindow: scenario.dateInputMode === 'flex' ? scenario.flexWindow : null,
            budget: scenario.budget,
            pace: scenario.pace,
            notes: scenario.notes,
            specificCities: scenario.specificCities,
            numCities: typeof scenario.numCities === 'number' ? scenario.numCities : null,
            totalDays,
            totalNights,
            roundTrip: scenario.roundTrip,
            routeLock: scenario.routeLock,
            preferenceSignals: {
                travelerSetup: scenario.travelerSetup,
                tripStyle: scenario.tripStyleMask,
                transportPreference: scenario.transportMask,
            },
            execution: {
                compactOutput: Boolean(options.compactOutput),
            },
        },
    };
};
