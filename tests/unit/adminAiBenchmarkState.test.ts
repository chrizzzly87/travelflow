import { describe, expect, it } from 'vitest';
import type { BenchmarkRun } from '../../components/admin/aiBenchmarkRuns';
import { DEFAULT_BENCHMARK_RUN_FILTERS } from '../../components/admin/aiBenchmarkRuns';
import { CUSTOM_JSON_PRESET_ID, MANUAL_CUSTOM_SCENARIO_META } from '../../components/admin/ai-benchmark/aiBenchmarkModel';
import {
    DEFAULT_EXECUTION_SETTINGS,
    aiBenchmarkSetupReducer,
    createInitialAiBenchmarkSetupState,
} from '../../components/admin/ai-benchmark/aiBenchmarkSetupState';
import {
    aiBenchmarkModelsReducer,
    createInitialAiBenchmarkModelsState,
} from '../../components/admin/ai-benchmark/aiBenchmarkModelsState';
import {
    INITIAL_AI_BENCHMARK_SESSION_STATE,
    aiBenchmarkSessionReducer,
} from '../../components/admin/ai-benchmark/aiBenchmarkSessionState';
import {
    INITIAL_AI_BENCHMARK_WORKSPACE_STATE,
    aiBenchmarkWorkspaceReducer,
} from '../../components/admin/ai-benchmark/aiBenchmarkWorkspaceState';
import { buildInitialAdminAiRuntimeSettings } from '../../components/admin/adminAiRuntimeSettingsDraft';
import type { BenchmarkSession } from '../../components/admin/ai-benchmark/aiBenchmarkApi';

const DEFAULT_DATES = { startDate: '2026-12-01', endDate: '2026-12-14' };

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

const SESSION: BenchmarkSession = {
    id: 'session-1',
    share_token: 'share-1',
    name: 'Session',
    flow: 'classic',
    scenario: {},
    created_at: '2026-10-24T10:00:00.000Z',
    updated_at: '2026-10-24T10:00:00.000Z',
};

