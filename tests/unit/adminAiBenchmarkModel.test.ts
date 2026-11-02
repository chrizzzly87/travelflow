import { describe, expect, it } from 'vitest';
import type { AiModelCatalogItem } from '../../config/aiModelCatalog';
import {
    createSystemBenchmarkPresets,
    type BenchmarkMaskScenario,
} from '../../services/aiBenchmarkPreferencesService';
import type { BenchmarkScenarioImportPayload } from '../../services/tripGenerationBenchmarkBridge';
import type { BenchmarkRun } from '../../components/admin/aiBenchmarkRuns';
import {
    BENCHMARK_TIMEOUT_DEFAULT_SECONDS,
    CUSTOM_JSON_PRESET_ID,
    CUSTOM_JSON_PRESET_NAME,
    DEFAULT_MODEL_CATALOG_FILTERS,
    buildBenchmarkRequestTargets,
    buildBenchmarkScenarioPayload,
    buildOptimisticRuns,
    buildPresetFromEditor,
    buildRunJsonFileName,
    buildSessionExportFileName,
    buildSessionExportUrl,
    buildTelemetrySnapshotCards,
    buildTemplateJson,
    describeCancelledRuns,
    describeImportedScenario,
    describeRunRequest,
    filterCatalogModels,
    getComparisonRatingClass,
    groupModelsByProviderLabel,
    hasExactRunCost,
    listModelProviderLabels,
    listNewlyApprovedLiveModels,
    markOptimisticRunsFailed,
    mergeApprovedOpenRouterModels,
    parseCustomScenarioDraft,
    parseTimeoutInput,
    pickTelemetryLeaders,
    readMaskScenario,
    resolveImportedScenario,
    resolvePersistedPresetId,
    resolveRunTimeoutSeconds,
    resolveSelectedPreset,
    resolveSelectedTargets,
    setModelReasoningOverride,
    syncRunCommentDrafts,
    toMaskState,
    toggleModelId,
    upsertPreset,
    withSessionParam,
    withoutImportParam,
} from '../../components/admin/ai-benchmark/aiBenchmarkModel';

const DEFAULT_DATES = { startDate: '2026-12-01', endDate: '2026-12-14' };

const makeModel = (overrides: Partial<AiModelCatalogItem> = {}): AiModelCatalogItem => ({
    id: 'openrouter:acme/fast-1',
    provider: 'openrouter',
    providerLabel: 'Acme',
    providerShortName: 'Acme',
    model: 'acme/fast-1',
    label: 'Acme Fast 1',
    availability: 'active',
    releasedAt: new Date().toISOString().slice(0, 10),
    estimatedCostPerQueryLabel: '$0.01',
    ...overrides,
});

const makeRun = (overrides: Partial<BenchmarkRun> = {}): BenchmarkRun => ({
    id: 'run-1',
    session_id: 'session-1',
    provider: 'openai',
    model: 'gpt-5',
    label: 'GPT-5',
    run_index: 1,
    status: 'completed',
    latency_ms: 1000,
    schema_valid: true,
    usage: null,
    cost_usd: null,
    trip_id: null,
    error_message: null,
    run_comment: null,
    created_at: '2026-10-24T10:00:00.000Z',
    ...overrides,
});

const MASK: BenchmarkMaskScenario = {
    destinations: 'Japan',
    dateInputMode: 'exact',
    startDate: '2026-12-01',
    endDate: '2026-12-10',
    flexWeeks: 2,
    flexWindow: 'shoulder',
    budget: 'Medium',
    pace: 'Balanced',
    specificCities: '',
    notes: '',
    numCities: null,
    roundTrip: true,
    routeLock: false,
    travelerSetup: 'couple',
    tripStyleMask: 'food_focused',
    transportMask: 'train',
};

