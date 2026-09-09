import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';

import { AiProviderLogo } from './AiProviderLogo';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { groupAiModelsByProvider, type AiModelCatalogItem } from '../../config/aiModelCatalog';

const matchesQuery = (model: AiModelCatalogItem, query: string): boolean => {
    if (!query) return true;
    const haystack = `${model.providerLabel} ${model.providerShortName} ${model.label} ${model.model} ${model.id}`;
    return haystack.toLowerCase().includes(query.toLowerCase());
};

/**
 * Search field plus grouped result list, shared by both pickers below.
 *
 * The keyboard is handled here rather than by a library: this app renders
 * through preact/compat, where a component that wires its keys through refs
 * (cmdk, for one) does not reliably receive them.
 */
const ModelSearchList: React.FC<{
    models: AiModelCatalogItem[];
    query: string;
    onQueryChange: (value: string) => void;
    onPick: (model: AiModelCatalogItem) => void;
    isSelected: (model: AiModelCatalogItem) => boolean;
    emptyLabel: string;
    placeholder: string;
    autoFocus?: boolean;
}> = ({ models, query, onQueryChange, onPick, isSelected, emptyLabel, placeholder, autoFocus }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement | null>(null);

    const filtered = useMemo(
        () => models.filter((model) => matchesQuery(model, query)),
        [models, query],
    );
    const grouped = useMemo(() => groupAiModelsByProvider(filtered), [filtered]);
    const flat = useMemo(() => Object.values(grouped).flat(), [grouped]);
    const active = flat[Math.min(activeIndex, flat.length - 1)];

    // Keep the highlighted row in view while arrowing through a long list.
    // Everything here is optional: scrollIntoView and CSS.escape are missing in
    // some environments, and a missing scroll must never break the picker.
    useEffect(() => {
        if (!active || !listRef.current) return;
        const escape = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape
            : (value: string) => value.replace(/["\\]/g, '\\$&');
        const row = listRef.current.querySelector<HTMLElement>(`[data-model-id="${escape(active.id)}"]`);
        if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
    }, [active]);

    return (
        <div className="flex min-h-0 flex-col">
            <div className="relative">
                <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                    autoFocus={autoFocus}
                    value={query}
                    placeholder={placeholder}
                    className="ps-9"
                    onChange={(event) => {
                        onQueryChange(event.currentTarget.value);
                        setActiveIndex(0);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setActiveIndex((index) => Math.min(index + 1, flat.length - 1));
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            setActiveIndex((index) => Math.max(index - 1, 0));
                        } else if (event.key === 'Enter' && active && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            onPick(active);
                        }
                    }}
                />
            </div>

            <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-y-auto pe-1">
                {flat.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">{emptyLabel}</p>
                ) : Object.entries(grouped).map(([providerLabel, providerModels]: [string, AiModelCatalogItem[]]) => (
                    <div key={providerLabel} className="mb-3 last:mb-0">
                        <p className="sticky top-0 z-10 bg-white/95 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
                            {providerLabel}
                        </p>
                        <ul className="space-y-0.5">
                            {providerModels.map((model) => {
                                const selected = isSelected(model);
                                return (
                                    <li key={model.id}>
                                        <button
                                            type="button"
                                            data-model-id={model.id}
                                            onMouseEnter={() => setActiveIndex(flat.indexOf(model))}
                                            onClick={() => onPick(model)}
                                            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition ${
                                                active?.id === model.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <AiProviderLogo provider={model.provider} model={model.model} size={18} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-slate-900">
                                                    {model.label}
                                                </span>
                                                <span className="block truncate font-mono text-[11px] text-slate-500">
                                                    {model.model}
                                                </span>
                                            </span>
                                            {model.availability !== 'active' && (
                                                <Badge variant="secondary" className="shrink-0">Planned</Badge>
                                            )}
                                            {selected && <Check className="size-4 shrink-0 text-accent-600" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

/** Single-model picker: the app-wide default. */
export const AiModelPicker: React.FC<{
    value: string;
    models: AiModelCatalogItem[];
    onChange: (modelId: string) => void;
}> = ({ value, models, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = models.find((model) => model.id === value) || null;
    const [provider, model] = value.includes(':') ? value.split(/:(.*)/s) : ['', value];

    return (
        <>
            <button
                type="button"
                onClick={() => { setQuery(''); setIsOpen(true); }}
                className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 transition hover:border-slate-400 focus-visible:border-accent-400 focus-visible:outline-none"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <AiProviderLogo provider={selected?.provider || provider} model={selected?.model || model} size={18} />
                    <span className="min-w-0 text-start">
                        <span className="block truncate font-medium">{selected?.label || model || 'Pick a model'}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-500">{value}</span>
                    </span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Default AI model</DialogTitle>
                        <DialogDescription>
                            The planner and the Trip Agent both follow this. Only approved models are used at runtime.
                        </DialogDescription>
                    </DialogHeader>
                    <ModelSearchList
                        autoFocus
                        models={models}
                        query={query}
                        onQueryChange={setQuery}
                        isSelected={(item) => item.id === value}
                        placeholder="Search a provider or model…"
                        emptyLabel="No model matches that search."
                        onPick={(item) => {
                            onChange(item.id);
                            setIsOpen(false);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

/**
 * Multi-select for the approved OpenRouter list. A model the catalogue does not
 * know yet can still be added by hand, because OpenRouter ships new ids faster
 * than this repository does.
 */
export const ApprovedOpenRouterModelsField: React.FC<{
    value: string[];
    models: AiModelCatalogItem[];
    onChange: (next: string[]) => void;
}> = ({ value, models, onChange }) => {
    const [query, setQuery] = useState('');
    const [customModel, setCustomModel] = useState('');
    const openRouterModels = useMemo(
        () => models.filter((model) => model.provider === 'openrouter'),
        [models],
    );
    const knownIds = useMemo(
        () => new Set(openRouterModels.map((model) => model.model)),
        [openRouterModels],
    );
    const extras = value.filter((model) => !knownIds.has(model));

    const toggle = (modelId: string) => {
        onChange(value.includes(modelId)
            ? value.filter((entry) => entry !== modelId)
            : [...value, modelId].sort());
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">Approved OpenRouter models</span>
                <Badge variant="secondary">{value.length} approved</Badge>
            </div>

            <div className="rounded-xl border border-slate-200 p-2">
                <div className="flex h-72 flex-col">
                    <ModelSearchList
                        models={openRouterModels}
                        query={query}
                        onQueryChange={setQuery}
                        isSelected={(model) => value.includes(model.model)}
                        placeholder="Filter the OpenRouter catalogue…"
                        emptyLabel="No catalogue model matches. Add the id by hand below."
                        onPick={(model) => toggle(model.model)}
                    />
                </div>
            </div>

            {extras.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {extras.map((model) => (
                        <span
                            key={model}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 ps-2.5 pe-1 font-mono text-[11px] text-slate-700"
                        >
                            {model}
                            <button
                                type="button"
                                aria-label={`Remove ${model}`}
                                onClick={() => onChange(value.filter((entry) => entry !== model))}
                                className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-2 flex items-center gap-2">
                <Input
                    value={customModel}
                    placeholder="vendor/model-id"
                    spellCheck={false}
                    className="font-mono text-xs"
                    onChange={(event) => setCustomModel(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        // A Korean or Japanese keyboard sends Enter to accept a
                        // candidate; that must not add a model.
                        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                        event.preventDefault();
                        const next = customModel.trim();
                        if (!next || value.includes(next)) return;
                        onChange([...value, next].sort());
                        setCustomModel('');
                    }}
                />
                <Button
                    type="button"
                    variant="secondary"
                    disabled={!customModel.trim() || value.includes(customModel.trim())}
                    onClick={() => {
                        const next = customModel.trim();
                        onChange([...value, next].sort());
                        setCustomModel('');
                    }}
                >
                    <Plus className="size-4" /> Add
                </Button>
            </div>
        </div>
    );
};

export { Checkbox };
