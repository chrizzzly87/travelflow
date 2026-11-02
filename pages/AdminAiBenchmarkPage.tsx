import React, { useMemo, useRef } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import { getDefaultTripDates } from '../utils';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { buildModelComparisonRows, type AiBenchmarkWorkspaceTab } from '../components/admin/aiBenchmarkRuns';
import { usePrismThemeStylesheet } from '../components/admin/ai-benchmark/prismJson';
import { AiBenchmarkExecutionSection } from '../components/admin/ai-benchmark/AiBenchmarkExecutionSection';
import { AiBenchmarkInspectedRunSheet } from '../components/admin/ai-benchmark/AiBenchmarkInspectedRunSheet';
import { AiBenchmarkHeaderActions } from '../components/admin/ai-benchmark/AiBenchmarkHeaderActions';
import { AiBenchmarkModelComparison } from '../components/admin/ai-benchmark/AiBenchmarkModelComparison';
import { AiBenchmarkModelPickerModal } from '../components/admin/ai-benchmark/AiBenchmarkModelPickerModal';
import { AiBenchmarkModelsSection } from '../components/admin/ai-benchmark/AiBenchmarkModelsSection';
import { AiBenchmarkPresetEditorModal } from '../components/admin/ai-benchmark/AiBenchmarkPresetEditorModal';
import { AiBenchmarkPromptModal } from '../components/admin/ai-benchmark/AiBenchmarkPromptModal';
import { AiBenchmarkRunsTab } from '../components/admin/ai-benchmark/AiBenchmarkRunsTab';
import { AiBenchmarkTelemetrySnapshot } from '../components/admin/ai-benchmark/AiBenchmarkTelemetrySnapshot';
import { AiBenchmarkTemplateDetailsModal } from '../components/admin/ai-benchmark/AiBenchmarkTemplateDetailsModal';
import { AiBenchmarkTemplateSection } from '../components/admin/ai-benchmark/AiBenchmarkTemplateSection';
import { AiBenchmarkWorkspaceBar } from '../components/admin/ai-benchmark/AiBenchmarkWorkspaceBar';
import { useAiBenchmarkApi } from '../components/admin/ai-benchmark/useAiBenchmarkApi';
import { useAiBenchmarkModelCatalog } from '../components/admin/ai-benchmark/useAiBenchmarkModelCatalog';
import { useAiBenchmarkPreferences } from '../components/admin/ai-benchmark/useAiBenchmarkPreferences';
import { useAiBenchmarkRunActions } from '../components/admin/ai-benchmark/useAiBenchmarkRunActions';
import { useAiBenchmarkSession } from '../components/admin/ai-benchmark/useAiBenchmarkSession';
import { useAiBenchmarkSetup } from '../components/admin/ai-benchmark/useAiBenchmarkSetup';
import { useAiBenchmarkSetupActions } from '../components/admin/ai-benchmark/useAiBenchmarkSetupActions';
import { useAiBenchmarkTelemetry } from '../components/admin/ai-benchmark/useAiBenchmarkTelemetry';
import { useAiBenchmarkRunView, useAiBenchmarkWorkspaceState } from '../components/admin/ai-benchmark/useAiBenchmarkWorkspace';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent } from '../components/ui/tabs';

