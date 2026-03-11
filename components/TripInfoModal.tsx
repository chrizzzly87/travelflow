import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Bug,
    ExternalLink,
    FileDown,
    Globe2,
    History,
    Info,
    MapPinned,
    Pencil,
    ShieldAlert,
    Sparkles,
    Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AI_MODEL_CATALOG, getDefaultCreateTripModel } from '../config/aiModelCatalog';
import { getAiProviderMetadata } from '../config/aiProviderCatalog';
import { ICountryInfo, ITripAiMeta, TripGenerationAttemptSummary, TripGenerationState } from '../types';
import { getAnalyticsDebugAttributes } from '../services/analyticsService';
import { normalizeTripGenerationAttemptsForDisplay } from '../services/tripGenerationDiagnosticsService';
import { AiProviderLogo } from './admin/AiProviderLogo';
import { CountryInfo } from './CountryInfo';
import { type TripHistoryModalItem } from './TripHistoryModal';
import { AppModal } from './ui/app-modal';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
}

interface TripForkMeta {
    label: string;
    url?: string | null;
}

interface TripInfoAdminMeta {
    ownerUserId?: string | null;
    ownerUsername?: string | null;
    ownerEmail?: string | null;
    accessSource?: string | null;
}

interface TripTravelerWarning {
    cityName: string;
    notes: string[];
}

const EMPTY_TRAVELER_WARNINGS: TripTravelerWarning[] = [];
const FUTURE_DESTINATION_CHECK_KEYS = [
    'tripView.infoDialog.destination.futureChecks.visa',
    'tripView.infoDialog.destination.futureChecks.entryRules',
    'tripView.infoDialog.destination.futureChecks.safety',
    'tripView.infoDialog.destination.futureChecks.customs',
    'tripView.infoDialog.destination.futureChecks.connectivity',
    'tripView.infoDialog.destination.futureChecks.health',
] as const;

type TripInfoTabValue = 'general' | 'history' | 'export' | 'destination' | 'debug';

export interface TripInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    tripTitle: string;
    isEditingTitle: boolean;
    editTitleValue: string;
    onEditTitleValueChange: (value: string) => void;
    onCommitTitleEdit: () => void;
    onStartTitleEdit: () => void;
    canManageTripMetadata: boolean;
    canEdit: boolean;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    isExamplePreview: boolean;
    tripMeta: TripMetaSummary;
    aiMeta?: ITripAiMeta | null;
    generationState?: TripGenerationState | null;
    latestGenerationAttempt?: TripGenerationAttemptSummary | null;
    canRetryGeneration?: boolean;
    retryDisabledReason?: string | null;
    isRetryingGeneration?: boolean;
    onRetryGeneration?: (modelId?: string | null) => void;
    retryModelId?: string | null;
    onRetryModelIdChange?: (modelId: string) => void;
    canOpenBenchmarkWithSnapshot?: boolean;
    onOpenBenchmarkWithSnapshot?: () => void;
    retryAnalyticsAttributes?: Record<string, string>;
    forkMeta?: TripForkMeta | null;
    showAllHistory: boolean;
    onToggleShowAllHistory: () => void;
    onHistoryUndo: () => void;
    onHistoryRedo: () => void;
    historyItems: TripHistoryModalItem[];
    onGoToHistoryEntry: (item: TripHistoryModalItem) => void;
    formatHistoryTime: (timestamp: number) => string;
    pendingSyncCount: number;
    failedSyncCount: number;
    countryInfo?: Partial<ICountryInfo> | ICountryInfo;
    isPaywallLocked: boolean;
    ownerSummary?: string | null;
    ownerHint?: string | null;
    adminMeta?: TripInfoAdminMeta | null;
    travelerWarnings?: TripTravelerWarning[];
    onExportActivitiesCalendar?: () => void;
    onExportCitiesCalendar?: () => void;
    onExportAllCalendar?: () => void;
    onOpenPrintLayout?: () => void;
}

