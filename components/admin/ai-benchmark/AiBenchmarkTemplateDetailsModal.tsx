import React from 'react';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { AppModal } from '../../ui/app-modal';
import { Button } from '../../ui/button';
import { CUSTOM_JSON_PRESET_ID } from './aiBenchmarkModel';
import { HighlightedJson } from './HighlightedJson';
import type { AiBenchmarkSetup } from './useAiBenchmarkSetup';
import type { AiBenchmarkSetupActions } from './useAiBenchmarkSetupActions';

/** The selected template's summary and JSON; the custom template's JSON is editable here. */
export const AiBenchmarkTemplateDetailsModal: React.FC<{
    setup: AiBenchmarkSetup;
    setupActions: AiBenchmarkSetupActions;
}> = ({ setup, setupActions }) => {
    const { mask, templateDetailsOpen, selectedPresetId, customScenarioJsonDraft } = setup.state;
    const { selectedPreset, selectedTemplateJson, customScenarioDraftParse } = setup;
    const isCustom = selectedPresetId === CUSTOM_JSON_PRESET_ID;
    const close = () => setup.dispatch({ type: 'setTemplateDetailsOpen', open: false });
    const summaryItems = [
        { label: 'Route', value: mask.destinations || 'Not set' },
        { label: 'Dates', value: mask.dateInputMode === 'flex' ? `${mask.flexWeeks} weeks · ${mask.flexWindow}` : `${mask.startDate} → ${mask.endDate}` },
        { label: 'Budget', value: mask.budget },
        { label: 'Pace', value: mask.pace },
    ];

    return (
        <AppModal
            isOpen={templateDetailsOpen}
            onClose={close}
            title={selectedPreset?.name || 'Trip template details'}
            description="Review the benchmark input without losing the run configuration."
            size="xl"
            mobileSheet={false}
            contentClassName="sm:rounded-lg"
            footer={(
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={setupActions.openPromptPreview}>Preview prompt</Button>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setupActions.openPresetEditor('create')}>
                            Save as new template
                        </Button>
                        {!isCustom && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setupActions.openPresetEditor('edit')}>
                                Edit template
                            </Button>
                        )}
                        <Button type="button" size="sm" onClick={close}>Done</Button>
                    </div>
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="grid gap-2 sm:grid-cols-4">
                    {summaryItems.map((item) => (
                        <div key={item.label} className="min-w-0 rounded-md border border-border bg-secondary p-3">
                            <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
                            <div className="mt-1 truncate text-sm font-semibold text-foreground" data-tooltip={item.value}>{item.value}</div>
                        </div>
                    ))}
                </div>

                <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="text-sm font-semibold text-foreground">Scenario JSON</h4>
                            <p className="text-xs text-muted-foreground">The normalized input sent through the classic benchmark contract.</p>
                        </div>
                        {isCustom && (
                            <AdminStatusBadge tone={customScenarioDraftParse.error ? 'danger' : 'neutral'} className="max-w-full truncate">
                                {customScenarioDraftParse.error || `Mapped as ${customScenarioDraftParse.flow}`}
                            </AdminStatusBadge>
                        )}
                    </div>

                    {isCustom ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                aria-label="Custom scenario JSON"
                                value={customScenarioJsonDraft}
                                onChange={(event) => setup.dispatch({ type: 'editCustomJson', value: event.target.value })}
                                rows={16}
                                spellCheck={false}
                                className="min-h-[320px] w-full rounded-md border border-slate-700 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 outline-none focus-visible:border-accent-400 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                placeholder='{"destinationPrompt":"Berlin, Germany","options":{"budget":"Medium"}}'
                            />
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setupActions.loadCurrentMaskIntoCustomJson()}>Load current setup</Button>
                                <Button type="button" size="sm" onClick={setupActions.applyCustomJsonToMask} disabled={!customScenarioJsonDraft.trim() || Boolean(customScenarioDraftParse.error)}>Apply JSON</Button>
                            </div>
                        </div>
                    ) : (
                        <pre className="max-h-[420px] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-4 text-xs leading-6">
                            <HighlightedJson value={selectedTemplateJson} />
                        </pre>
                    )}
                </div>
            </div>
        </AppModal>
    );
};
