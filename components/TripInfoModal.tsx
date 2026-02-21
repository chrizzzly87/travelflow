import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Pencil, Star } from 'lucide-react';
import { ICountryInfo } from '../types';
import { CountryInfo } from './CountryInfo';
import { AppModal } from './ui/app-modal';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
}

interface TripAiMeta {
    provider: string;
    model: string;
    generatedAt?: string;
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
    aiMeta?: TripAiMeta | null;
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
}) => {
    const editTitleInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!isOpen || !isEditingTitle || typeof window === 'undefined') return;
        const rafId = window.requestAnimationFrame(() => {
            editTitleInputRef.current?.focus();
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [isEditingTitle, isOpen]);

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
                </dl>
            </section>

            {aiMeta && (
                <section className="rounded-xl border border-gray-200 p-3">
                    <h4 className="mb-2 text-sm font-semibold text-gray-800">AI generation</h4>
                    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">Provider</dt>
                            <dd className="mt-1 font-semibold text-gray-900">{aiMeta.provider}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <dt className="text-gray-500">Model</dt>
                            <dd className="mt-1 break-all font-semibold text-gray-900">{aiMeta.model}</dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 sm:col-span-2">
                            <dt className="text-gray-500">Generated at</dt>
                            <dd className="mt-1 font-semibold text-gray-900">
                                {aiMeta.generatedAt ? new Date(aiMeta.generatedAt).toLocaleString() : '—'}
                            </dd>
                        </div>
                    </dl>
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