export const AdminAiBenchmarkPage: React.FC = () => {
    const defaultDates = useMemo(() => getDefaultTripDates(), []);
    const resultsSectionRef = useRef<HTMLDivElement | null>(null);
    usePrismThemeStylesheet();

    const workspace = useAiBenchmarkWorkspaceState();
    const notify = workspace.dispatch;
    const api = useAiBenchmarkApi();
    const { accessToken, fetchBenchmarkApi } = api;
    const catalog = useAiBenchmarkModelCatalog({ accessToken, fetchBenchmarkApi, notify });
    const setup = useAiBenchmarkSetup(defaultDates);
    const preferences = useAiBenchmarkPreferences({ accessToken, fetchBenchmarkApi, catalog, setup, notify });
    const session = useAiBenchmarkSession({ accessToken, fetchBenchmarkApi, notify });
    const telemetry = useAiBenchmarkTelemetry({ accessToken, fetchBenchmarkApi, hasPendingRuns: session.hasPendingRuns });
    const runActions = useAiBenchmarkRunActions({ api, session, catalog, setup, telemetry, workspace: notify, resultsSectionRef });
    const setupActions = useAiBenchmarkSetupActions({
        setup,
        catalog,
        savePreferences: preferences.savePreferences,
        normalizePreferencesForClient: preferences.normalizePreferencesForClient,
        promptPreview: workspace.state.promptPreview,
        workspace: notify,
    });

    const { session: currentSession, runs, summary, loading, cancelling, commentDrafts, ratingSavingRunId, commentSavingRunId } = session.state;
    const { hasPendingRuns } = session;
    const { error, message, runFilters, runSortDirection, promptPreview } = workspace.state;
    const view = useAiBenchmarkRunView(workspace.state, runs, Boolean(currentSession));
    const modelComparisonRows = useMemo(() => buildModelComparisonRows(runs), [runs]);
    const { runnableTargets, selectedTargets } = catalog;
    const { execution } = setup.state;
    const locked = loading || cancelling || hasPendingRuns;
    const goToSetup = () => notify({ type: 'setTab', tab: 'setup' });

    return (
        <AdminShell
            title="AI benchmark"
            description="Compare trip quality, latency and cost across models."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <AiBenchmarkHeaderActions
                    hasPendingRuns={hasPendingRuns}
                    hasSession={Boolean(currentSession)}
                    cancelling={cancelling}
                    runDisabled={loading || hasPendingRuns || cancelling || runnableTargets.length === 0}
                    runnableCount={runnableTargets.length}
                    onStop={runActions.stopActiveRuns}
                    onRun={() => runActions.startBenchmark('header')}
                />
            )}
        >
            <div className="flex w-full flex-col gap-4">

                {error && <AdminErrorAlert message={error} />}

                {message && (
                    <Alert variant="success" role="status">
                        <CheckCircle weight="fill" />
                        <AlertDescription>{message}</AlertDescription>
                    </Alert>
                )}

                <Tabs
                    value={view.activeTab}
                    onValueChange={(value) => notify({ type: 'setTab', tab: value as AiBenchmarkWorkspaceTab })}
                    className="flex flex-col gap-4"
                >
                    <AiBenchmarkWorkspaceBar
                        runCount={runs.length}
                        hasAccessToken={Boolean(accessToken)}
                        isAuthenticated={api.isAuthenticated}
                        hasPendingRuns={hasPendingRuns}
                        runningCount={summary?.running ?? 0}
                        queuedCount={summary?.queued ?? 0}
                        runnableCount={runnableTargets.length}
                        selectedCount={selectedTargets.length}
                    />

                    <TabsContent value="results" className="mt-0 flex flex-col gap-4">
                        <AiBenchmarkRunsTab
                            resultsSectionRef={resultsSectionRef}
                            session={currentSession}
                            runs={runs}
                            displayRuns={view.displayRuns}
                            summary={summary}
                            loading={loading}
                            cancelling={cancelling}
                            hasPendingRuns={hasPendingRuns}
                            ratingSavingRunId={ratingSavingRunId}
                            commentSavingRunId={commentSavingRunId}
                            unratedRunCount={view.unratedRunCount}
                            runFilters={runFilters}
                            runFiltersActive={view.runFiltersActive}
                            runSortDirection={runSortDirection}
                            actions={runActions}
                            onPatchFilters={(patch) => notify({ type: 'patchRunFilters', patch })}
                            onResetFilters={() => notify({ type: 'resetRunFilters' })}
                            onToggleSort={() => notify({ type: 'toggleRunSort' })}
                            onGoToSetup={goToSetup}
                        />
                    </TabsContent>

                    <TabsContent value="compare" className="mt-0 flex flex-col gap-4">
                        <AiBenchmarkModelComparison rows={modelComparisonRows} onGoToSetup={goToSetup} />
                        <AiBenchmarkTelemetrySnapshot telemetry={telemetry} />
                    </TabsContent>

                    <TabsContent value="setup" className="mt-0">
                        <AdminSurfaceCard className="p-0">
                            <div className="divide-y divide-border">
                                <AiBenchmarkTemplateSection
                                    presetConfigs={setup.state.presetConfigs}
                                    selectedPresetId={setup.state.selectedPresetId}
                                    selectedPreset={setup.selectedPreset}
                                    mask={setup.state.mask}
                                    onSelectPreset={(value) => void setupActions.selectPreset(value)}
                                    onOpenDetails={() => setup.dispatch({ type: 'setTemplateDetailsOpen', open: true })}
                                />
                                <AiBenchmarkModelsSection
                                    catalog={catalog}
                                    setupActions={setupActions}
                                    locked={locked}
                                    runReasoningMode={execution.reasoningMode}
                                    modelReasoningModes={execution.modelReasoningModes}
                                    onModelReasoningChange={(modelId, value) => setup.dispatch({ type: 'setModelReasoningMode', modelId, value })}
                                    onRunSingle={runActions.runSingleTarget}
                                />
                                <AiBenchmarkExecutionSection
                                    execution={execution}
                                    session={currentSession}
                                    reasoningTargetCount={catalog.reasoningTargetCount}
                                    runnableTargetCount={runnableTargets.length}
                                    onChange={(patch) => setup.dispatch({ type: 'setExecution', patch })}
                                />
                            </div>
                        </AdminSurfaceCard>
                    </TabsContent>
                </Tabs>

                <AiBenchmarkInspectedRunSheet
                    run={view.inspectedRun}
                    commentDrafts={commentDrafts}
                    ratingSavingRunId={ratingSavingRunId}
                    commentSavingRunId={commentSavingRunId}
                    busy={loading}
                    cancelling={cancelling}
                    actions={runActions}
                    onClose={() => notify({ type: 'inspectRun', runId: null })}
                    onCommentDraftChange={(runId, value) => session.dispatch({ type: 'editCommentDraft', runId, value })}
                />

                <AiBenchmarkTemplateDetailsModal setup={setup} setupActions={setupActions} />

                <AiBenchmarkModelPickerModal catalog={catalog} setupActions={setupActions} />

                <AiBenchmarkPresetEditorModal
                    editor={setup.state.presetEditor}
                    defaultDates={defaultDates}
                    onEdit={(patch) => setup.dispatch({ type: 'editPresetDraft', patch })}
                    onEditScenario={setupActions.editPresetScenario}
                    onClose={() => setup.dispatch({ type: 'closePresetEditor' })}
                    onSave={() => void setupActions.savePresetDraft()}
                />

                <AiBenchmarkPromptModal
                    preview={promptPreview}
                    onClose={() => notify({ type: 'setPromptPreview', preview: null })}
                    onCopy={() => void setupActions.copyPrompt()}
                    onDownload={setupActions.downloadPrompt}
                />

            </div>
        </AdminShell>
    );
};
