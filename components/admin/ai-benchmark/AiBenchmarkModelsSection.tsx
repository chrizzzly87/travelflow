import React from 'react';
import { DotsThree, Info, Play, Plus, ToggleLeft, ToggleRight, Trash, X } from '@phosphor-icons/react';
import type { AiModelCatalogItem } from '../../../config/aiModelCatalog';
import { getAnalyticsDebugAttributes } from '../../../services/analyticsService';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AiModelPicker } from '../AiModelPicker';
import { AiProviderLogo } from '../AiProviderLogo';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Switch } from '../../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { COST_ESTIMATE_FOOTNOTE, type BenchmarkReasoningMode } from './aiBenchmarkModel';
import { ModelReasoningSelect } from './ModelReasoningSelect';
import type { AiBenchmarkModelCatalog } from './useAiBenchmarkModelCatalog';
import type { AiBenchmarkSetupActions } from './useAiBenchmarkSetupActions';

/** Setup: the benchmark's model list (reasoning, on/off, run one, remove) and the app default model. */
export const AiBenchmarkModelsSection: React.FC<{
    catalog: AiBenchmarkModelCatalog;
    setupActions: AiBenchmarkSetupActions;
    /** Loading, cancelling or a run in flight: the list can't change. */
    locked: boolean;
    runReasoningMode: BenchmarkReasoningMode;
    modelReasoningModes: Record<string, BenchmarkReasoningMode>;
    onModelReasoningChange: (modelId: string, value: BenchmarkReasoningMode | undefined) => void;
    onRunSingle: (model: AiModelCatalogItem) => void;
}> = ({ catalog, setupActions, locked, runReasoningMode, modelReasoningModes, onModelReasoningChange, onRunSingle }) => {
    const { selectedTargets, inactiveTargetIdSet, allTargetsActive, allTargetsInactive, activeModels } = catalog;
    const { defaultModelId } = catalog.state.runtimeSettings;
    const listMenuDisabled = locked || selectedTargets.length === 0;

    return (
        <section className="flex flex-col gap-3 p-4 md:p-6">
            <AdminSectionHeader
                title="Models"
                description="Switch a model off to skip it without removing it."
                actions={(
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={setupActions.openModelPicker}
                            disabled={locked}
                            {...getAnalyticsDebugAttributes('admin__ai_benchmark--add_models')}
                        >
                            <Plus />
                            Add models
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={listMenuDisabled}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled={listMenuDisabled}
                                    aria-label="Model list actions"
                                    data-tooltip="Model list actions"
                                >
                                    <DotsThree weight="bold" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[200px]">
                                <DropdownMenuItem disabled={allTargetsActive} onSelect={() => catalog.dispatch({ type: 'activateAllTargets' })}>
                                    <ToggleRight />
                                    Activate all
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={allTargetsInactive} onSelect={setupActions.deactivateAllModelTargets}>
                                    <ToggleLeft />
                                    Deactivate all
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => void setupActions.removeAllModelTargets()}>
                                    <Trash />
                                    Remove all…
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
            />

            {selectedTargets.length === 0 ? (
                <AdminEmptyState
                    title="No benchmark models selected"
                    description="Add models to build a comparison set."
                />
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                        <TableHeader className="bg-secondary">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="ps-4">Model</TableHead>
                                <TableHead className="w-[120px]">
                                    <span className="inline-flex items-center gap-1" data-tooltip={COST_ESTIMATE_FOOTNOTE} tabIndex={0}>
                                        Est. cost
                                        <Info aria-hidden="true" className="size-3.5" />
                                    </span>
                                </TableHead>
                                <TableHead className="w-[220px]">Reasoning</TableHead>
                                <TableHead className="w-[90px]">Active</TableHead>
                                <TableHead className="w-[90px] pe-4"><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedTargets.map((model) => {
                                const isActive = !inactiveTargetIdSet.has(model.id);
                                return (
                                    <TableRow key={model.id} className={!isActive ? 'bg-secondary/70 text-muted-foreground' : undefined}>
                                        <TableCell className="ps-4">
                                            <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                                <AiProviderLogo provider={model.provider} model={model.model} size={20} />
                                                <span className="min-w-0 truncate">{model.label}</span>
                                                {defaultModelId === model.id && <Badge variant="secondary">App default</Badge>}
                                            </div>
                                            <div className="select-all ps-7 font-mono text-xs text-muted-foreground">{model.providerShortName} · {model.model}</div>
                                        </TableCell>
                                        <TableCell className="text-sm tabular-nums text-foreground">
                                            {model.estimatedCostPerQueryLabel || <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <ModelReasoningSelect
                                                model={model}
                                                runDefault={runReasoningMode}
                                                value={modelReasoningModes[model.id]}
                                                onChange={(value) => onModelReasoningChange(model.id, value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={isActive}
                                                onCheckedChange={() => catalog.dispatch({ type: 'toggleTargetActive', modelId: model.id })}
                                                disabled={locked}
                                                aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${model.label}`}
                                            />
                                        </TableCell>
                                        <TableCell className="pe-4">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => onRunSingle(model)}
                                                    disabled={locked}
                                                    aria-label={`Run ${model.label} only`}
                                                    data-tooltip={`Run ${model.label} only`}
                                                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--run_single')}
                                                >
                                                    <Play weight="fill" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => void setupActions.removeModelTarget(model.id)}
                                                    disabled={locked}
                                                    aria-label={`Remove ${model.label}`}
                                                    data-tooltip={`Remove ${model.label}`}
                                                >
                                                    <X />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <div className="grid gap-1.5 border-t border-border pt-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,380px)] md:items-center">
                <div>
                    <div className="text-sm font-medium text-foreground">App default model</div>
                    <p className="text-xs text-muted-foreground">What the planner and the Trip Agent use for real trips. Picking a model here also approves it.</p>
                </div>
                <AiModelPicker
                    value={defaultModelId}
                    models={activeModels}
                    onChange={setupActions.setAppDefaultModel}
                />
            </div>
        </section>
    );
};