describe('ai benchmark model: trip template', () => {
    it('fills missing dates and a non-numeric stop count when a scenario becomes the mask', () => {
        const mask = toMaskState({ ...MASK, startDate: null, endDate: '', numCities: Number.NaN as unknown as null }, DEFAULT_DATES);
        expect(mask.startDate).toBe(DEFAULT_DATES.startDate);
        expect(mask.endDate).toBe(DEFAULT_DATES.endDate);
        expect(typeof mask.numCities).toBe('number');

        const withoutStops = toMaskState({ ...MASK, numCities: null }, DEFAULT_DATES);
        expect(withoutStops.numCities).toBeNull();
        expect(readMaskScenario(withoutStops, DEFAULT_DATES).destinations).toBe('Japan');
    });

    it('parses custom JSON: empty, invalid, unmappable and a scenario', () => {
        expect(parseCustomScenarioDraft('  ', 'unknown', DEFAULT_DATES)).toEqual({ scenario: null, flow: 'unknown', error: null });
        expect(parseCustomScenarioDraft('{', 'classic', DEFAULT_DATES)).toEqual({
            scenario: null,
            flow: 'classic',
            error: 'Custom JSON is not valid JSON.',
        });
        expect(parseCustomScenarioDraft('42', 'unknown', DEFAULT_DATES).error).toBe(
            'Custom JSON could not be mapped to a benchmark mask. Use a scenario object or a trip generation payload.',
        );
        const parsed = parseCustomScenarioDraft(JSON.stringify(MASK), 'unknown', DEFAULT_DATES);
        expect(parsed.error).toBeNull();
        expect(parsed.scenario?.destinations).toBe('Japan');
    });

    it('resolves the synthetic custom template and saved templates', () => {
        const presets = createSystemBenchmarkPresets(DEFAULT_DATES.startDate, DEFAULT_DATES.endDate);
        const custom = resolveSelectedPreset({
            selectedPresetId: CUSTOM_JSON_PRESET_ID,
            presetConfigs: presets,
            customScenarioMeta: { source: 'admin_trip_drawer', flow: 'classic', tripId: 't-1' },
            customScenario: MASK,
            defaultDates: DEFAULT_DATES,
        });
        expect(custom).toMatchObject({
            id: CUSTOM_JSON_PRESET_ID,
            kind: 'custom',
            name: CUSTOM_JSON_PRESET_NAME,
            description: 'Imported from Admin Trip Drawer',
            scenario: MASK,
        });

        const pasted = resolveSelectedPreset({
            selectedPresetId: CUSTOM_JSON_PRESET_ID,
            presetConfigs: presets,
            customScenarioMeta: null,
            customScenario: null,
            defaultDates: DEFAULT_DATES,
        });
        expect(pasted?.description).toBe('Paste a benchmark scenario JSON payload and apply it to the mask.');

        expect(resolveSelectedPreset({
            selectedPresetId: presets[1].id,
            presetConfigs: presets,
            customScenarioMeta: null,
            customScenario: null,
            defaultDates: DEFAULT_DATES,
        })).toBe(presets[1]);
    });

    it('shows the pasted JSON as typed and other templates pretty-printed', () => {
        expect(buildTemplateJson(CUSTOM_JSON_PRESET_ID, '{"a":1}', MASK)).toBe('{"a":1}');
        expect(buildTemplateJson(CUSTOM_JSON_PRESET_ID, ' ', MASK)).toBe(JSON.stringify(MASK, null, 2));
        expect(buildTemplateJson('system-x', '{"a":1}', undefined)).toBe('{}');
    });

    it('persists the first template in place of the custom one', () => {
        const presets = createSystemBenchmarkPresets(DEFAULT_DATES.startDate, DEFAULT_DATES.endDate);
        expect(resolvePersistedPresetId(CUSTOM_JSON_PRESET_ID, presets, [])).toBe(presets[0].id);
        expect(resolvePersistedPresetId(CUSTOM_JSON_PRESET_ID, [], presets)).toBe(presets[0].id);
        expect(resolvePersistedPresetId(CUSTOM_JSON_PRESET_ID, [], [])).toBe('');
        expect(resolvePersistedPresetId('custom-1', presets, presets)).toBe('custom-1');
    });

    it('describes and resolves a scenario imported from trip diagnostics', () => {
        const imported: BenchmarkScenarioImportPayload = {
            scenario: MASK,
            flow: 'wizard',
            createdAt: '2026-10-24T10:00:00.000Z',
            source: 'trip_info',
            tripId: 'trip-7',
        };
        expect(describeImportedScenario(imported)).toBe('Imported benchmark scenario (wizard) from Trip Info for trip trip-7.');
        expect(describeImportedScenario({ ...imported, source: 'admin_trip_drawer', tripId: null }))
            .toBe('Imported benchmark scenario (wizard) from Admin Trip Drawer.');

        const resolved = resolveImportedScenario(imported, DEFAULT_DATES);
        expect(resolved.json).toBe(JSON.stringify(MASK, null, 2));
        expect(resolved.meta).toEqual({ source: 'trip_info', flow: 'wizard', tripId: 'trip-7' });
        expect(resolved.scenario.destinations).toBe('Japan');
    });

    it('builds a template from the editor and inserts or replaces it', () => {
        const presets = createSystemBenchmarkPresets(DEFAULT_DATES.startDate, DEFAULT_DATES.endDate);
        const created = buildPresetFromEditor({
            mode: 'create',
            id: 'custom-1',
            kind: 'system',
            name: '  ',
            description: '  Weekend  ',
            scenario: MASK,
        }, DEFAULT_DATES);
        expect(created).toMatchObject({ id: 'custom-1', kind: 'custom', name: 'Custom benchmark preset', description: 'Weekend' });
        expect(upsertPreset(presets, created, 'create')).toHaveLength(presets.length + 1);

        const edited = { ...presets[0], name: 'Renamed' };
        const replaced = upsertPreset(presets, edited, 'edit');
        expect(replaced).toHaveLength(presets.length);
        expect(replaced[0].name).toBe('Renamed');
    });
});

