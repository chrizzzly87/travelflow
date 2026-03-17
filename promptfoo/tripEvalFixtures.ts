import { buildClassicBenchmarkScenario } from '../services/aiBenchmarkClassicScenarioService.ts';
import {
    createSystemBenchmarkPresets,
    type BenchmarkMaskScenario,
} from '../services/aiBenchmarkPreferencesService.ts';

const PRESET_START_DATE = '2026-04-10';
const PRESET_END_DATE = '2026-04-24';

export interface TripEvalExpectations {
    routeOrder?: string[];
    totalDays?: number;
    specificCities?: string[];
    forbiddenCities?: string[];
    forbiddenPhrases?: string[];
}

export interface TripEvalVars {
    scenarioId: string;
    destinationPrompt: string;
    startDate?: string;
    roundTrip: boolean;
    generationOptions: ReturnType<typeof buildClassicBenchmarkScenario>['generationOptions'];
    expectations: TripEvalExpectations;
    selectedDestinations: string[];
    attackCategory?: string;
}

const SYSTEM_PRESETS_BY_ID = new Map(
    createSystemBenchmarkPresets(PRESET_START_DATE, PRESET_END_DATE)
        .map((preset) => [preset.id, preset]),
);

export const getPresetScenario = (presetId: string): BenchmarkMaskScenario => {
    const preset = SYSTEM_PRESETS_BY_ID.get(presetId);
    if (!preset) {
        throw new Error(`Missing benchmark preset ${presetId}.`);
    }
    return preset.scenario;
};

export const buildTripEvalFixture = (
    scenarioId: string,
    description: string,
    scenario: BenchmarkMaskScenario,
    expectations: TripEvalExpectations,
    buildAssertions: (options: {
        roundTrip: boolean;
        expectations: TripEvalExpectations;
    }) => Array<{ type: 'is-json' | 'javascript'; value: unknown }>,
    options?: {
        attackCategory?: string;
    },
) => {
    const runtimeScenario = buildClassicBenchmarkScenario(scenario, { compactOutput: true });

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
            ...(options?.attackCategory ? { attackCategory: options.attackCategory } : {}),
        } satisfies TripEvalVars,
        metadata: {
            scenarioId,
            flow: 'classic',
            roundTrip: runtimeScenario.roundTrip,
            attackCategory: options?.attackCategory || 'none',
        },
        assert: buildAssertions({
            roundTrip: runtimeScenario.roundTrip,
            expectations,
        }),
    };
};
