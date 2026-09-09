import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';

import { AdminShell } from '../components/admin/AdminShell';
import { AiModelPicker, ApprovedOpenRouterModelsField } from '../components/admin/AiModelPicker';
import { Button } from '../components/ui/button';
import { NumberInput } from '../components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { AI_MODEL_CATALOG, sortAiModels, type AiModelCatalogItem } from '../config/aiModelCatalog';
import {
    MAP_STYLE_OPTIONS,
    refreshPublicAiRuntimeSettings,
    updateAppRuntimeSettings,
    type AiRuntimeSettings,
} from '../services/aiRuntimeSettingsService';
import type { MapStyle } from '../types';
import type { MapRuntimePreset } from '../shared/mapRuntime';

// A plain wrapper rather than a <label>: these controls are Radix triggers and
// buttons, and wrapping one in a label makes a click on the caption fire twice.
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
        {children}
        {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </div>
);

const MAP_STYLE_LABELS: Record<MapStyle, string> = {
    minimal: 'Minimal',
    standard: 'Standard (Mapbox)',
    dark: 'Dark',
    satellite: 'Satellite',
    clean: 'Clean',
    cleanDark: 'Clean dark',
};

const MAP_RUNTIME_PRESETS: Array<{ value: MapRuntimePreset; label: string; hint: string }> = [
    {
        value: 'google_all',
        label: 'Google for everything',
        hint: 'Google renders the map and answers routing, place search and the generated preview images.',
    },
    {
        value: 'mapbox_visual_google_services',
        label: 'Mapbox visuals, Google services',
        hint: 'Mapbox draws the map and the preview images; Google still answers routing and place search, which Mapbox is not wired up for here.',
    },
    {
        value: 'mapbox_all',
        label: 'Mapbox for everything',
        hint: 'Routing and place search fall back to Google anyway — this app has no Mapbox implementation for them.',
    },
];

const Section: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({
    title,
    description,
    children,
}) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        <div className="mt-4 space-y-4">{children}</div>
    </section>
);

