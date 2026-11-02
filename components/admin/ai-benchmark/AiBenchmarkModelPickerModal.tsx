import React from 'react';
import { ArrowClockwise, Funnel } from '@phosphor-icons/react';
import type { AiModelCatalogItem } from '../../../config/aiModelCatalog';
import { AdminEmptyState } from '../AdminEmptyState';
import { AiProviderLogo } from '../AiProviderLogo';
import { AppModal } from '../../ui/app-modal';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { SearchInput } from '../../ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import type { AiBenchmarkModelCatalog } from './useAiBenchmarkModelCatalog';
import type { AiBenchmarkSetupActions } from './useAiBenchmarkSetupActions';

const MODEL_AGE_OPTIONS = [3, 6, 12, 24];

const describeModelReasoning = (model: AiModelCatalogItem): string => (
    model.supportsReasoning
        ? `Reasoning ${model.reasoningMandatory ? 'required' : 'optional'} · ${model.reasoningEfforts?.join(', ') || 'provider controlled'}${model.defaultReasoningEffort ? ` · default ${model.defaultReasoningEffort}` : ''}`
        : 'No configurable reasoning'
);

const PickerModelOption: React.FC<{
    model: AiModelCatalogItem;
    selected: boolean;
    isAppDefault: boolean;
    onToggle: (modelId: string) => void;
}> = ({ model, selected, isAppDefault, onToggle }) => {
    const disabled = model.availability !== 'active';
    return (
        <label
            className={[
                'flex w-full cursor-pointer items-center gap-3 rounded-md border p-2 text-start text-xs transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                selected
                    ? 'border-accent-300 bg-accent-50 text-accent-900 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200'
                    : 'border-border bg-card text-foreground hover:bg-secondary',
                disabled ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
        >
            <Checkbox
                checked={selected}
                disabled={disabled}
                onCheckedChange={() => onToggle(model.id)}
                aria-label={`Include ${model.label}`}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                    <AiProviderLogo provider={model.provider} model={model.model} size={12} />
                    <span className="min-w-0 truncate font-semibold">{model.label}</span>
                    {isAppDefault && <Badge variant="secondary">App default</Badge>}
                    {model.catalogSource === 'openrouter-live' && <Badge variant="outline">Live</Badge>}
                    {model.isFree && <Badge variant="outline">Free</Badge>}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                    {model.contextLength ? `${Math.round(model.contextLength / 1000)}k context · ` : ''}
                    {describeModelReasoning(model)}
                </span>
            </span>
            <span className="ms-2 shrink-0 text-xs tabular-nums text-muted-foreground">{model.estimatedCostPerQueryLabel}</span>
        </label>
    );
};

/** Pick the benchmark's models from the catalog, with filters and the model-age settings. */
export const AiBenchmarkModelPickerModal: React.FC<{
    catalog: AiBenchmarkModelCatalog;
    setupActions: AiBenchmarkSetupActions;
}> = ({ catalog, setupActions }) => {
    const { picker, runtimeSettings, catalogLoading } = catalog.state;
    const { filteredModels, groupedModels, modelProviderOptions } = catalog;
    const { filters, draftIds } = picker;
    const { setPickerFilters } = setupActions;
    const close = () => catalog.dispatch({ type: 'closePicker' });
    const toggleDraft = (modelId: string) => catalog.dispatch({ type: 'toggleDraftModel', modelId });

    return (
        <AppModal
            isOpen={picker.open}
            onClose={close}
            title="Choose benchmark models"
            description="Tick the models to compare. Saving also approves new OpenRouter models for the app."
            size="lg"
            mobileSheet={false}
            footer={(
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button>
                    <Button type="button" size="sm" onClick={() => void setupActions.saveModelPicker()}>Save {draftIds.length} model{draftIds.length === 1 ? '' : 's'}</Button>
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-secondary p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground"><Funnel size={15} aria-hidden="true" /> Catalog filters</div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => void catalog.loadModelCatalog()} disabled={catalogLoading} aria-busy={catalogLoading || undefined}>
                            <ArrowClockwise className={catalogLoading ? 'animate-spin' : ''} /> Refresh OpenRouter
                        </Button>
                    </div>
                    <SearchInput
                        aria-label="Search provider, label, or model id"
                        value={filters.query}
                        onChange={(event) => setPickerFilters({ query: event.currentTarget.value })}
                        onClear={() => setPickerFilters({ query: '' })}
                        placeholder="Search provider, model, or exact OpenRouter ID"
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <Select value={filters.provider} onValueChange={(provider) => setPickerFilters({ provider })}>
                            <SelectTrigger aria-label="Filter model provider"><SelectValue placeholder="All providers" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All providers</SelectItem>{modelProviderOptions.map((provider) => <SelectItem key={provider} value={provider}>{provider}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.capability} onValueChange={(capability) => setPickerFilters({ capability })}>
                            <SelectTrigger aria-label="Filter model capability"><SelectValue placeholder="All capabilities" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All capabilities</SelectItem><SelectItem value="structured">Structured output</SelectItem><SelectItem value="tools">Tool support</SelectItem><SelectItem value="reasoning">Reasoning</SelectItem></SelectContent>
                        </Select>
                        <Select value={filters.price} onValueChange={(price) => setPickerFilters({ price })}>
                            <SelectTrigger aria-label="Filter model price"><SelectValue placeholder="Any price" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Any price</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="budget">Budget (≤ $5/M output)</SelectItem><SelectItem value="premium">Premium (&gt; $5/M output)</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                        <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                            Newer than
                            <Select value={String(runtimeSettings.modelMaxAgeMonths)} onValueChange={(value) => setupActions.setModelMaxAgeMonths(Number(value))}>
                                <SelectTrigger aria-label="Model age threshold" className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>{MODEL_AGE_OPTIONS.map((months) => <SelectItem key={months} value={String(months)}>{months} months</SelectItem>)}</SelectContent>
                            </Select>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <Switch checked={runtimeSettings.showOlderModels} onCheckedChange={setupActions.setShowOlderModels} aria-label="Show older models" />
                            Show older models
                        </label>
                        <span className="text-xs tabular-nums text-muted-foreground">{filteredModels.length} compatible models</span>
                    </div>
                </div>
                <div className="max-h-[55vh] space-y-3 overflow-y-auto pe-1">
                    {filteredModels.length === 0 && (
                        <AdminEmptyState
                            title="No compatible models match these filters"
                            description="Try showing older models or clearing a filter."
                        />
                    )}
                    {Object.entries(groupedModels).map(([providerLabel, models]: [string, AiModelCatalogItem[]]) => (
                        <div key={providerLabel} className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <AiProviderLogo provider={models[0]?.provider || providerLabel} model={models[0]?.model} size={12} />
                                <span>{providerLabel}</span>
                            </div>
                            <div className="space-y-1">
                                {models.map((model) => (
                                    <PickerModelOption
                                        key={model.id}
                                        model={model}
                                        selected={draftIds.includes(model.id)}
                                        isAppDefault={runtimeSettings.defaultModelId === model.id}
                                        onToggle={toggleDraft}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppModal>
    );
};