describe('ai benchmark model: execution and the request', () => {
    it('clamps the time limit the way the field and the request do', () => {
        expect(resolveRunTimeoutSeconds(0)).toBe(BENCHMARK_TIMEOUT_DEFAULT_SECONDS);
        expect(resolveRunTimeoutSeconds('abc')).toBe(BENCHMARK_TIMEOUT_DEFAULT_SECONDS);
        expect(resolveRunTimeoutSeconds(5)).toBe(20);
        expect(resolveRunTimeoutSeconds(999)).toBe(180);
        expect(resolveRunTimeoutSeconds(61.4)).toBe(61);

        expect(parseTimeoutInput('0')).toBe(20);
        expect(parseTimeoutInput('')).toBe(20);
        expect(parseTimeoutInput('abc')).toBe(BENCHMARK_TIMEOUT_DEFAULT_SECONDS);
        expect(parseTimeoutInput('400')).toBe(180);
        expect(parseTimeoutInput('90.6')).toBe(91);
    });

    it('sets and clears a model reasoning override', () => {
        const set = setModelReasoningOverride({}, 'm1', 'high');
        expect(set).toEqual({ m1: 'high' });
        expect(setModelReasoningOverride(set, 'm1', undefined)).toEqual({});
    });

    it('sends a reasoning effort only for configurable OpenRouter models', () => {
        const reasoning = makeModel({ supportsReasoning: true, reasoningEfforts: ['low', 'high'] });
        const plain = makeModel({ id: 'openai:gpt-5', provider: 'openai', model: 'gpt-5', supportsReasoning: true });
        const targets = buildBenchmarkRequestTargets(
            [
                { provider: 'openrouter', model: 'acme/fast-1', label: 'Acme Fast 1' },
                { provider: 'openai', model: 'gpt-5', label: 'GPT-5' },
                { provider: 'openrouter', model: 'unknown/model', label: 'Unknown' },
            ],
            [reasoning, plain],
            {},
            'low',
        );
        expect(targets[0]).toEqual({ provider: 'openrouter', model: 'acme/fast-1', label: 'Acme Fast 1', reasoningEffort: 'low' });
        expect(targets[1]).toEqual({ provider: 'openai', model: 'gpt-5', label: 'GPT-5' });
        expect(targets[2]).toEqual({ provider: 'openrouter', model: 'unknown/model', label: 'Unknown' });

        const overridden = buildBenchmarkRequestTargets([{ provider: 'openrouter', model: 'acme/fast-1' }], [reasoning], { [reasoning.id]: 'provider-default' }, 'high');
        expect(overridden[0]).not.toHaveProperty('reasoningEffort');
    });

    it('carries the execution settings and the raw mask signals in the scenario', () => {
        const payload = buildBenchmarkScenarioPayload(MASK, { timeoutSeconds: 90, compactOutput: false, reasoningMode: 'medium' });
        expect(payload.input.execution).toEqual({ timeoutSeconds: 90, compactOutput: false, reasoning: 'medium' });
        expect(payload.metadata.execution).toEqual({ timeoutSeconds: 90, compactOutput: false, reasoning: 'medium' });
        expect(payload.metadata.preference_signals).toEqual({
            travelerSetup: 'couple',
            tripStyle: 'food_focused',
            transportPreference: 'train',
            routeLock: false,
        });
        expect(payload.metadata.baseline_defaults).toEqual({
            travelerSetup: 'solo',
            tripStyle: 'everything_except_remote_work',
            transportPreference: 'automatic',
        });
        expect(typeof payload.prompt).toBe('string');
        expect(() => buildBenchmarkScenarioPayload({ ...MASK, destinations: '' }, { timeoutSeconds: 60, compactOutput: true, reasoningMode: 'low' }))
            .toThrow();
    });

    it('numbers optimistic runs after the model\'s existing runs and fails them on error', () => {
        const existing = [makeRun({ run_index: 2 }), makeRun({ id: 'run-2', run_index: 5, provider: 'openai', model: 'other' })];
        let counter = 0;
        const optimistic = buildOptimisticRuns(
            [{ provider: 'openai', model: 'gpt-5' }, { provider: 'openai', model: 'new' }],
            existing,
            { sessionId: undefined, startedAtIso: '2026-10-24T10:00:00.000Z', nowMs: Date.parse('2026-10-24T10:00:00.000Z'), createId: () => `id-${counter += 1}` },
        );
        expect(optimistic.map((run) => [run.id, run.run_index, run.label, run.session_id, run.status])).toEqual([
            ['optimistic-id-1', 3, 'openai:gpt-5', 'pending', 'running'],
            ['optimistic-id-2', 1, 'openai:new', 'pending', 'running'],
        ]);
        expect(optimistic[1].created_at).toBe('2026-10-24T10:00:00.001Z');

        const failed = markOptimisticRunsFailed([...optimistic, existing[0]], '2026-10-24T10:01:00.000Z');
        expect(failed[0]).toMatchObject({ status: 'failed', finished_at: '2026-10-24T10:01:00.000Z', error_message: 'Benchmark request failed before run completion.' });
        expect(failed[2]).toBe(existing[0]);
    });

    it('words the run and cancel notices exactly', () => {
        expect(describeRunRequest({ targetCount: 3, concurrency: 2, timeoutSeconds: 60, compactOutput: true, hasPending: true }))
            .toBe('Queued 3 target(s) with up to 2 parallel (60s timeout, compact output).');
        expect(describeRunRequest({ targetCount: 1, concurrency: 2, timeoutSeconds: 45, compactOutput: false, hasPending: false }))
            .toBe('Executed 1 target(s) (45s timeout, standard output).');
        expect(describeCancelledRuns(1)).toBe('Cancelled 1 active run.');
        expect(describeCancelledRuns(0)).toBe('Cancelled 0 active runs.');
    });
});

