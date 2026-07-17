import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowCounterClockwise,
    CheckCircle,
    GitDiff,
    LinkSimple,
    MagnifyingGlass,
    PencilSimple,
    WarningCircle,
    XCircle,
} from '@phosphor-icons/react';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { TravelKnowledgeCatalog } from '../components/admin/TravelKnowledgeCatalog';
import { useAppDialog } from '../components/AppDialogProvider';
import { showAppToast } from '../components/ui/appToast';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    adminGetTravelKnowledgeReviewSummary,
    adminListTravelKnowledgeCandidates,
    adminReviewTravelKnowledgeCandidate,
    type AdminTravelKnowledgeCandidateRecord,
    type AdminTravelKnowledgeCandidateSeverity,
    type AdminTravelKnowledgeCandidateStatus,
    type AdminTravelKnowledgeReviewDecision,
    type AdminTravelKnowledgeReviewSummary,
} from '../services/adminService';
import {
    loadTravelDestinationPack,
    type TravelKnowledgeLoadSource,
} from '../services/travelKnowledgeService';
import type { TravelDestinationPack } from '../shared/travelKnowledge';

const REVIEW_FETCH_LIMIT = 250;
const OPEN_REVIEW_STATUSES: AdminTravelKnowledgeCandidateStatus[] = ['new', 'needs_review'];
const STATUS_VALUES: AdminTravelKnowledgeCandidateStatus[] = ['new', 'needs_review', 'accepted', 'rejected', 'superseded'];
const SEVERITY_VALUES: AdminTravelKnowledgeCandidateSeverity[] = ['critical', 'high', 'moderate', 'low'];

