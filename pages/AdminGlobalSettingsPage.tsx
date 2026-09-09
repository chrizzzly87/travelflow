import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Flag, MapTrifold, Sparkle, WarningCircle } from '@phosphor-icons/react';

import { AdminShell } from '../components/admin/AdminShell';
import { AiModelPicker, ApprovedOpenRouterModelsField } from '../components/admin/AiModelPicker';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { NumberInput } from '../components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { SettingsPanel, SettingsRow, SettingsSection } from '../components/ui/settings-panel';
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

const MODEL_AGE_INPUT_ID = 'admin-settings-model-age';

const MAP_STYLE_LABELS: Record<MapStyle, string> = {
    minimal: 'Minimal',
    standard: 'Standard (Mapbox)',
    dark: 'Dark',
    satellite: 'Satellite',
    clean: 'Clean',
    cleanDark: 'Clean dark',
};

const MAP_RUNTIME_PRESETS: Array<{ value: MapRuntimePreset; label: string; note: string }> = [
    {
        value: 'google_all',
        label: 'Google for everything',
        note: 'Google draws the map and answers routing, place search and the preview images.',
    },
    {
        value: 'mapbox_visual_google_services',
        label: 'Mapbox visuals, Google services',
        note: 'Mapbox draws the map and the preview images. Routing and place search stay on Google.',
    },
    {
        value: 'mapbox_all',
        label: 'Mapbox for everything',
        note: 'Routing and place search still fall back to Google — there is no Mapbox implementation for them here.',
    },
];

/**
 * The app-wide switches, in one place. Every one of these used to be a hand
 * written UPDATE against app_runtime_settings.
 *
 * Grouped by the decision an administrator is making — who may reach a feature,
 * which model answers, which map stack renders — rather than by the table
 * column each value happens to live in.
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

    const discard = useCallback(() => {
        setDraft(settings);
        setError(null);
    }, [settings]);

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

    const activeMapPresetNote = MAP_RUNTIME_PRESETS
        .find((preset) => preset.value === draft?.mapRuntimePreset)?.note;

    return (
        <AdminShell
            title="Global settings"
            description="App-wide switches for the feature rollout, the AI model and the map."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <div className="flex items-center gap-2">
                    {isDirty && (
                        <>
                            <span className="hidden text-xs text-slate-500 sm:inline">Unsaved changes</span>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={discard}
                                disabled={status !== 'idle'}
                            >
                                Discard
                            </Button>
                        </>
                    )}
                    <Button
                        type="button"
                        onClick={() => { void save(); }}
                        disabled={!isDirty || status !== 'idle'}
                    >
                        {status === 'saving' ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            )}
        >
            <div className="mx-auto w-full max-w-3xl">
                {error && (
                    <Alert variant="danger" className="mb-4">
                        <WarningCircle weight="duotone" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {savedAt && !isDirty && !error && (
                    <Alert variant="success" className="mb-4">
                        <CheckCircle weight="duotone" />
                        <AlertDescription>Saved. Visitors pick the change up on their next page load.</AlertDescription>
                    </Alert>
                )}

                {!draft ? (
                    <p className="text-sm text-slate-500">Loading the current settings…</p>
                ) : (
                    <SettingsPanel>
                        <SettingsSection
                            icon={<Flag weight="duotone" />}
                            title="Rollout"
                            description="Who can reach a feature that is not open to everyone yet."
                        >
                            <SettingsRow
                                label="Trip Agent"
                                description="The planning chat inside a trip, for every plan that allows it."
                            >
                                <Switch
                                    checked={draft.tripAgentEnabled}
                                    onCheckedChange={(tripAgentEnabled) => update({ tripAgentEnabled })}
                                    aria-label="Trip Agent"
                                />
                            </SettingsRow>
                            <SettingsRow
                                label="Trip Agent administrator preview"
                                description="Administrators keep access while it is switched off."
                            >
                                <Switch
                                    checked={draft.tripAgentAdminPreview}
                                    onCheckedChange={(tripAgentAdminPreview) => update({ tripAgentAdminPreview })}
                                    aria-label="Trip Agent administrator preview"
                                />
                            </SettingsRow>
                            <SettingsRow
                                label="Planner beta"
                                description="Anyone can enter the beta without an invite."
                            >
                                <Switch
                                    checked={draft.plannerBetaOpen}
                                    onCheckedChange={(plannerBetaOpen) => update({ plannerBetaOpen })}
                                    aria-label="Planner beta"
                                />
                            </SettingsRow>
                        </SettingsSection>

                        <SettingsSection
                            icon={<Sparkle weight="duotone" />}
                            title="AI model"
                            description="The planner and the Trip Agent both follow this. A model off the approved list is never used."
                        >
                            <SettingsRow label="Default model" layout="stacked">
                                <AiModelPicker
                                    value={draft.defaultModelId}
                                    models={catalogModels}
                                    onChange={(defaultModelId) => update({ defaultModelId })}
                                />
                            </SettingsRow>
                            <SettingsRow label="Approved OpenRouter models" layout="stacked">
                                <ApprovedOpenRouterModelsField
                                    value={draft.approvedOpenRouterModels}
                                    models={catalogModels}
                                    onChange={(approvedOpenRouterModels) => update({ approvedOpenRouterModels })}
                                />
                            </SettingsRow>
                            <SettingsRow
                                label="Age limit"
                                description="Hide models released more than this many months ago."
                                htmlFor={MODEL_AGE_INPUT_ID}
                            >
                                <NumberInput
                                    id={MODEL_AGE_INPUT_ID}
                                    min={1}
                                    max={36}
                                    value={draft.modelMaxAgeMonths}
                                    suffix=" months"
                                    className="w-36"
                                    onChange={(event) => update({
                                        modelMaxAgeMonths: Math.max(1, Math.min(36, Math.round(Number(event.target.value) || 1))),
                                    })}
                                />
                            </SettingsRow>
                            <SettingsRow
                                label="Show older models"
                                description="List models past the age limit in the pickers anyway."
                            >
                                <Switch
                                    checked={draft.showOlderModels}
                                    onCheckedChange={(showOlderModels) => update({ showOlderModels })}
                                    aria-label="Show older models"
                                />
                            </SettingsRow>
                        </SettingsSection>

                        <SettingsSection
                            icon={<MapTrifold weight="duotone" />}
                            title="Map"
                            description="Which stack renders the map, and the style a visitor starts on."
                        >
                            <SettingsRow label="Provider" note={activeMapPresetNote}>
                                <Select
                                    value={draft.mapRuntimePreset}
                                    onValueChange={(value) => update({ mapRuntimePreset: value as MapRuntimePreset })}
                                >
                                    <SelectTrigger className="w-full sm:w-72">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MAP_RUNTIME_PRESETS.map((preset) => (
                                            <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsRow>
                            <SettingsRow
                                label="Default style"
                                description="Anyone who picks a style themselves keeps their choice."
                            >
                                <Select
                                    value={draft.mapDefaultStyle}
                                    onValueChange={(value) => update({ mapDefaultStyle: value as MapStyle })}
                                >
                                    <SelectTrigger className="w-full sm:w-72">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MAP_STYLE_OPTIONS.map((style) => (
                                            <SelectItem key={style} value={style}>{MAP_STYLE_LABELS[style]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsRow>
                        </SettingsSection>
                    </SettingsPanel>
                )}

                {settings?.updatedAt && (
                    <p className="mt-3 text-xs text-slate-500">
                        Last changed {new Date(settings.updatedAt).toLocaleString()}.
                    </p>
                )}
            </div>
        </AdminShell>
    );
};