describe('aiBenchmarkSetupReducer', () => {
    const initial = createInitialAiBenchmarkSetupState(DEFAULT_DATES);

    it('starts on the first system template with its mask and the default execution settings', () => {
        expect(initial.selectedPresetId).toBe(initial.presetConfigs[0].id);
        expect(initial.mask.destinations).toBe(initial.presetConfigs[0].scenario.destinations);
        expect(initial.execution).toEqual(DEFAULT_EXECUTION_SETTINGS);
        expect(initial.execution).toMatchObject({ timeoutSeconds: 60, reasoningMode: 'low', concurrency: 2, compactOutput: true });
        expect(initial.presetEditor).toBeNull();
        expect(initial.templateDetailsOpen).toBe(false);
    });

    it('applies a scenario as the mask with default dates filled in', () => {
        const next = aiBenchmarkSetupReducer(initial, {
            type: 'applyMask',
            scenario: { ...initial.mask, destinations: 'Peru', startDate: null, endDate: null },
        });
        expect(next.mask).toMatchObject({ destinations: 'Peru', startDate: DEFAULT_DATES.startDate, endDate: DEFAULT_DATES.endDate });
    });

    it('marks hand-edited custom JSON as manual only when it has no source yet', () => {
        const edited = aiBenchmarkSetupReducer(initial, { type: 'editCustomJson', value: '{}' });
        expect(edited.customScenarioMeta).toEqual(MANUAL_CUSTOM_SCENARIO_META);

        const imported = aiBenchmarkSetupReducer(initial, {
            type: 'importScenario',
            scenario: { ...initial.mask, destinations: 'Chile' },
            json: '{"a":1}',
            meta: { source: 'trip_info', flow: 'classic', tripId: 't-1' },
        });
        expect(imported.selectedPresetId).toBe(CUSTOM_JSON_PRESET_ID);
        expect(imported.mask.destinations).toBe('Chile');
        const editedImport = aiBenchmarkSetupReducer(imported, { type: 'editCustomJson', value: '{"a":2}' });
        expect(editedImport.customScenarioMeta?.source).toBe('trip_info');
        expect(editedImport.customScenarioJsonDraft).toBe('{"a":2}');

        expect(aiBenchmarkSetupReducer(imported, { type: 'ensureCustomMeta' })).toBe(imported);
        expect(aiBenchmarkSetupReducer(initial, { type: 'ensureCustomMeta' }).customScenarioMeta).toEqual(MANUAL_CUSTOM_SCENARIO_META);
    });

    it('edits the template draft and applies a saved template', () => {
        expect(aiBenchmarkSetupReducer(initial, { type: 'editPresetDraft', patch: { name: 'x' } })).toBe(initial);

        const opened = aiBenchmarkSetupReducer(initial, {
            type: 'openPresetEditor',
            draft: { mode: 'create', id: 'custom-1', kind: 'custom', name: 'New', description: '', scenario: initial.mask },
        });
        const renamed = aiBenchmarkSetupReducer(opened, { type: 'editPresetDraft', patch: { name: 'Renamed' } });
        const retargeted = aiBenchmarkSetupReducer(renamed, { type: 'editPresetDraftScenario', patch: { destinations: 'Iceland' } });
        expect(retargeted.presetEditor).toMatchObject({ name: 'Renamed', scenario: { destinations: 'Iceland' } });

        const preset = { id: 'custom-1', name: 'Renamed', description: '', kind: 'custom' as const, scenario: retargeted.presetEditor!.scenario };
        const saved = aiBenchmarkSetupReducer(retargeted, { type: 'presetSaved', presets: [...initial.presetConfigs, preset], preset });
        expect(saved.presetEditor).toBeNull();
        expect(saved.selectedPresetId).toBe('custom-1');
        expect(saved.mask.destinations).toBe('Iceland');
    });

    it('patches execution settings and per-model reasoning', () => {
        const patched = aiBenchmarkSetupReducer(initial, { type: 'setExecution', patch: { concurrency: 4, compactOutput: false } });
        expect(patched.execution).toMatchObject({ concurrency: 4, compactOutput: false, timeoutSeconds: 60 });
        const withOverride = aiBenchmarkSetupReducer(patched, { type: 'setModelReasoningMode', modelId: 'm1', value: 'high' });
        expect(withOverride.execution.modelReasoningModes).toEqual({ m1: 'high' });
        const cleared = aiBenchmarkSetupReducer(withOverride, { type: 'setModelReasoningMode', modelId: 'm1', value: undefined });
        expect(cleared.execution.modelReasoningModes).toEqual({});
    });
});