const STATUS_META: Record<AdminTravelKnowledgeCandidateStatus, { label: string; className: string }> = {
    new: { label: 'New', className: 'border-sky-200 bg-sky-50 text-sky-700' },
    needs_review: { label: 'Needs review', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    accepted: { label: 'Accepted', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Rejected', className: 'border-rose-200 bg-rose-50 text-rose-700' },
    superseded: { label: 'Superseded', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};

const SEVERITY_META: Record<AdminTravelKnowledgeCandidateSeverity, { label: string; className: string }> = {
    critical: { label: 'Critical', className: 'border-rose-300 bg-rose-100 text-rose-800' },
    high: { label: 'High', className: 'border-orange-200 bg-orange-50 text-orange-700' },
    moderate: { label: 'Moderate', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    low: { label: 'Low', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

const REVIEW_ACTION_META: Record<AdminTravelKnowledgeReviewDecision, { label: string; completedLabel: string }> = {
    accept: { label: 'Accept', completedLabel: 'accepted' },
    accept_with_edit: { label: 'Edit & accept', completedLabel: 'accepted with an edit' },
    reject: { label: 'Reject', completedLabel: 'rejected' },
    request_changes: { label: 'Request changes', completedLabel: 'returned for changes' },
};

const formatTimestamp = (value: string | null | undefined): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : '—';
};

const formatJson = (value: unknown): string => {
    if (value === undefined) return 'undefined';
    const formatted = JSON.stringify(value, null, 2);
    return formatted === undefined ? String(value) : formatted;
};

const humanizeToken = (value: string): string => (
    value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const candidateSearchText = (candidate: AdminTravelKnowledgeCandidateRecord): string => (
    [
        candidate.targetName,
        candidate.targetKey,
        candidate.targetKind,
        candidate.fieldPath,
        candidate.sourceKey,
        candidate.sourceName,
        candidate.countryCode,
        candidate.latestReason || '',
        formatJson(candidate.proposedValue),
    ]
        .join(' ')
        .toLowerCase()
);

const SummaryCard: React.FC<{ label: string; value: React.ReactNode; hint: string }> = ({ label, value, hint }) => (
    <AdminSurfaceCard className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <div className="text-2xl font-black tracking-tight text-slate-900">{value}</div>
        <p className="text-sm text-slate-500">{hint}</p>
    </AdminSurfaceCard>
);

const JsonPanel: React.FC<{ label: string; value: unknown; tone: 'before' | 'after' }> = ({ label, value, tone }) => (
    <div className={`min-w-0 rounded-xl border p-3 ${tone === 'after' ? 'border-accent-200 bg-accent-50/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-800">
            {formatJson(value)}
        </pre>
    </div>
);

interface CandidateCardProps {
    candidate: AdminTravelKnowledgeCandidateRecord;
    isReviewing: boolean;
    onReview: (candidate: AdminTravelKnowledgeCandidateRecord, decision: AdminTravelKnowledgeReviewDecision) => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, isReviewing, onReview }) => {
    const isOpen = candidate.status === 'new' || candidate.status === 'needs_review';
    return (
        <article
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '620px' }}
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_META[candidate.status].className}`}>
                            {STATUS_META[candidate.status].label}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${SEVERITY_META[candidate.severity].className}`}>
                            {SEVERITY_META[candidate.severity].label}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {humanizeToken(candidate.changeKind)}
                        </span>
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-tight text-slate-950">{candidate.targetName}</h2>
                        <p className="mt-1 break-all font-mono text-xs text-slate-500">{candidate.fieldPath}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{candidate.countryCode} · {humanizeToken(candidate.targetKind)}</span>
                        <span>{Math.round(candidate.confidence * 100)}% confidence</span>
                        <span>{humanizeToken(candidate.extractionMethod)}</span>
                        <a
                            href={candidate.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:text-accent-900"
                            onClick={() => trackEvent('admin__travel_knowledge_source--open', { source_key: candidate.sourceKey })}
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_source--open')}
                        >
                            <LinkSimple size={13} />
                            {candidate.sourceName}
                        </a>
                    </div>
                </div>

                {isOpen ? (
                    <div className="flex flex-wrap gap-2 xl:max-w-md xl:justify-end">
                        <button
                            type="button"
                            onClick={() => onReview(candidate, 'accept')}
                            disabled={isReviewing}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_review--accept')}
                        >
                            <CheckCircle size={16} weight="bold" />
                            Accept
                        </button>
                        <button
                            type="button"
                            onClick={() => onReview(candidate, 'accept_with_edit')}
                            disabled={isReviewing}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_review--accept_with_edit')}
                        >
                            <PencilSimple size={16} weight="bold" />
                            Edit & accept
                        </button>
                        <button
                            type="button"
                            onClick={() => onReview(candidate, 'request_changes')}
                            disabled={isReviewing}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_review--request_changes')}
                        >
                            <ArrowCounterClockwise size={16} weight="bold" />
                            Request changes
                        </button>
                        <button
                            type="button"
                            onClick={() => onReview(candidate, 'reject')}
                            disabled={isReviewing}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_review--reject')}
                        >
                            <XCircle size={16} weight="bold" />
                            Reject
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <JsonPanel label="Current value" value={candidate.previousValue} tone="before" />
                <JsonPanel label="Proposed value" value={candidate.proposedValue} tone="after" />
            </div>

            {candidate.validationFindings.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <div className="flex items-center gap-2 font-semibold">
                        <WarningCircle size={16} weight="bold" />
                        Validation findings
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">{formatJson(candidate.validationFindings)}</pre>
                </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>Retrieved {formatTimestamp(candidate.retrievedAt)} · Candidate {candidate.candidateId.slice(0, 8)}</span>
                {candidate.latestDecision ? (
                    <span className="font-medium text-slate-700">
                        Last review: {humanizeToken(candidate.latestDecision)} · {candidate.latestReason || 'No reason recorded'}
                    </span>
                ) : (
                    <span>No review recorded</span>
                )}
            </div>
        </article>
    );
};

export const AdminTravelKnowledgePage: React.FC = () => {
    const { prompt: promptDialog } = useAppDialog();
    const [activeView, setActiveView] = useState<'catalog' | 'review'>('catalog');
    const [candidates, setCandidates] = useState<AdminTravelKnowledgeCandidateRecord[]>([]);
    const [summary, setSummary] = useState<AdminTravelKnowledgeReviewSummary | null>(null);
    const [catalogPack, setCatalogPack] = useState<TravelDestinationPack | null>(null);
    const [catalogSource, setCatalogSource] = useState<TravelKnowledgeLoadSource | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [statusFilters, setStatusFilters] = useState<AdminTravelKnowledgeCandidateStatus[]>(OPEN_REVIEW_STATUSES);
    const [severityFilters, setSeverityFilters] = useState<AdminTravelKnowledgeCandidateSeverity[]>([]);
    const [sourceFilters, setSourceFilters] = useState<string[]>([]);
    const [countryFilters, setCountryFilters] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [nextCandidates, nextSummary, nextCatalog] = await Promise.all([
                adminListTravelKnowledgeCandidates({ limit: REVIEW_FETCH_LIMIT }),
                adminGetTravelKnowledgeReviewSummary(),
                loadTravelDestinationPack({
                    countryCode: 'TH',
                    locale: 'en',
                    networkPolicy: 'network-first',
                }),
            ]);
            setCandidates(nextCandidates);
            setSummary(nextSummary);
            setCatalogPack(nextCatalog.pack);
            setCatalogSource(nextCatalog.source);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load the travel knowledge review queue.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const statusOptions = useMemo<AdminFilterMenuOption[]>(() => STATUS_VALUES.map((status) => ({
        value: status,
        label: STATUS_META[status].label,
        count: candidates.filter((candidate) => candidate.status === status).length,
    })), [candidates]);

    const severityOptions = useMemo<AdminFilterMenuOption[]>(() => SEVERITY_VALUES.map((severity) => ({
        value: severity,
        label: SEVERITY_META[severity].label,
        count: candidates.filter((candidate) => candidate.severity === severity).length,
    })), [candidates]);

    const sourceOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, { label: string; count: number }>();
        candidates.forEach((candidate) => {
            const current = counts.get(candidate.sourceKey);
            counts.set(candidate.sourceKey, { label: candidate.sourceName, count: (current?.count || 0) + 1 });
        });
        return Array.from(counts.entries())
            .map(([value, meta]) => ({ value, label: meta.label, count: meta.count }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [candidates]);

    const countryOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        candidates.forEach((candidate) => counts.set(candidate.countryCode, (counts.get(candidate.countryCode) || 0) + 1));
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [candidates]);

    const filteredCandidates = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase();
        return candidates.filter((candidate) => {
            if (statusFilters.length > 0 && !statusFilters.includes(candidate.status)) return false;
            if (severityFilters.length > 0 && !severityFilters.includes(candidate.severity)) return false;
            if (sourceFilters.length > 0 && !sourceFilters.includes(candidate.sourceKey)) return false;
            if (countryFilters.length > 0 && !countryFilters.includes(candidate.countryCode)) return false;
            if (normalizedSearch && !candidateSearchText(candidate).includes(normalizedSearch)) return false;
            return true;
        });
    }, [candidates, countryFilters, searchValue, severityFilters, sourceFilters, statusFilters]);
    const catalogFactCount = useMemo(() => (
        catalogPack?.entities.reduce((total, entity) => total + entity.facts.length, 0) ?? 0
    ), [catalogPack]);

    const reviewCandidate = useCallback(async (
        candidate: AdminTravelKnowledgeCandidateRecord,
        decision: AdminTravelKnowledgeReviewDecision,
    ) => {
        let acceptedValue: unknown = undefined;
        if (decision === 'accept_with_edit') {
            const editedValue = await promptDialog({
                title: 'Edit the accepted value',
                message: 'Enter the final value as valid JSON. This value is recorded in the review ledger; publishing remains a separate step.',
                label: 'Accepted JSON value',
                defaultValue: formatJson(candidate.proposedValue),
                confirmLabel: 'Continue',
                cancelLabel: 'Cancel',
                validate: (value) => {
                    try {
                        return JSON.parse(value) === null ? 'The accepted value cannot be null.' : null;
                    } catch {
                        return 'Enter valid JSON, for example "Q1861", 42, or {"key":"value"}.';
                    }
                },
            });
            if (editedValue === null) return;
            acceptedValue = JSON.parse(editedValue);
        }

        const reason = await promptDialog({
            title: REVIEW_ACTION_META[decision].label,
            message: decision === 'request_changes'
                ? 'Explain what the next ingestion or editorial pass must change. The candidate will stay in the review queue.'
                : 'Record why this evidence should receive this decision. The reason becomes part of the immutable review history.',
            label: 'Review reason',
            placeholder: 'Evidence checked against the source and canonical entity…',
            confirmLabel: REVIEW_ACTION_META[decision].label,
            cancelLabel: 'Cancel',
            tone: decision === 'reject' ? 'danger' : 'default',
            validate: (value) => value.trim().length >= 12 ? null : 'Add a specific reason of at least 12 characters.',
        });
        if (reason === null) return;

        trackEvent(`admin__travel_knowledge_review--${decision}`, {
            candidate_id: candidate.candidateId,
            source_key: candidate.sourceKey,
            country_code: candidate.countryCode,
            field_path: candidate.fieldPath,
        });
        setReviewingCandidateId(candidate.candidateId);
        try {
            await adminReviewTravelKnowledgeCandidate({
                candidateId: candidate.candidateId,
                decision,
                reason,
                acceptedValue,
            });
            await loadData();
            showAppToast({
                tone: 'success',
                title: `Candidate ${REVIEW_ACTION_META[decision].completedLabel}`,
                description: 'The decision and candidate status were committed atomically. Published travel answers are unchanged.',
            });
        } catch (error) {
            showAppToast({
                tone: 'error',
                title: 'Review could not be saved',
                description: error instanceof Error ? error.message : 'Try again after reloading the review queue.',
            });
        } finally {
            setReviewingCandidateId(null);
        }
    }, [loadData, promptDialog]);

    return (
        <AdminShell
            title="Travel Knowledge"
            description="Inspect the published destination catalogue and review source-backed changes before they enter a future version."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            showDateRange={false}
            actions={(
                <AdminReloadButton
                    onClick={() => {
                        trackEvent('admin__travel_knowledge--reload');
                        void loadData();
                    }}
                    isLoading={isLoading}
                    label="Reload data"
                />
            )}
        >
            <div className="space-y-5">
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Travel knowledge views">
                    {([
                        ['catalog', 'Published catalogue'],
                        ['review', 'Review queue'],
                    ] as const).map(([view, label]) => (
                        <button
                            key={view}
                            type="button"
                            role="tab"
                            aria-selected={activeView === view}
                            className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${activeView === view ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            onClick={() => {
                                setActiveView(view);
                                setSearchValue('');
                                trackEvent('admin__travel_knowledge_view--change', { view });
                            }}
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_view--change', { view })}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {activeView === 'catalog' ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard
                                label="Active dataset"
                                value={catalogPack?.dataset?.version ?? '—'}
                                hint={`Published ${formatTimestamp(catalogPack?.dataset?.publishedAt)}`}
                            />
                            <SummaryCard
                                label="Entities"
                                value={catalogPack?.entities.length ?? 0}
                                hint="Countries, regions, cities, neighborhoods, and POIs"
                            />
                            <SummaryCard
                                label="Source-backed facts"
                                value={catalogFactCount}
                                hint="Values with confidence, review state, and freshness"
                            />
                            <SummaryCard
                                label="Route templates"
                                value={catalogPack?.templates.length ?? 0}
                                hint="Versioned city breaks, hubs, and circuits"
                            />
                        </div>
                        {errorMessage ? (
                            <AdminSurfaceCard className="border-rose-200 bg-rose-50 text-sm text-rose-900">
                                <div className="flex items-start gap-2">
                                    <WarningCircle size={18} className="mt-0.5 shrink-0" weight="bold" />
                                    <div>
                                        <div className="font-semibold">Travel knowledge unavailable</div>
                                        <p className="mt-1">{errorMessage}</p>
                                    </div>
                                </div>
                            </AdminSurfaceCard>
                        ) : null}
                        <TravelKnowledgeCatalog
                            pack={catalogPack}
                            source={catalogSource}
                            searchValue={searchValue}
                            isLoading={isLoading}
                        />
                    </>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard
                                label="Open review"
                                value={(summary?.newCount || 0) + (summary?.needsReviewCount || 0)}
                                hint={`${summary?.candidateTotal || 0} candidates across the ledger`}
                            />
                            <SummaryCard
                                label="Accepted"
                                value={summary?.acceptedCount || 0}
                                hint="Approved for a future staged artifact"
                            />
                            <SummaryCard
                                label="Source runs"
                                value={summary?.successfulRunCount || 0}
                                hint={`Latest ${formatTimestamp(summary?.latestSourceRunAt)}`}
                            />
                            <SummaryCard
                                label="Private snapshots"
                                value={summary?.snapshotCount || 0}
                                hint="Immutable evidence objects available to reviewers"
                            />
                        </div>

                        <AdminSurfaceCard className="space-y-3">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <h2 className="text-base font-black tracking-tight text-slate-950">Candidate queue</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Showing {filteredCandidates.length} of {candidates.length} loaded candidates. Open decisions are selected by default.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <AdminFilterMenu
                                        label="Status"
                                        options={statusOptions}
                                        selectedValues={statusFilters}
                                        onSelectedValuesChange={(values) => setStatusFilters(values as AdminTravelKnowledgeCandidateStatus[])}
                                    />
                                    <AdminFilterMenu
                                        label="Severity"
                                        options={severityOptions}
                                        selectedValues={severityFilters}
                                        onSelectedValuesChange={(values) => setSeverityFilters(values as AdminTravelKnowledgeCandidateSeverity[])}
                                    />
                                    <AdminFilterMenu
                                        label="Source"
                                        options={sourceOptions}
                                        selectedValues={sourceFilters}
                                        onSelectedValuesChange={setSourceFilters}
                                    />
                                    <AdminFilterMenu
                                        label="Country"
                                        options={countryOptions}
                                        selectedValues={countryFilters}
                                        onSelectedValuesChange={setCountryFilters}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                <MagnifyingGlass size={16} />
                                Search covers targets, fields, source names, IDs, proposed values, and prior review reasons.
                            </div>
                        </AdminSurfaceCard>

                        {errorMessage ? (
                            <AdminSurfaceCard className="border-rose-200 bg-rose-50 text-sm text-rose-900">
                                <div className="flex items-start gap-2">
                                    <WarningCircle size={18} className="mt-0.5 shrink-0" weight="bold" />
                                    <div>
                                        <div className="font-semibold">Review queue unavailable</div>
                                        <p className="mt-1">{errorMessage}</p>
                                    </div>
                                </div>
                            </AdminSurfaceCard>
                        ) : null}

                        {!errorMessage && !isLoading && filteredCandidates.length === 0 ? (
                            <AdminSurfaceCard className="py-12 text-center">
                                <GitDiff size={34} className="mx-auto text-slate-300" weight="duotone" />
                                <h2 className="mt-3 text-base font-black text-slate-900">No candidates match these filters</h2>
                                <p className="mt-1 text-sm text-slate-500">Clear one or more filters, or wait for the next source ingestion run.</p>
                            </AdminSurfaceCard>
                        ) : null}

                        <div className="space-y-4">
                            {filteredCandidates.map((candidate) => (
                                <CandidateCard
                                    key={candidate.candidateId}
                                    candidate={candidate}
                                    isReviewing={reviewingCandidateId === candidate.candidateId}
                                    onReview={(nextCandidate, decision) => void reviewCandidate(nextCandidate, decision)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </AdminShell>
    );
};
