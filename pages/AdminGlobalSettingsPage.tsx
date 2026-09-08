import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';

import { AdminShell } from '../components/admin/AdminShell';
import {
    MAP_STYLE_OPTIONS,
    refreshPublicAiRuntimeSettings,
    updateAppRuntimeSettings,
    type AiRuntimeSettings,
} from '../services/aiRuntimeSettingsService';
import type { MapStyle } from '../types';

const fieldClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100';

const MAP_STYLE_LABELS: Record<MapStyle, string> = {
    minimal: 'Minimal',
    standard: 'Standard (Mapbox)',
    dark: 'Dark',
    satellite: 'Satellite',
    clean: 'Clean',
    cleanDark: 'Clean dark',
};

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
    disabled?: boolean;
    onChange: (next: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
    <label className="flex cursor-pointer items-start gap-3">
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.currentTarget.checked)}
            className="mt-0.5 size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-400"
        />
        <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900">{label}</span>
            <span className="block text-xs text-slate-500">{hint}</span>
        </span>
    </label>
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
                <button
                    type="button"
                    onClick={() => { void save(); }}
                    disabled={!isDirty || status !== 'idle'}
                    className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {status === 'saving' ? 'Saving…' : 'Save changes'}
                </button>
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
                        <label className="block">
                            <span className="mb-1 block text-xs font-medium text-slate-600">Default model id</span>
                            <input
                                type="text"
                                value={draft.defaultModelId}
                                spellCheck={false}
                                onChange={(event) => update({ defaultModelId: event.currentTarget.value })}
                                placeholder="openrouter:google/gemini-3.8-flash"
                                className={fieldClassName}
                            />
                            <span className="mt-1 block text-xs text-slate-500">
                                Provider and model, separated by a colon.
                            </span>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-medium text-slate-600">
                                Approved OpenRouter models, one per line
                            </span>
                            <textarea
                                value={draft.approvedOpenRouterModels.join('\n')}
                                rows={6}
                                spellCheck={false}
                                onChange={(event) => update({
                                    approvedOpenRouterModels: event.currentTarget.value
                                        .split('\n')
                                        .map((line) => line.trim())
                                        .filter(Boolean),
                                })}
                                className={`${fieldClassName} font-mono text-xs`}
                            />
                        </label>
                        <div className="flex flex-wrap items-end gap-4">
                            <label className="block">
                                <span className="mb-1 block text-xs font-medium text-slate-600">Model age limit (months)</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={36}
                                    value={draft.modelMaxAgeMonths}
                                    onChange={(event) => update({
                                        modelMaxAgeMonths: Math.max(1, Math.min(36, Number(event.currentTarget.value) || 1)),
                                    })}
                                    className={`${fieldClassName} w-32`}
                                />
                            </label>
                            <Toggle
                                label="Show older models"
                                hint="List models past the age limit in the pickers."
                                checked={draft.showOlderModels}
                                onChange={(showOlderModels) => update({ showOlderModels })}
                            />
                        </div>
                    </Section>

                    <Section
                        title="Map"
                        description="Which Mapbox style a visitor starts on. Anyone who picks a style themselves keeps their choice."
                    >
                        <label className="block">
                            <span className="mb-1 block text-xs font-medium text-slate-600">Default map style</span>
                            <select
                                value={draft.mapDefaultStyle}
                                onChange={(event) => update({ mapDefaultStyle: event.currentTarget.value as MapStyle })}
                                className={fieldClassName}
                            >
                                {MAP_STYLE_OPTIONS.map((style) => (
                                    <option key={style} value={style}>{MAP_STYLE_LABELS[style]}</option>
                                ))}
                            </select>
                        </label>
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