describe('aiBenchmarkModelsReducer', () => {
    const initial = createInitialAiBenchmarkModelsState({
        runtimeSettings: buildInitialAdminAiRuntimeSettings('openai:gpt-5.4'),
        modelTargetIds: ['a', 'b', 'c'],
    });

    it('tracks catalog loading and keeps settings when the response has none', () => {
        const requested = aiBenchmarkModelsReducer(initial, { type: 'catalogRequested' });
        expect(requested.catalogLoading).toBe(true);
        const received = aiBenchmarkModelsReducer(requested, { type: 'catalogReceived', models: [] });
        expect(received.runtimeSettings).toBe(initial.runtimeSettings);
        const settled = aiBenchmarkModelsReducer(received, { type: 'catalogSettled' });
        expect(settled).toMatchObject({ catalogLoading: false, catalogLoaded: true });
        expect(aiBenchmarkModelsReducer(settled, { type: 'catalogReset' }).catalogLoaded).toBe(false);
        expect(aiBenchmarkModelsReducer(initial, { type: 'catalogReset' })).toBe(initial);
    });

    it('switches targets off and on, and prunes ones no longer selected', () => {
        const off = aiBenchmarkModelsReducer(initial, { type: 'deactivateTargets', modelIds: ['a', 'b'] });
        const toggled = aiBenchmarkModelsReducer(off, { type: 'toggleTargetActive', modelId: 'a' });
        expect(toggled.inactiveModelTargetIds).toEqual(['b']);
        expect(aiBenchmarkModelsReducer(toggled, { type: 'pruneInactiveTargets', selectedIds: new Set(['b', 'c']) })).toBe(toggled);
        expect(aiBenchmarkModelsReducer(toggled, { type: 'pruneInactiveTargets', selectedIds: new Set(['c']) }).inactiveModelTargetIds).toEqual([]);
        expect(aiBenchmarkModelsReducer(off, { type: 'activateAllTargets' }).inactiveModelTargetIds).toEqual([]);
    });

    it('removes one target or all of them along with their off switch', () => {
        const off = aiBenchmarkModelsReducer(initial, { type: 'deactivateTargets', modelIds: ['b'] });
        const removed = aiBenchmarkModelsReducer(off, { type: 'removeModelTarget', modelId: 'b' });
        expect(removed).toMatchObject({ modelTargetIds: ['a', 'c'], inactiveModelTargetIds: [] });
        expect(aiBenchmarkModelsReducer(off, { type: 'clearModelTargets' })).toMatchObject({ modelTargetIds: [], inactiveModelTargetIds: [] });
    });

    it('opens the picker on the current list with cleared filters and saves its draft', () => {
        const filtered = aiBenchmarkModelsReducer(initial, { type: 'setPickerFilters', patch: { query: 'gpt', price: 'free' } });
        const opened = aiBenchmarkModelsReducer(filtered, { type: 'openPicker' });
        expect(opened.picker).toEqual({ open: true, draftIds: ['a', 'b', 'c'], filters: { query: '', provider: 'all', capability: 'all', price: 'all' } });
        const toggled = aiBenchmarkModelsReducer(opened, { type: 'toggleDraftModel', modelId: 'a' });
        expect(toggled.picker.draftIds).toEqual(['b', 'c']);

        const off = aiBenchmarkModelsReducer(toggled, { type: 'deactivateTargets', modelIds: ['a', 'c'] });
        const saved = aiBenchmarkModelsReducer(off, { type: 'pickerSaved', modelIds: ['b', 'c'] });
        expect(saved).toMatchObject({ modelTargetIds: ['b', 'c'], inactiveModelTargetIds: ['c'] });
        expect(saved.picker.open).toBe(false);
    });
});

describe('aiBenchmarkSessionReducer', () => {
    it('loads a session with a local summary when the API sends none, and seeds note drafts', () => {
        const loaded = aiBenchmarkSessionReducer(INITIAL_AI_BENCHMARK_SESSION_STATE, {
            type: 'sessionLoaded',
            session: SESSION,
            runs: [makeRun({ run_comment: 'Nice' }), makeRun({ id: 'run-2', status: 'failed' })],
        });
        expect(loaded.session).toBe(SESSION);
        expect(loaded.summary).toMatchObject({ total: 2, completed: 1, failed: 1 });
        expect(loaded.commentDrafts).toEqual({ 'run-1': 'Nice', 'run-2': '' });
    });

    it('prepends optimistic runs and fails them when the request fails', () => {
        const loaded = aiBenchmarkSessionReducer(INITIAL_AI_BENCHMARK_SESSION_STATE, { type: 'runsReceived', runs: [makeRun()] });
        const optimistic = aiBenchmarkSessionReducer(loaded, {
            type: 'optimisticRunsAdded',
            runs: [makeRun({ id: 'optimistic-1', status: 'running' })],
        });
        expect(optimistic.runs.map((run) => run.id)).toEqual(['optimistic-1', 'run-1']);
        expect(optimistic.summary?.running).toBe(1);
        expect(optimistic.commentDrafts).toEqual({ 'run-1': '' });

        const failed = aiBenchmarkSessionReducer(optimistic, { type: 'optimisticRunsFailed', finishedAtIso: '2026-10-24T10:01:00.000Z' });
        expect(failed.runs[0]).toMatchObject({ status: 'failed', error_message: 'Benchmark request failed before run completion.' });
        expect(failed.summary?.failed).toBe(1);
    });

    it('merges a judged run and resets its note draft to the saved note', () => {
        const loaded = aiBenchmarkSessionReducer(INITIAL_AI_BENCHMARK_SESSION_STATE, { type: 'runsReceived', runs: [makeRun()] });
        const drafted = aiBenchmarkSessionReducer(loaded, { type: 'editCommentDraft', runId: 'run-1', value: 'Unsaved' });
        expect(drafted.commentDrafts['run-1']).toBe('Unsaved');

        const reloaded = aiBenchmarkSessionReducer(drafted, { type: 'runsReceived', runs: [makeRun({ run_comment: 'Server' })] });
        expect(reloaded.commentDrafts['run-1']).toBe('Unsaved');

        const judged = aiBenchmarkSessionReducer(drafted, {
            type: 'runUpdated',
            run: makeRun({ satisfaction_rating: 'good', run_comment: 'Saved' }),
        });
        expect(judged.runs[0]).toMatchObject({ satisfaction_rating: 'good', run_comment: 'Saved' });
        expect(judged.commentDrafts['run-1']).toBe('Saved');
    });

    it('clears the session, runs, summary and drafts', () => {
        const loaded = aiBenchmarkSessionReducer(INITIAL_AI_BENCHMARK_SESSION_STATE, { type: 'sessionLoaded', session: SESSION, runs: [makeRun()] });
        const cleared = aiBenchmarkSessionReducer(loaded, { type: 'sessionCleared' });
        expect(cleared).toMatchObject({ session: null, runs: [], summary: null, commentDrafts: {} });
    });
});

