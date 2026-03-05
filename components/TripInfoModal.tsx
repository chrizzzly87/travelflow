import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Pencil, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ICountryInfo, ITripAiMeta, TripGenerationAttemptSummary, TripGenerationState } from '../types';
import { AI_MODEL_CATALOG, getDefaultCreateTripModel } from '../config/aiModelCatalog';
import { getAiProviderMetadata } from '../config/aiProviderCatalog';
import { CountryInfo } from './CountryInfo';
import { AppModal } from './ui/app-modal';
import { getAnalyticsDebugAttributes } from '../services/analyticsService';
import { normalizeTripGenerationAttemptsForDisplay } from '../services/tripGenerationDiagnosticsService';
import { AiProviderLogo } from './admin/AiProviderLogo';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from './ui/select';

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

interface TripInfoHistoryItem {
    id: string;
    url: string;
    ts: number;
    details: string;
    isCurrent: boolean;
}

interface TripInfoAdminMeta {
    ownerUserId?: string | null;
    ownerUsername?: string | null;
    ownerEmail?: string | null;
    accessSource?: string | null;
}

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
    isRetryingGeneration?: boolean;
    onRetryGeneration?: (modelId?: string | null) => void;
    retryModelId?: string | null;
    onRetryModelIdChange?: (modelId: string) => void;
    canOpenBenchmarkWithSnapshot?: boolean;
    onOpenBenchmarkWithSnapshot?: () => void;
    retryAnalyticsAttributes?: Record<string, string>;
    forkMeta?: TripForkMeta | null;
    isTripInfoHistoryExpanded: boolean;
    onToggleTripInfoHistoryExpanded: () => void;
    showAllHistory: boolean;
    onToggleShowAllHistory: () => void;
    onHistoryUndo: () => void;
    onHistoryRedo: () => void;
    infoHistoryItems: TripInfoHistoryItem[];
    onGoToHistoryEntry: (url: string) => void;
    onOpenFullHistory: () => void;
    formatHistoryTime: (timestamp: number) => string;
    countryInfo?: Partial<ICountryInfo> | ICountryInfo;
    isPaywallLocked: boolean;
    ownerSummary?: string | null;
    ownerHint?: string | null;
    adminMeta?: TripInfoAdminMeta | null;
    onExportActivitiesCalendar?: () => void;
    onExportCitiesCalendar?: () => void;
    onExportAllCalendar?: () => void;
}

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
    isRetryingGeneration = false,
    onRetryGeneration,
    retryModelId = null,
    onRetryModelIdChange,
    canOpenBenchmarkWithSnapshot = false,
    onOpenBenchmarkWithSnapshot,
    retryAnalyticsAttributes,
    forkMeta,
    isTripInfoHistoryExpanded,
    onToggleTripInfoHistoryExpanded,
    showAllHistory,
    onToggleShowAllHistory,
    onHistoryUndo,
    onHistoryRedo,
    infoHistoryItems,
    onGoToHistoryEntry,
    onOpenFullHistory,
    formatHistoryTime,
    countryInfo,
    isPaywallLocked,
    ownerSummary,
    ownerHint,
    adminMeta,
    onExportActivitiesCalendar,
    onExportCitiesCalendar,
    onExportAllCalendar,
}) => {
    const { t } = useTranslation('common');
    const editTitleInputRef = useRef<HTMLInputElement | null>(null);
    const defaultRetryModelId = getDefaultCreateTripModel().id;

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
            label: `${getAiProviderMetadata(entry.provider).label} · ${entry.model}`,
        }));
    const groupedRetryModelOptions = Array.from(
        activeRetryModelOptions.reduce((map, option) => {
            const key = option.providerLabel;
            const bucket = map.get(key) || [];
            bucket.push(option);
            map.set(key, bucket);
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
    const retryDisabledReason = (
        isRetryingGeneration
            ? 'Retry is already in progress.'
            : !aiMeta?.generation?.inputSnapshot
                ? 'Retry is unavailable because no input snapshot was captured.'
                : !canRetryGeneration
                    ? 'Retry is unavailable while generation is still running.'
                    : null
    );

    const formatDurationMs = (value: number | null | undefined): string => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
        if (value < 1000) return `${Math.round(value)} ms`;
        if (value < 60_000) return `${(value / 1000).toFixed(1)} s`;
        return `${(value / 60_000).toFixed(1)} min`;
    };

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title="Trip information"
            description="Plan details, destination info, and history."
            closeLabel="Close trip information dialog"
            size="lg"
            mobileSheet={false}
            contentClassName="max-h-[84vh] sm:max-h-[88vh] sm:max-w-xl"
            bodyClassName="flex-1 space-y-4 overflow-y-auto p-4"
        >
            <section className="space-y-3 rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        {isEditingTitle ? (
                            <input
                                ref={editTitleInputRef}
                                value={editTitleValue}
                                onChange={(e) => onEditTitleValueChange(e.target.value)}
                                onBlur={onCommitTitleEdit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onCommitTitleEdit();
                                }}
                                className="w-full border-b-2 border-accent-500 bg-transparent pb-0.5 text-lg font-bold text-gray-900 outline-none"
                            />
                        ) : (
                            <h4 className="break-words text-lg font-bold text-gray-900">{tripTitle}</h4>
                        )}
                    </div>
                    {canManageTripMetadata && (
                        <div className="shrink-0 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onStartTitleEdit}
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                                aria-label="Edit title"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={onToggleFavorite}
                                disabled={!canEdit}
                                className={`rounded-lg p-2 transition-colors ${canEdit ? 'hover:bg-amber-50' : 'cursor-not-allowed opacity-50'}`}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <Star size={16} className={isFavorite ? 'fill-amber-400 text-amber-500' : 'text-gray-300 hover:text-amber-500'} />
                            </button>
                        </div>
                    )}
                </div>
                {!canManageTripMetadata && (
                    <p className="text-xs text-gray-500">
                        {isExamplePreview
                            ? 'Example trips cannot be renamed or favorited. Copy this trip first to make it your own.'
                            : 'Edit and favorite actions are unavailable for shared trips.'}
                    </p>
                )}
            </section>

            {adminMeta && (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <h4 className="mb-2 text-sm font-semibold text-slate-800">Admin debug</h4>
                    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <dt className="text-slate-500">Owner username</dt>
                            <dd className="mt-1 break-all font-semibold text-slate-900">{adminMeta.ownerUsername || 'n/a'}</dd>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <dt className="text-slate-500">Owner email</dt>
                            <dd className="mt-1 break-all font-semibold text-slate-900">{adminMeta.ownerEmail || 'n/a'}</dd>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <dt className="text-slate-500">Owner user id</dt>
                            <dd className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-900">{adminMeta.ownerUserId || 'n/a'}</dd>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <dt className="text-slate-500">Access source</dt>
                            <dd className="mt-1 break-all font-semibold text-slate-900">{adminMeta.accessSource || 'n/a'}</dd>
                        </div>
                    </dl>
                </section>
            )}

            <section className="rounded-xl border border-gray-200 p-3">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Trip meta</h4>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                        <dt className="text-gray-500">Duration</dt>
                        <dd className="mt-1 font-semibold text-gray-900">{tripMeta.dateRange}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                        <dt className="text-gray-500">Total days</dt>
                        <dd className="mt-1 font-semibold text-gray-900">{tripMeta.totalDaysLabel} days</dd>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                        <dt className="text-gray-500">Cities</dt>
                        <dd className="mt-1 font-semibold text-gray-900">{tripMeta.cityCount}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                        <dt className="text-gray-500">Total distance</dt>
                        <dd className="mt-1 font-semibold text-gray-900">{tripMeta.distanceLabel || '—'}</dd>
                    </div>
                    {generationPill && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 col-span-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.title')}</dt>
                            <dd className="mt-1">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${generationPill.className}`}>
                                    {generationPill.label}
                                </span>
                            </dd>
                        </div>
                    )}
                    {ownerSummary && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 col-span-2">
                            <dt className="text-gray-500">Owner</dt>
                            <dd className="mt-1 break-all font-semibold text-gray-900">{ownerSummary}</dd>
                        </div>
                    )}
                </dl>
                {ownerHint && (
                    <p className="mt-2 text-[11px] text-gray-600">{ownerHint}</p>
                )}
            </section>

            <section className="rounded-xl border border-gray-200 p-3">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Calendar exports</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                        type="button"
                        onClick={onExportActivitiesCalendar}
                        disabled={!onExportActivitiesCalendar}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            onExportActivitiesCalendar
                                ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 hover:border-accent-300'
                                : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        {...getAnalyticsDebugAttributes('trip_view__calendar_export--activities', { source: 'trip_info_modal' })}
                    >
                        Export activities (.ics)
                    </button>
                    <button
                        type="button"
                        onClick={onExportCitiesCalendar}
                        disabled={!onExportCitiesCalendar}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            onExportCitiesCalendar
                                ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 hover:border-accent-300'
                                : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        {...getAnalyticsDebugAttributes('trip_view__calendar_export--cities', { source: 'trip_info_modal' })}
                    >
                        Export cities (.ics)
                    </button>
                    <button
                        type="button"
                        onClick={onExportAllCalendar}
                        disabled={!onExportAllCalendar}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            onExportAllCalendar
                                ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 hover:border-accent-300'
                                : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        {...getAnalyticsDebugAttributes('trip_view__calendar_export--all', { source: 'trip_info_modal' })}
                    >
                        Download everything (.ics)
                    </button>
                </div>
            </section>

            {(aiMeta || generationPill || latestAttempt || recentAttempts.length > 0) && (
                <section className="rounded-xl border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-800">{t('tripView.generation.tripInfo.title')}</h4>
                        {generationPill && (
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${generationPill.className}`}>
                                {generationPill.label}
                            </span>
                        )}
                    </div>
                    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.provider')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">{latestAttempt?.provider || aiMeta?.provider || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.model')}</dt>
                            <dd className="mt-1 break-all font-semibold text-gray-900">{latestAttempt?.model || aiMeta?.model || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.providerModel')}</dt>
                            <dd className="mt-1 break-all font-semibold text-gray-900">{latestAttempt?.providerModel || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.requestId')}</dt>
                            <dd className="mt-1 break-all font-mono text-[11px] font-semibold text-gray-900">{latestAttempt?.requestId || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.orchestration')}</dt>
                            <dd className="mt-1 break-all font-semibold text-gray-900">{latestAttemptOrchestration || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.runTime')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">{formatDurationMs(latestAttempt?.durationMs)}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.httpStatus')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">{latestAttempt?.statusCode ?? '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.started')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">
                                {latestAttempt?.startedAt ? new Date(latestAttempt.startedAt).toLocaleString() : '—'}
                            </dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.finished')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">
                                {latestAttempt?.finishedAt ? new Date(latestAttempt.finishedAt).toLocaleString() : '—'}
                            </dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.failureKind')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">{latestAttempt?.failureKind || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.errorCode')}</dt>
                            <dd className="mt-1 break-all font-semibold text-gray-900">{latestAttempt?.errorCode || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:col-span-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.errorMessage')}</dt>
                            <dd className="mt-1 break-words font-semibold text-gray-900">{latestAttempt?.errorMessage || '—'}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:col-span-2">
                            <dt className="text-gray-500">{t('tripView.generation.tripInfo.generatedAt')}</dt>
                            <dd className="mt-1 font-semibold text-gray-900">
                                {aiMeta?.generatedAt ? new Date(aiMeta.generatedAt).toLocaleString() : '—'}
                            </dd>
                        </div>
                    </dl>
                    {recentAttempts.length > 1 && (
                        <div className="mt-3 space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                {t('tripView.generation.tripInfo.recentAttempts')}
                            </p>
                            <ul className="space-y-1">
                                {recentAttempts.map((attempt) => (
                                    <li key={attempt.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-white px-2 py-1 text-[11px] text-gray-600">
                                        <span className="truncate font-semibold text-gray-800">{attempt.state}</span>
                                        <span className="truncate">{attempt.model || t('tripView.generation.tripInfo.modelFallback')}</span>
                                        <span className="shrink-0">{formatDurationMs(attempt.durationMs)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {onRetryGeneration && aiMeta?.generation && (
                        <div className="mt-3">
                            {activeRetryModelOptions.length > 0 && onRetryModelIdChange && (
                                <div className="mb-2 max-w-sm">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                        {t('tripView.generation.tripInfo.model')}
                                    </p>
                                    {selectedRetryModelOption && (
                                        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-800">
                                            <AiProviderLogo provider={selectedRetryModelOption.provider} model={selectedRetryModelOption.model} size={12} />
                                            <span>{selectedRetryModelOption.providerLabel} · {selectedRetryModelOption.model}</span>
                                            <span className="rounded-full border border-accent-300 bg-white px-1.5 text-[10px] uppercase tracking-wide text-accent-700">current</span>
                                        </div>
                                    )}
                                    <Select
                                        value={selectedRetryModelId}
                                        onValueChange={onRetryModelIdChange}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
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
                                                                <span className="font-medium text-slate-800">{option.model}</span>
                                                                {option.id === selectedRetryModelId && (
                                                                    <span className="rounded-full border border-accent-300 bg-accent-50 px-1.5 text-[10px] uppercase tracking-wide text-accent-700">
                                                                        current
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <span
                                className="inline-flex"
                                title={retryDisabledReason || t('tripView.generation.tripInfo.retry')}
                            >
                                <button
                                    type="button"
                                    onClick={() => onRetryGeneration(selectedRetryModelId)}
                                    disabled={isRetryingGeneration || !canRetryGeneration}
                                    className="inline-flex items-center rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                                    className="ml-2 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    Open in AI Benchmark
                                </button>
                            )}
                        </div>
                    )}
                    {(requestPayload || inputSnapshot) && (
                        <div className="mt-3 space-y-2">
                            {requestPayload && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Request payload JSON</p>
                                    <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-[10px] text-slate-100">
                                        {JSON.stringify(requestPayload, null, 2)}
                                    </pre>
                                </div>
                            )}
                            {inputSnapshot && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Input snapshot JSON</p>
                                    <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-[10px] text-slate-100">
                                        {JSON.stringify(inputSnapshot, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {forkMeta && (
                <section className="rounded-xl border border-accent-100 bg-gradient-to-br from-accent-50 to-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Trip source</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{forkMeta.label}</p>
                    <p className="mt-1 text-xs text-gray-600">
                        {forkMeta.url
                            ? 'This itinerary was copied from a shared trip snapshot.'
                            : 'This itinerary was copied from another trip in your workspace.'}
                    </p>
                    {forkMeta.url && (
                        <a href={forkMeta.url} className="mt-2 inline-flex text-xs font-semibold text-accent-700 hover:underline">
                            View source
                        </a>
                    )}
                </section>
            )}

            <section className="rounded-xl border border-gray-200 p-3">
                <button
                    type="button"
                    onClick={onToggleTripInfoHistoryExpanded}
                    className="flex w-full items-center justify-between text-sm font-semibold text-gray-800"
                >
                    <span>History</span>
                    {isTripInfoHistoryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isTripInfoHistoryExpanded && (
                    <div className="mt-3 space-y-3">
                        {isExamplePreview ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                Example trips do not save history snapshots. Copy this trip first to keep edits and track changes.
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={onHistoryUndo}
                                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                                    >
                                        Undo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onHistoryRedo}
                                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                                    >
                                        Redo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onToggleShowAllHistory}
                                        className="ml-auto rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                                    >
                                        {showAllHistory ? 'Show Recent' : 'Show All'}
                                    </button>
                                </div>
                                <div className="overflow-hidden rounded-lg border border-gray-100">
                                    {infoHistoryItems.length === 0 ? (
                                        <div className="p-4 text-xs text-gray-500">No history entries yet.</div>
                                    ) : (
                                        <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
                                            {infoHistoryItems.map((entry) => (
                                                <li key={entry.id} className={`flex items-start gap-2 p-3 ${entry.isCurrent ? 'bg-accent-50/70' : 'bg-white'}`}>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[11px] text-gray-500">{formatHistoryTime(entry.ts)}</div>
                                                        <div className="text-xs font-semibold leading-snug text-gray-900">{entry.details}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => onGoToHistoryEntry(entry.url)}
                                                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                                    >
                                                        Go
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={onOpenFullHistory}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Open full history
                                </button>
                            </>
                        )}
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-gray-200 p-3">
                {countryInfo ? (
                    <CountryInfo info={countryInfo} />
                ) : isPaywallLocked ? (
                    <div className="text-xs text-gray-500">Destination details are hidden until this trip is activated.</div>
                ) : (
                    <div className="text-xs text-gray-500">No destination info available for this trip yet.</div>
                )}
            </section>
        </AppModal>
    );
};