describe('ai benchmark model: runs', () => {
    it('keeps note drafts in step with the runs and returns the same object when unchanged', () => {
        const runs = [makeRun({ id: 'a', run_comment: 'Saved' }), makeRun({ id: 'optimistic-x' })];
        const first = syncRunCommentDrafts({}, runs);
        expect(first).toEqual({ a: 'Saved' });
        expect(syncRunCommentDrafts(first, runs)).toBe(first);

        const edited = { a: 'Edited' };
        expect(syncRunCommentDrafts(edited, [...runs, makeRun({ id: 'b' })])).toEqual({ a: 'Edited', b: '' });
        expect(syncRunCommentDrafts(edited, [])).toEqual({});
    });

    it('knows when a provider reported a cost', () => {
        expect(hasExactRunCost([makeRun()])).toBe(false);
        expect(hasExactRunCost([makeRun({ cost_usd: Number.NaN })])).toBe(false);
        expect(hasExactRunCost([makeRun({ cost_usd: 0.01 })])).toBe(true);
    });

    it('builds export names and URLs', () => {
        expect(buildRunJsonFileName(makeRun({ provider: 'openrouter', model: 'acme/fast 1', run_index: 4 }))).toBe('openrouter__acme-fast-1__run-4.json');
        expect(buildSessionExportUrl('s 1', false)).toBe('/api/internal/ai/benchmark/export?session=s%201');
        expect(buildSessionExportUrl('s 1', true)).toBe('/api/internal/ai/benchmark/export?session=s%201&includeLogs=1');
        expect(buildSessionExportFileName('My session!')).toBe('My-session--exports.zip');
        expect(buildSessionExportFileName(null)).toBe('benchmark-session-exports.zip');
    });

    it('colours average ratings by band', () => {
        expect(getComparisonRatingClass(null)).toBe('text-muted-foreground');
        expect(getComparisonRatingClass(2.5)).toContain('emerald');
        expect(getComparisonRatingClass(2)).toContain('amber');
        expect(getComparisonRatingClass(1)).toContain('rose');
    });
});