describe('aiBenchmarkWorkspaceReducer', () => {
    it('patches, resets and sorts the run filters', () => {
        const patched = aiBenchmarkWorkspaceReducer(INITIAL_AI_BENCHMARK_WORKSPACE_STATE, { type: 'patchRunFilters', patch: { onlyUnrated: true } });
        expect(patched.runFilters).toEqual({ ...DEFAULT_BENCHMARK_RUN_FILTERS, onlyUnrated: true });
        expect(aiBenchmarkWorkspaceReducer(patched, { type: 'resetRunFilters' }).runFilters).toBe(DEFAULT_BENCHMARK_RUN_FILTERS);
        const asc = aiBenchmarkWorkspaceReducer(patched, { type: 'toggleRunSort' });
        expect(asc.runSortDirection).toBe('asc');
        expect(aiBenchmarkWorkspaceReducer(asc, { type: 'toggleRunSort' }).runSortDirection).toBe('desc');
    });

    it('replaces only a "Queued" notice when the queue drains', () => {
        const queued = aiBenchmarkWorkspaceReducer(INITIAL_AI_BENCHMARK_WORKSPACE_STATE, { type: 'setMessage', message: 'Queued 2 target(s) …' });
        expect(aiBenchmarkWorkspaceReducer(queued, { type: 'queuedRunsFinished' }).message).toBe('All queued runs finished.');
        const other = aiBenchmarkWorkspaceReducer(INITIAL_AI_BENCHMARK_WORKSPACE_STATE, { type: 'setMessage', message: 'Prompt copied to clipboard.' });
        expect(aiBenchmarkWorkspaceReducer(other, { type: 'queuedRunsFinished' })).toBe(other);
        expect(aiBenchmarkWorkspaceReducer(INITIAL_AI_BENCHMARK_WORKSPACE_STATE, { type: 'queuedRunsFinished' })).toBe(INITIAL_AI_BENCHMARK_WORKSPACE_STATE);
    });

    it('starting a new session closes the sheet, clears notices and opens Setup', () => {
        let state = aiBenchmarkWorkspaceReducer(INITIAL_AI_BENCHMARK_WORKSPACE_STATE, { type: 'inspectRun', runId: 'run-1' });
        state = aiBenchmarkWorkspaceReducer(state, { type: 'setError', error: 'Boom' });
        state = aiBenchmarkWorkspaceReducer(state, { type: 'setMessage', message: 'Hi' });
        state = aiBenchmarkWorkspaceReducer(state, { type: 'newSessionStarted' });
        expect(state).toMatchObject({ inspectedRunId: null, error: null, message: null, tab: 'setup' });
    });
});