interface SummaryCardProps {
    label: string;
    value: React.ReactNode;
    wide?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, wide = false }) => (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${wide ? 'sm:col-span-2' : ''}`}>
        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm font-semibold leading-6 text-slate-900">{value}</dd>
    </div>
);

interface ActionCardProps {
    title: string;
    description: string;
    actionLabel: string;
    onAction?: () => void;
    actionAttributes?: Record<string, string>;
}

const ActionCard: React.FC<ActionCardProps> = ({
    title,
    description,
    actionLabel,
    onAction,
    actionAttributes,
}) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <button
            type="button"
            onClick={onAction}
            disabled={!onAction}
            className={`mt-4 inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                onAction
                    ? 'border-accent-200 bg-accent-50 text-accent-800 hover:border-accent-300 hover:bg-accent-100'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
            {...(actionAttributes || {})}
        >
            {actionLabel}
        </button>
    </div>
);

export const TripInfoModal: React.FC<TripInfoModalProps> = ({
    isOpen,
    onClose,
    tripTitle,
    isEditingTitle,
    editTitleValue,
    onEditTitleValueChange,
    onCommitTitleEdit,
    onStartTitleEdit,
    canManageTripMetadata,
    canEdit,
    isFavorite,
    onToggleFavorite,
    isExamplePreview,
    tripMeta,
    aiMeta,
    generationState = null,
    latestGenerationAttempt = null,
    canRetryGeneration = false,
    retryDisabledReason = null,
    isRetryingGeneration = false,
    onRetryGeneration,
    retryModelId = null,
    onRetryModelIdChange,
    canOpenBenchmarkWithSnapshot = false,
    onOpenBenchmarkWithSnapshot,
    retryAnalyticsAttributes,
    forkMeta,
    showAllHistory,
    onToggleShowAllHistory,
    onHistoryUndo,
    onHistoryRedo,
    historyItems,
    onGoToHistoryEntry,
    formatHistoryTime,
    pendingSyncCount,
    failedSyncCount,
    countryInfo,
    isPaywallLocked,
    ownerSummary,
    ownerHint,
    adminMeta,
    travelerWarnings = EMPTY_TRAVELER_WARNINGS,
    onExportActivitiesCalendar,
    onExportCitiesCalendar,
    onExportAllCalendar,
    onOpenPrintLayout,
}) => {
    const { t } = useTranslation('common');
    const editTitleInputRef = useRef<HTMLInputElement | null>(null);
    const defaultRetryModelId = getDefaultCreateTripModel().id;
    const [activeTab, setActiveTab] = useState<TripInfoTabValue>('general');

    useEffect(() => {
        if (!isOpen) {
            setActiveTab('general');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !isEditingTitle || typeof window === 'undefined') return;
        const rafId = window.requestAnimationFrame(() => {
            editTitleInputRef.current?.focus();
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [isEditingTitle, isOpen]);

    const resolvedGenerationState = generationState || aiMeta?.generation?.state || null;
    const attempts = Array.isArray(aiMeta?.generation?.attempts)
        ? aiMeta?.generation?.attempts
        : (latestGenerationAttempt ? [latestGenerationAttempt] : []);
    const latestAttemptFromMeta = latestGenerationAttempt || aiMeta?.generation?.latestAttempt || null;
    const recentAttempts = normalizeTripGenerationAttemptsForDisplay(attempts, { limit: 6 });
    const latestAttempt = recentAttempts[0] || latestAttemptFromMeta;
    const visibleHistoryItems = showAllHistory ? historyItems : historyItems.slice(0, 8);

    const generationPill = (() => {
        if (resolvedGenerationState === 'failed') {
            return {
                label: t('tripView.generation.tripInfo.state.failed').toLowerCase(),
                className: 'border-rose-200 bg-rose-50 text-rose-700',
            };
        }
        if (resolvedGenerationState === 'running' || resolvedGenerationState === 'queued') {
            return {
                label: resolvedGenerationState === 'queued'
                    ? t('tripView.generation.tripInfo.state.queued').toLowerCase()
                    : t('tripView.generation.tripInfo.state.running').toLowerCase(),
                className: 'border-amber-200 bg-amber-50 text-amber-700',
            };
        }
        if (resolvedGenerationState === 'succeeded') {
            return {
                label: t('tripView.generation.tripInfo.state.succeeded').toLowerCase(),
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            };
        }
        return null;
    })();

    const activeRetryModelOptions = AI_MODEL_CATALOG
        .filter((entry) => entry.availability === 'active')
        .map((entry) => ({
            id: entry.id,
            provider: entry.provider,
            providerLabel: getAiProviderMetadata(entry.provider).label,
            model: entry.model,
        }));
    const groupedRetryModelOptions = Array.from(
        activeRetryModelOptions.reduce((map, option) => {
            const bucket = map.get(option.providerLabel) || [];
            bucket.push(option);
            map.set(option.providerLabel, bucket);
            return map;
        }, new Map<string, typeof activeRetryModelOptions>())
    ).map(([providerLabel, options]) => ({
        providerLabel,
        options,
    }));
    const selectedRetryModelId = retryModelId || defaultRetryModelId;
    const selectedRetryModelOption = activeRetryModelOptions.find((option) => option.id === selectedRetryModelId) || null;
    const latestAttemptMetadata = (
        latestAttempt?.metadata
        && typeof latestAttempt.metadata === 'object'
        && !Array.isArray(latestAttempt.metadata)
    ) ? latestAttempt.metadata as Record<string, unknown> : null;
    const latestAttemptOrchestration = (
        latestAttemptMetadata && typeof latestAttemptMetadata.orchestration === 'string'
    ) ? latestAttemptMetadata.orchestration : null;
    const requestPayload = (
        latestAttemptMetadata
        && latestAttemptMetadata.requestPayload
        && typeof latestAttemptMetadata.requestPayload === 'object'
    ) ? latestAttemptMetadata.requestPayload as Record<string, unknown> : null;
    const inputSnapshot = aiMeta?.generation?.inputSnapshot || null;
    const resolvedRetryDisabledReason = retryDisabledReason || (
        isRetryingGeneration
            ? t('tripView.infoDialog.general.retryInProgress')
            : !aiMeta?.generation?.inputSnapshot
                ? t('tripView.generation.retry.missingSnapshot')
                : !canRetryGeneration
                    ? t('tripView.generation.strip.running')
                    : null
    );

    const hasUnsyncedChanges = pendingSyncCount > 0;
    const pendingSyncLabel = pendingSyncCount === 1
        ? t('tripView.infoDialog.history.pendingSyncOne')
        : t('tripView.infoDialog.history.pendingSyncMany', { count: pendingSyncCount });
    const failedSyncLabel = failedSyncCount === 1
        ? t('tripView.infoDialog.history.failedSyncOne')
        : t('tripView.infoDialog.history.failedSyncMany', { count: failedSyncCount });

    const formatDurationMs = (value: number | null | undefined): string => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
        if (value < 1000) return `${Math.round(value)} ms`;
        if (value < 60_000) return `${(value / 1000).toFixed(1)} s`;
        return `${(value / 60_000).toFixed(1)} min`;
    };

    const titleFieldValue = isEditingTitle ? editTitleValue : tripTitle;
    const destinationFutureChecks = useMemo(
        () => FUTURE_DESTINATION_CHECK_KEYS.map((key) => t(key)),
        [t]
    );

    const handleTitleFieldFocus = () => {
        if (!canManageTripMetadata || isEditingTitle) return;
        onStartTitleEdit();
    };

    const handleTitleFieldChange = (value: string) => {
        if (!canManageTripMetadata) return;
        if (!isEditingTitle) onStartTitleEdit();
        onEditTitleValueChange(value);
    };

    const canShowDebugTab = Boolean(adminMeta);
    const tabClassName = 'rounded-full px-4 py-2 text-sm font-semibold';

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('tripView.infoDialog.title')}
            description={t('tripView.infoDialog.description')}
            closeLabel={t('tripView.infoDialog.close')}
            size="xl"
            mobileSheet={false}
            contentClassName="max-h-[88vh] sm:max-w-5xl"
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        >
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TripInfoTabValue)} className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-slate-100 px-4 py-3">
                    <TabsList variant="line" className="flex w-full flex-wrap items-center justify-start gap-2 rounded-none p-0">
                        <TabsTrigger value="general" className={tabClassName}>
                            <Info size={15} />
                            <span>{t('tripView.infoDialog.tabs.general')}</span>
                        </TabsTrigger>
                        <TabsTrigger value="history" className={tabClassName}>
                            <History size={15} />
                            <span>{t('tripView.infoDialog.tabs.history')}</span>
                        </TabsTrigger>
                        <TabsTrigger value="export" className={tabClassName}>
                            <FileDown size={15} />
                            <span>{t('tripView.infoDialog.tabs.export')}</span>
                        </TabsTrigger>
                        <TabsTrigger value="destination" className={tabClassName}>
                            <Globe2 size={15} />
                            <span>{t('tripView.infoDialog.tabs.destination')}</span>
                        </TabsTrigger>
                        {canShowDebugTab && (
                            <TabsTrigger value="debug" className={tabClassName}>
                                <Bug size={15} />
                                <span>{t('tripView.infoDialog.tabs.debug')}</span>
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <TabsContent value="general" className="space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                        {t('tripView.infoDialog.general.titleLabel')}
                                    </label>
                                    {canManageTripMetadata ? (
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <input
                                                ref={editTitleInputRef}
                                                value={titleFieldValue}
                                                onFocus={handleTitleFieldFocus}
                                                onChange={(event) => handleTitleFieldChange(event.target.value)}
                                                onBlur={onCommitTitleEdit}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        onCommitTitleEdit();
                                                    }
                                                }}
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 shadow-sm outline-none transition-colors focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
                                                aria-label={t('tripView.infoDialog.general.titleLabel')}
                                            />
                                            <button
                                                type="button"
                                                onClick={onToggleFavorite}
                                                disabled={!canEdit}
                                                className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold shadow-sm transition-colors ${
                                                    canEdit
                                                        ? isFavorite
                                                            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                                }`}
                                                aria-label={isFavorite
                                                    ? t('tripView.infoDialog.general.favoriteRemove')
                                                    : t('tripView.infoDialog.general.favoriteAdd')}
                                            >
                                                <Star size={16} className={isFavorite ? 'fill-current' : ''} />
                                                <span>{t(isFavorite ? 'tripView.infoDialog.general.favoriteOn' : 'tripView.infoDialog.general.favoriteOff')}</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-bold text-slate-900">
                                            {tripTitle}
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-2xl border border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-900 lg:max-w-sm">
                                    <div className="flex items-start gap-2">
                                        {canManageTripMetadata ? <Pencil size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
                                        <p className="leading-6">
                                            {canManageTripMetadata
                                                ? t('tripView.infoDialog.general.editHint')
                                                : isExamplePreview
                                                    ? t('tripView.infoDialog.general.readOnlyHintExample')
                                                    : t('tripView.infoDialog.general.readOnlyHintShared')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <h3 className="text-base font-semibold text-slate-900">{t('tripView.infoDialog.general.sections.meta')}</h3>
                                {generationPill && (
                                    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${generationPill.className}`}>
                                        {generationPill.label}
                                    </span>
                                )}
                            </div>
                            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <SummaryCard label={t('tripView.infoDialog.general.meta.duration')} value={tripMeta.dateRange} />
                                <SummaryCard
                                    label={t('tripView.infoDialog.general.meta.totalDays')}
                                    value={t('tripView.infoDialog.general.meta.totalDaysValue', { count: tripMeta.totalDaysLabel })}
                                />
                                <SummaryCard label={t('tripView.infoDialog.general.meta.cities')} value={tripMeta.cityCount} />
                                <SummaryCard label={t('tripView.infoDialog.general.meta.totalDistance')} value={tripMeta.distanceLabel || '—'} />
                                {ownerSummary && (
                                    <SummaryCard label={t('tripView.infoDialog.general.meta.owner')} value={ownerSummary} wide />
                                )}
                                {ownerHint && (
                                    <SummaryCard label={t('tripView.infoDialog.general.meta.access')} value={ownerHint} wide />
                                )}
                            </dl>
                        </section>

                        {(aiMeta || generationPill || latestAttempt || recentAttempts.length > 0) && (
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center gap-2">
                                    <Sparkles size={16} className="text-accent-600" />
                                    <h3 className="text-base font-semibold text-slate-900">{t('tripView.generation.tripInfo.title')}</h3>
                                </div>
                                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <SummaryCard label={t('tripView.generation.tripInfo.provider')} value={latestAttempt?.provider || aiMeta?.provider || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.model')} value={latestAttempt?.model || aiMeta?.model || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.orchestration')} value={latestAttemptOrchestration || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.runTime')} value={formatDurationMs(latestAttempt?.durationMs)} />
                                </dl>
                                {recentAttempts.length > 1 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                            {t('tripView.generation.tripInfo.recentAttempts')}
                                        </p>
                                        <ul className="space-y-2">
                                            {recentAttempts.map((attempt) => (
                                                <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                                    <span className="font-semibold text-slate-900">{attempt.state}</span>
                                                    <span>{attempt.model || t('tripView.generation.tripInfo.modelFallback')}</span>
                                                    <span>{formatDurationMs(attempt.durationMs)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {onRetryGeneration && aiMeta?.generation && (
                                    <div className="mt-4 flex flex-col gap-3">
                                        {activeRetryModelOptions.length > 0 && onRetryModelIdChange && (
                                            <div className="max-w-md">
                                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                                    {t('tripView.generation.tripInfo.model')}
                                                </p>
                                                <Select value={selectedRetryModelId} onValueChange={onRetryModelIdChange}>
                                                    <SelectTrigger className="h-11 text-sm">
                                                        <SelectValue placeholder={t('tripView.generation.tripInfo.modelFallback')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {groupedRetryModelOptions.map((group) => (
                                                            <SelectGroup key={`trip-info-model-group-${group.providerLabel}`}>
                                                                <SelectLabel>{group.providerLabel}</SelectLabel>
                                                                {group.options.map((option) => (
                                                                    <SelectItem key={option.id} value={option.id}>
                                                                        <span className="inline-flex items-center gap-2">
                                                                            <AiProviderLogo provider={option.provider} model={option.model} size={14} />
                                                                            <span>{option.model}</span>
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectGroup>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {selectedRetryModelOption && (
                                                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-[11px] font-semibold text-accent-800">
                                                        <AiProviderLogo provider={selectedRetryModelOption.provider} model={selectedRetryModelOption.model} size={12} />
                                                        <span>{selectedRetryModelOption.providerLabel} · {selectedRetryModelOption.model}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            <span title={resolvedRetryDisabledReason || t('tripView.generation.tripInfo.retry')}>
                                                <button
                                                    type="button"
                                                    onClick={() => onRetryGeneration(selectedRetryModelId)}
                                                    disabled={isRetryingGeneration || !canRetryGeneration}
                                                    className="inline-flex h-11 items-center rounded-xl border border-accent-200 bg-accent-50 px-4 text-sm font-semibold text-accent-800 transition-colors hover:border-accent-300 hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    {...(retryAnalyticsAttributes || {})}
                                                >
                                                    {isRetryingGeneration
                                                        ? t('tripView.generation.tripInfo.retrying')
                                                        : t('tripView.generation.tripInfo.retry')}
                                                </button>
                                            </span>
                                            {canOpenBenchmarkWithSnapshot && onOpenBenchmarkWithSnapshot && (
                                                <button
                                                    type="button"
                                                    onClick={onOpenBenchmarkWithSnapshot}
                                                    className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                                >
                                                    {t('tripView.infoDialog.general.openBenchmark')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {forkMeta && (
                            <section className="rounded-2xl border border-accent-100 bg-gradient-to-br from-accent-50 via-white to-white p-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <MapPinned size={16} className="text-accent-700" />
                                    <h3 className="text-base font-semibold text-slate-900">{t('tripView.infoDialog.general.sections.source')}</h3>
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-900">{forkMeta.label}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {forkMeta.url
                                        ? t('tripView.infoDialog.general.sourceSharedDescription')
                                        : t('tripView.infoDialog.general.sourceTripDescription')}
                                </p>
                                {forkMeta.url && (
                                    <a
                                        href={forkMeta.url}
                                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent-700 hover:text-accent-800 hover:underline"
                                    >
                                        <ExternalLink size={14} />
                                        <span>{t('tripView.infoDialog.general.viewSource')}</span>
                                    </a>
                                )}
                            </section>
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4">
                        {isExamplePreview ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                                {t('tripView.infoDialog.history.example')}
                            </div>
                        ) : (
                            <>
                                <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={onHistoryUndo}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                    >
                                        {t('tripView.infoDialog.history.undo')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onHistoryRedo}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                    >
                                        {t('tripView.infoDialog.history.redo')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onToggleShowAllHistory}
                                        className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                    >
                                        {t(showAllHistory ? 'tripView.infoDialog.history.showRecent' : 'tripView.infoDialog.history.showAll')}
                                    </button>
                                </section>

                                {hasUnsyncedChanges && (
                                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                                        {failedSyncCount > 0 ? failedSyncLabel : pendingSyncLabel}
                                    </section>
                                )}

                                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    {visibleHistoryItems.length === 0 ? (
                                        <div className="p-6 text-sm text-slate-500">{t('tripView.infoDialog.history.empty')}</div>
                                    ) : (
                                        <ul className="divide-y divide-slate-100">
                                            {visibleHistoryItems.map((item, index) => {
                                                const Icon = item.meta.Icon;
                                                const showUnsyncedBadge = hasUnsyncedChanges && index === 0;
                                                return (
                                                    <li key={item.id} className={`flex items-start gap-3 p-4 ${item.isCurrent ? 'bg-accent-50/60' : 'bg-white'}`}>
                                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.meta.iconClass}`}>
                                                            <Icon size={16} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.meta.badgeClass}`}>
                                                                    {item.meta.label}
                                                                </span>
                                                                <span className="text-xs text-slate-500">{formatHistoryTime(item.ts)}</span>
                                                                {item.isCurrent && (
                                                                    <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
                                                                        {t('tripView.infoDialog.history.current')}
                                                                    </span>
                                                                )}
                                                                {showUnsyncedBadge && (
                                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                                                        {t('tripView.infoDialog.history.notSynced')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{item.details}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => onGoToHistoryEntry(item)}
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                                        >
                                                            {t('tripView.infoDialog.history.go')}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="export" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <ActionCard
                                title={t('tripView.infoDialog.export.activities.title')}
                                description={t('tripView.infoDialog.export.activities.description')}
                                actionLabel={t('tripView.infoDialog.export.activities.action')}
                                onAction={onExportActivitiesCalendar}
                                actionAttributes={getAnalyticsDebugAttributes('trip_view__calendar_export--activities', { source: 'trip_info_modal' })}
                            />
                            <ActionCard
                                title={t('tripView.infoDialog.export.cities.title')}
                                description={t('tripView.infoDialog.export.cities.description')}
                                actionLabel={t('tripView.infoDialog.export.cities.action')}
                                onAction={onExportCitiesCalendar}
                                actionAttributes={getAnalyticsDebugAttributes('trip_view__calendar_export--cities', { source: 'trip_info_modal' })}
                            />
                            <ActionCard
                                title={t('tripView.infoDialog.export.everything.title')}
                                description={t('tripView.infoDialog.export.everything.description')}
                                actionLabel={t('tripView.infoDialog.export.everything.action')}
                                onAction={onExportAllCalendar}
                                actionAttributes={getAnalyticsDebugAttributes('trip_view__calendar_export--all', { source: 'trip_info_modal' })}
                            />
                            <ActionCard
                                title={t('tripView.infoDialog.export.print.title')}
                                description={t('tripView.infoDialog.export.print.description')}
                                actionLabel={t('tripView.infoDialog.export.print.action')}
                                onAction={onOpenPrintLayout}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="destination" className="space-y-4">
                        {travelerWarnings.length > 0 && (
                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-amber-700" />
                                    <h3 className="text-base font-semibold text-amber-950">{t('tripView.warningSummary.title')}</h3>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-amber-900">
                                    {t('tripView.warningSummary.description')}
                                </p>
                                <div className="mt-4 space-y-3">
                                    {travelerWarnings.map((warning) => (
                                        <div key={`${warning.cityName}-${warning.notes.join('|')}`} className="rounded-2xl border border-amber-200 bg-white p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                                                {warning.cityName}
                                            </p>
                                            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                                                {warning.notes.map((note) => (
                                                    <li key={`${warning.cityName}-${note}`} className="flex items-start gap-2">
                                                        <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                                        <span>{note}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            {countryInfo ? (
                                <CountryInfo info={countryInfo} />
                            ) : isPaywallLocked ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                                    {t('tripView.infoDialog.destination.locked')}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                                    {t('tripView.infoDialog.destination.empty')}
                                </div>
                            )}
                        </section>

                        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-slate-600" />
                                <h3 className="text-base font-semibold text-slate-900">{t('tripView.infoDialog.destination.futureChecksTitle')}</h3>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                {t('tripView.infoDialog.destination.futureChecksDescription')}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {destinationFutureChecks.map((label) => (
                                    <span key={label} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </TabsContent>

                    {canShowDebugTab && (
                        <TabsContent value="debug" className="space-y-4">
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Admin access</h3>
                                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <SummaryCard label="Owner username" value={adminMeta?.ownerUsername || 'n/a'} />
                                    <SummaryCard label="Owner email" value={adminMeta?.ownerEmail || 'n/a'} />
                                    <SummaryCard label="Owner user id" value={<span className="font-mono text-[12px]">{adminMeta?.ownerUserId || 'n/a'}</span>} />
                                    <SummaryCard label="Access source" value={adminMeta?.accessSource || 'n/a'} />
                                </dl>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">AI generation diagnostics</h3>
                                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <SummaryCard label={t('tripView.generation.tripInfo.provider')} value={latestAttempt?.provider || aiMeta?.provider || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.model')} value={latestAttempt?.model || aiMeta?.model || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.providerModel')} value={latestAttempt?.providerModel || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.requestId')} value={<span className="font-mono text-[12px] break-all">{latestAttempt?.requestId || '—'}</span>} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.httpStatus')} value={latestAttempt?.statusCode ?? '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.runTime')} value={formatDurationMs(latestAttempt?.durationMs)} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.started')} value={latestAttempt?.startedAt ? new Date(latestAttempt.startedAt).toLocaleString() : '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.finished')} value={latestAttempt?.finishedAt ? new Date(latestAttempt.finishedAt).toLocaleString() : '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.failureKind')} value={latestAttempt?.failureKind || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.errorCode')} value={latestAttempt?.errorCode || '—'} />
                                    <SummaryCard label={t('tripView.generation.tripInfo.errorMessage')} value={latestAttempt?.errorMessage || '—'} wide />
                                </dl>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Raw payloads</h3>
                                <div className="mt-4 space-y-4">
                                    {requestPayload && (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Request payload JSON</p>
                                            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-100">
                                                {JSON.stringify(requestPayload, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    {inputSnapshot && (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Input snapshot JSON</p>
                                            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-100">
                                                {JSON.stringify(inputSnapshot, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    {!requestPayload && !inputSnapshot && (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                            No raw request payloads were captured for this trip.
                                        </div>
                                    )}
                                </div>
                            </section>
                        </TabsContent>
                    )}
                </div>
            </Tabs>
        </AppModal>
    );
};