describe('ai benchmark model: catalog', () => {
    const fast = makeModel();
    const old = makeModel({ id: 'openrouter:acme/old', model: 'acme/old', label: 'Acme Old', releasedAt: '2020-01-01', isFree: true });
    const premium = makeModel({
        id: 'openai:gpt-5',
        provider: 'openai',
        providerLabel: 'OpenAI',
        model: 'gpt-5',
        label: 'GPT-5',
        outputPricePerMillion: 10,
        supportsTools: true,
    });
    const retired = makeModel({ id: 'openrouter:acme/gone', availability: 'deprecated' as AiModelCatalogItem['availability'] });
    const models = [fast, old, premium, retired];
    const ageSettings = { showOlderModels: false, modelMaxAgeMonths: 6 };

    it('filters by availability, age, provider, capability, price and search', () => {
        expect(filterCatalogModels(models, DEFAULT_MODEL_CATALOG_FILTERS, ageSettings)).toEqual([fast, premium]);
        expect(filterCatalogModels(models, DEFAULT_MODEL_CATALOG_FILTERS, { ...ageSettings, showOlderModels: true })).toEqual([fast, old, premium]);
        expect(filterCatalogModels(models, { ...DEFAULT_MODEL_CATALOG_FILTERS, provider: 'OpenAI' }, ageSettings)).toEqual([premium]);
        expect(filterCatalogModels(models, { ...DEFAULT_MODEL_CATALOG_FILTERS, capability: 'tools' }, ageSettings)).toEqual([premium]);
        expect(filterCatalogModels(models, { ...DEFAULT_MODEL_CATALOG_FILTERS, price: 'premium' }, ageSettings)).toEqual([premium]);
        expect(filterCatalogModels(models, { ...DEFAULT_MODEL_CATALOG_FILTERS, price: 'budget' }, ageSettings)).toEqual([]);
        expect(filterCatalogModels(models, { ...DEFAULT_MODEL_CATALOG_FILTERS, price: 'free' }, { ...ageSettings, showOlderModels: true })).toEqual([old]);
        expect(filterCatalogModels(models, { ...DEFAULT_MODEL_CATALOG_FILTERS, query: '  GPT ' }, ageSettings)).toEqual([premium]);
    });

    it('groups and lists providers', () => {
        expect(Object.keys(groupModelsByProviderLabel([fast, premium, old]))).toEqual(['Acme', 'OpenAI']);
        expect(listModelProviderLabels([premium, fast, old])).toEqual(['Acme', 'OpenAI']);
    });

    it('resolves selected ids to active models, once each, in order', () => {
        expect(resolveSelectedTargets([premium.id, 'missing', fast.id, premium.id, retired.id], models)).toEqual([premium, fast]);
    });

    it('toggles picker ids and merges approved OpenRouter models', () => {
        expect(toggleModelId(['a'], 'b')).toEqual(['a', 'b']);
        expect(toggleModelId(['a', 'b'], 'a')).toEqual(['b']);
        expect(mergeApprovedOpenRouterModels(['acme/fast-1'], ['openrouter:acme/fast-1'])).toEqual(['acme/fast-1']);
        expect(mergeApprovedOpenRouterModels([], ['openai:gpt-5'])).toEqual([]);
        expect(listNewlyApprovedLiveModels(['openrouter:x/y', 'openai:gpt-5'], new Set(['openrouter:x/y']))).toEqual(['x/y']);
    });
});

describe('ai benchmark model: telemetry and URL', () => {
    it('takes the first model of each ranking and words the cards', () => {
        const point = {
            provider: 'openai',
            model: 'gpt-5',
            key: 'openai:gpt-5',
            total: 10,
            success: 9,
            failed: 1,
            successRate: 90,
            averageLatencyMs: 2000,
            totalCostUsd: 1,
            averageCostUsd: 0.1,
            costPerSecondUsd: 0.05,
        };
        const leaders = pickTelemetryLeaders({ ok: true, rankings: { fastest: [point], cheapest: [], bestValue: undefined } });
        expect(leaders).toEqual({ fastest: point, cheapest: null, bestValue: null });

        const cards = buildTelemetrySnapshotCards(leaders);
        expect(cards.map((card) => card.id)).toEqual(['fastest', 'cheapest', 'value']);
        expect(cards[0].detail).toBe('90.0% success');
        expect(cards[1]).toMatchObject({ metric: '—', detail: 'No ranking data yet', model: null });
    });

    it('sets or removes only the session key and keeps the rest of the query', () => {
        const params = new URLSearchParams('tab=x&session=old&import=abc');
        expect(withSessionParam(params, 'new').toString()).toBe('tab=x&session=new&import=abc');
        expect(withSessionParam(params, null).toString()).toBe('tab=x&import=abc');
        expect(withSessionParam(new URLSearchParams(''), 'tok').toString()).toBe('session=tok');
        expect(withoutImportParam(params).toString()).toBe('tab=x&session=old');
        expect(params.toString()).toBe('tab=x&session=old&import=abc');
    });
});