const Toggle: React.FC<{
    label: string;
    hint: string;
    checked: boolean;
    onChange: (next: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
    <div className="flex items-start justify-between gap-4">
        <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900">{label}</span>
            <span className="block text-xs text-slate-500">{hint}</span>
        </span>
        <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
);

/**
 * The app-wide switches, in one place. Every one of these used to be a hand
 * written UPDATE against app_runtime_settings.
 */
export const AdminGlobalSettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<AiRuntimeSettings | null>(null);
    const [draft, setDraft] = useState<AiRuntimeSettings | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        refreshPublicAiRuntimeSettings()
            .then((loaded) => {
                if (!active) return;
                setSettings(loaded);
                setDraft(loaded);
                setStatus('idle');
            })
            .catch((cause: unknown) => {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : 'Could not load the settings.');
                setStatus('idle');
            });
        return () => { active = false; };
    }, []);

    // The stored default may be a live OpenRouter id the catalogue does not
    // carry; keep it in the list so the picker can show what is actually set.
    const catalogModels = useMemo<AiModelCatalogItem[]>(() => {
        const models = sortAiModels(AI_MODEL_CATALOG);
        if (!draft?.defaultModelId || models.some((model) => model.id === draft.defaultModelId)) return models;
        const [provider, model] = draft.defaultModelId.split(/:(.*)/s);
        return [...models, {
            id: draft.defaultModelId,
            provider: provider as AiModelCatalogItem['provider'],
            providerLabel: 'Configured',
            providerShortName: provider || 'Custom',
            model: model || draft.defaultModelId,
            label: model || draft.defaultModelId,
            availability: 'active',
            releasedAt: new Date().toISOString().slice(0, 10),
            estimatedCostPerQueryLabel: 'Live pricing',
            costNote: 'Set as the runtime default.',
        }];
    }, [draft?.defaultModelId]);

    const isDirty = useMemo(() => (
        Boolean(settings && draft) && JSON.stringify(settings) !== JSON.stringify(draft)
    ), [draft, settings]);

    const update = useCallback((patch: Partial<AiRuntimeSettings>) => {
        setDraft((current) => (current ? { ...current, ...patch } : current));
    }, []);

    const save = useCallback(async () => {
        if (!draft) return;
        setStatus('saving');
        setError(null);
        try {
            const saved = await updateAppRuntimeSettings({
                plannerBetaOpen: draft.plannerBetaOpen,
                tripAgentEnabled: draft.tripAgentEnabled,
                tripAgentAdminPreview: draft.tripAgentAdminPreview,
                defaultModelId: draft.defaultModelId,
                approvedOpenRouterModels: draft.approvedOpenRouterModels,
                modelMaxAgeMonths: draft.modelMaxAgeMonths,
                showOlderModels: draft.showOlderModels,
                mapDefaultStyle: draft.mapDefaultStyle,
                mapRuntimePreset: draft.mapRuntimePreset,
            });
            setSettings(saved);
            setDraft(saved);
            setSavedAt(Date.now());
        } catch (cause: unknown) {
            setError(cause instanceof Error ? cause.message : 'The save was refused.');
        } finally {
            setStatus('idle');
        }
    }, [draft]);

    return (
        <AdminShell
            title="Global settings"
            description="App-wide switches: the AI chat rollout, the default model, and the map every visitor starts on."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <Button
                    type="button"
                    onClick={() => { void save(); }}
                    disabled={!isDirty || status !== 'idle'}
                >
                    {status === 'saving' ? 'Saving…' : 'Save changes'}
                </Button>
            )}
        >
            {error && (
                <p className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <WarningCircle size={18} weight="duotone" className="mt-px shrink-0" />
                    {error}
                </p>
            )}
            {savedAt && !isDirty && !error && (
                <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle size={18} weight="duotone" />
                    Saved. Visitors pick the change up on their next page load.
                </p>
            )}

            {!draft ? (
                <p className="text-sm text-slate-500">Loading the current settings…</p>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Section
                        title="Trip Agent"
                        description="The planning chat inside a trip. Both the API and the launcher read these, so turning it off hides the entry point as well."
                    >
                        <Toggle
                            label="Enabled for everyone"
                            hint="Every account whose plan allows the agent can open the chat."
                            checked={draft.tripAgentEnabled}
                            onChange={(tripAgentEnabled) => update({ tripAgentEnabled })}
                        />
                        <Toggle
                            label="Administrator preview"
                            hint="Administrators can use it even while it is switched off."
                            checked={draft.tripAgentAdminPreview}
                            onChange={(tripAgentAdminPreview) => update({ tripAgentAdminPreview })}
                        />
                    </Section>

                    <Section
                        title="AI model"
                        description="The app-wide default the planner and the Trip Agent both follow. A model that is not on the approved list is never used."
                    >
                        <Field label="Default model" hint="Search by provider or model name.">
                            <AiModelPicker
                                value={draft.defaultModelId}
                                models={catalogModels}
                                onChange={(defaultModelId) => update({ defaultModelId })}
                            />
                        </Field>
                        <ApprovedOpenRouterModelsField
                            value={draft.approvedOpenRouterModels}
                            models={catalogModels}
                            onChange={(approvedOpenRouterModels) => update({ approvedOpenRouterModels })}
                        />
                        <div className="flex flex-wrap items-start gap-6">
                            <Field label="Model age limit (months)">
                                <NumberInput
                                    min={1}
                                    max={36}
                                    value={draft.modelMaxAgeMonths}
                                    className="w-32"
                                    onChange={(event) => update({
                                        modelMaxAgeMonths: Math.max(1, Math.min(36, Math.round(Number(event.target.value) || 1))),
                                    })}
                                />
                            </Field>
                            <div className="flex-1 pt-5">
                                <Toggle
                                    label="Show older models"
                                    hint="List models past the age limit in the pickers."
                                    checked={draft.showOlderModels}
                                    onChange={(showOlderModels) => update({ showOlderModels })}
                                />
                            </div>
                        </div>
                    </Section>

                    <Section
                        title="Map"
                        description="Which map stack the app runs on, and which style a visitor starts on. Anyone who picks a style themselves keeps their choice."
                    >
                        <Field
                            label="Map provider"
                            hint={MAP_RUNTIME_PRESETS.find((preset) => preset.value === draft.mapRuntimePreset)?.hint}
                        >
                            <Select
                                value={draft.mapRuntimePreset}
                                onValueChange={(value) => update({ mapRuntimePreset: value as MapRuntimePreset })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MAP_RUNTIME_PRESETS.map((preset) => (
                                        <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Default map style">
                            <Select
                                value={draft.mapDefaultStyle}
                                onValueChange={(value) => update({ mapDefaultStyle: value as MapStyle })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MAP_STYLE_OPTIONS.map((style) => (
                                        <SelectItem key={style} value={style}>{MAP_STYLE_LABELS[style]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </Section>

                    <Section
                        title="Planner"
                        description="Access to the planner beta while it is not open to everyone."
                    >
                        <Toggle
                            label="Planner beta open"
                            hint="Anyone can enter the planner beta without an invite."
                            checked={draft.plannerBetaOpen}
                            onChange={(plannerBetaOpen) => update({ plannerBetaOpen })}
                        />
                    </Section>
                </div>
            )}

            {settings?.updatedAt && (
                <p className="mt-4 text-xs text-slate-500">
                    Last changed {new Date(settings.updatedAt).toLocaleString()}.
                </p>
            )}
        </AdminShell>
    );
};
