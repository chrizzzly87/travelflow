import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AdminShell } from '../components/admin/AdminShell';
import {
    adminListTermsVersions,
    adminPublishTermsVersion,
    adminSetCurrentTermsVersion,
} from '../services/adminService';
import type { LegalTermsVersionRecord } from '../services/legalTermsService';

interface TermsDraft {
    versionDate: string;
    versionRevision: number;
    title: string;
    summary: string;
    lastUpdated: string;
    requiresReaccept: boolean;
    contentDe: string;
    contentEn: string;
}

const normalizeDateInput = (value: string): string => value.slice(0, 10);
const VERSION_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/;

const normalizeRevision = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
};

const buildVersionFromParts = (baseDateIso: string, revision: number): string => {
    const normalizedDate = normalizeDateInput(baseDateIso) || '2026-03-03';
    const normalizedRevision = normalizeRevision(revision);
    if (normalizedRevision <= 0) return normalizedDate;
    return `${normalizedDate}-${normalizedRevision}`;
};

const parseVersionRevisionForDate = (version: string, baseDateIso: string): number | null => {
    const normalizedDate = normalizeDateInput(baseDateIso);
    const match = version.trim().match(VERSION_PATTERN);
    if (!match) return null;
    if (match[1] !== normalizedDate) return null;
    if (!match[2]) return 0;
    const parsed = Number(match[2]);
    if (!Number.isFinite(parsed)) return null;
    return normalizeRevision(parsed);
};

export const getNextTermsRevision = (baseDateIso: string, existingVersions: string[]): number => {
    const normalizedDate = normalizeDateInput(baseDateIso) || '2026-03-03';
    let highestRevision = -1;

    existingVersions.forEach((entry) => {
        const revision = parseVersionRevisionForDate(entry, normalizedDate);
        if (revision === null) return;
        highestRevision = Math.max(highestRevision, revision);
    });

    if (highestRevision < 0) return 0;
    return highestRevision + 1;
};

const toDateTimeLabel = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
};

export const buildTermsVersionCandidate = (baseDateIso: string, existingVersions: string[]): string => {
    const normalizedDate = normalizeDateInput(baseDateIso) || '2026-03-03';
    const nextRevision = getNextTermsRevision(normalizedDate, existingVersions);
    return buildVersionFromParts(normalizedDate, nextRevision);
};

const buildDraftFromBase = (
    base: LegalTermsVersionRecord,
    allVersions: LegalTermsVersionRecord[]
): TermsDraft => {
    const todayIso = normalizeDateInput(new Date().toISOString());
    const nextRevision = getNextTermsRevision(todayIso, allVersions.map((item) => item.version));
    return {
        versionDate: todayIso,
        versionRevision: nextRevision,
        title: base.title,
        summary: base.summary || '',
        lastUpdated: todayIso,
        requiresReaccept: true,
        contentDe: base.contentDe,
        contentEn: base.contentEn,
    };
};

export const AdminLegalTermsPage: React.FC = () => {
    const [versions, setVersions] = useState<LegalTermsVersionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [draft, setDraft] = useState<TermsDraft | null>(null);

    const loadVersions = useCallback(async (options?: { keepDraft?: boolean }) => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const rows = await adminListTermsVersions();
            setVersions(rows);
            setDraft((previous) => {
                if (options?.keepDraft && previous) return previous;
                const current = rows.find((row) => row.isCurrent) || rows[0] || null;
                if (!current) return previous;
                return buildDraftFromBase(current, rows);
            });
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load Terms versions.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadVersions();
    }, [loadVersions]);

    const currentVersion = useMemo(
        () => versions.find((row) => row.isCurrent) || null,
        [versions]
    );
    const suggestedNextVersion = useMemo(
        () => buildTermsVersionCandidate(
            normalizeDateInput(draft?.versionDate || draft?.lastUpdated || new Date().toISOString()),
            versions.map((row) => row.version)
        ),
        [draft?.lastUpdated, draft?.versionDate, versions]
    );
    const suggestedNextRevision = useMemo(
        () => parseVersionRevisionForDate(suggestedNextVersion, normalizeDateInput(draft?.versionDate || draft?.lastUpdated || '')) ?? 0,
        [draft?.lastUpdated, draft?.versionDate, suggestedNextVersion]
    );

    const handleDraftField = useCallback(<K extends keyof TermsDraft>(field: K, value: TermsDraft[K]) => {
        setDraft((previous) => {
            if (!previous) return previous;
            return {
                ...previous,
                [field]: value,
            };
        });
    }, []);

    const handleUseVersionAsBase = useCallback((version: LegalTermsVersionRecord) => {
        setDraft(buildDraftFromBase(version, versions));
        setActionMessage(`Loaded ${version.version} as draft basis.`);
        setErrorMessage(null);
    }, [versions]);

    const handlePublish = useCallback(async () => {
        if (!draft || isPublishing) return;
        setIsPublishing(true);
        setErrorMessage(null);
        setActionMessage(null);

        const existingVersions = new Set(versions.map((item) => item.version));
        let publishVersion = buildVersionFromParts(draft.versionDate, draft.versionRevision);
        if (!publishVersion || existingVersions.has(publishVersion)) {
            publishVersion = buildTermsVersionCandidate(
                normalizeDateInput(draft.lastUpdated || new Date().toISOString()),
                versions.map((item) => item.version)
            );
        }

        try {
            const published = await adminPublishTermsVersion({
                version: publishVersion,
                title: draft.title,
                summary: draft.summary,
                bindingLocale: 'de',
                lastUpdated: normalizeDateInput(draft.lastUpdated),
                requiresReaccept: draft.requiresReaccept,
                contentDe: draft.contentDe,
                contentEn: draft.contentEn,
                makeCurrent: true,
            });

            await loadVersions({ keepDraft: false });
            setActionMessage(
                `Published ${published.version} as current terms (${published.requiresReaccept ? 'force re-accept' : 'inform only'}).`
            );
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not publish terms version.');
        } finally {
            setIsPublishing(false);
        }
    }, [draft, isPublishing, loadVersions, versions]);

    const handleSetCurrent = useCallback(async (version: string, requiresReaccept: boolean) => {
        setIsPublishing(true);
        setErrorMessage(null);
        setActionMessage(null);

        try {
            const updated = await adminSetCurrentTermsVersion(version, {
                requiresReaccept,
            });
            await loadVersions({ keepDraft: true });
            setActionMessage(`Set ${updated.version} as current terms (${updated.requiresReaccept ? 'force re-accept' : 'inform only'}).`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not switch current terms version.');
        } finally {
            setIsPublishing(false);
        }
    }, [loadVersions]);

    return (
        <AdminShell
            title="Terms & Conditions"
            description="Publish versioned DE/EN Terms text, choose force-vs-inform rollout mode, and keep an auditable history."
            showDateRange={false}
            showGlobalSearch={false}
        >
            <div className="space-y-4">
                {actionMessage && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        {actionMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {errorMessage}
                    </div>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Publish New Terms Version</h2>
                            <p className="mt-1 text-xs text-slate-600">
                                Start from the current version, edit DE/EN text, then publish. Use <code>{'{appName}'}</code> in content to keep app naming dynamic.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (!currentVersion) return;
                                setDraft(buildDraftFromBase(currentVersion, versions));
                                setActionMessage('Draft reset from current version.');
                                setErrorMessage(null);
                            }}
                            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            disabled={!currentVersion || isLoading}
                        >
                            Reset Draft From Current
                        </button>
                    </div>

                    {!draft ? (
                        <p className="mt-4 text-sm text-slate-600">{isLoading ? 'Loading terms...' : 'No terms version available.'}</p>
                    ) : (
                        <div className="mt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                <label className="space-y-1 text-xs font-semibold text-slate-700">
                                    Version date prefix
                                    <input
                                        type="text"
                                        value={draft.versionDate}
                                        readOnly
                                        className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
                                    />
                                    <span className="block text-[11px] font-normal text-slate-500">
                                        Current: {currentVersion?.version || 'n/a'} · Suggested next: {suggestedNextVersion}
                                    </span>
                                    <span className="block text-[11px] font-normal text-slate-500">
                                        Draft version: {buildVersionFromParts(draft.versionDate, draft.versionRevision)}
                                    </span>
                                </label>
                                <label className="space-y-1 text-xs font-semibold text-slate-700">
                                    Revision suffix
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={draft.versionRevision}
                                        onChange={(event) => {
                                            const nextRevision = normalizeRevision(Number(event.target.value));
                                            setDraft((previous) => {
                                                if (!previous) return previous;
                                                return {
                                                    ...previous,
                                                    versionRevision: nextRevision,
                                                };
                                            });
                                        }}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-accent-200 focus:ring"
                                    />
                                    <span className="block text-[11px] font-normal text-slate-500">
                                        0 = {draft.versionDate}; 1 = {draft.versionDate}-1
                                    </span>
                                </label>
                                <label className="space-y-1 text-xs font-semibold text-slate-700">
                                    Last updated
                                    <input
                                        type="date"
                                        value={normalizeDateInput(draft.lastUpdated)}
                                        onChange={(event) => {
                                            const nextDate = normalizeDateInput(event.target.value);
                                            const nextRevision = getNextTermsRevision(nextDate, versions.map((row) => row.version));
                                            setDraft((previous) => {
                                                if (!previous) return previous;
                                                return {
                                                    ...previous,
                                                    lastUpdated: nextDate,
                                                    versionDate: nextDate,
                                                    versionRevision: nextRevision,
                                                };
                                            });
                                        }}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-accent-200 focus:ring"
                                    />
                                </label>
                                <label className="space-y-1 text-xs font-semibold text-slate-700 md:col-span-2 lg:col-span-2">
                                    Title
                                    <input
                                        type="text"
                                        value={draft.title}
                                        onChange={(event) => handleDraftField('title', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-accent-200 focus:ring"
                                        placeholder="Terms of Service / AGB"
                                    />
                                </label>
                            </div>

                            <label className="space-y-1 text-xs font-semibold text-slate-700">
                                Summary (internal/admin)
                                <textarea
                                    value={draft.summary}
                                    onChange={(event) => handleDraftField('summary', event.target.value)}
                                    className="min-h-[72px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-accent-200 focus:ring"
                                    placeholder="What changed in this version?"
                                />
                            </label>

                            <label className="inline-flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                                    checked={draft.requiresReaccept}
                                    onChange={(event) => handleDraftField('requiresReaccept', event.target.checked)}
                                />
                                <span>
                                    <span className="font-semibold">Force re-acceptance</span>
                                    <span className="mt-1 block text-xs text-slate-600">
                                        Enabled: users must accept before protected usage continues. Disabled: users are informed only (no block).
                                    </span>
                                </span>
                            </label>

                            <div className="grid gap-3 lg:grid-cols-2">
                                <label className="space-y-1 text-xs font-semibold text-slate-700">
                                    German binding text (Markdown)
                                    <textarea
                                        value={draft.contentDe}
                                        onChange={(event) => handleDraftField('contentDe', event.target.value)}
                                        className="min-h-[320px] w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-5 text-slate-900 outline-none ring-accent-200 focus:ring"
                                    />
                                </label>
                                <label className="space-y-1 text-xs font-semibold text-slate-700">
                                    English helper text (Markdown)
                                    <textarea
                                        value={draft.contentEn}
                                        onChange={(event) => handleDraftField('contentEn', event.target.value)}
                                        className="min-h-[320px] w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-5 text-slate-900 outline-none ring-accent-200 focus:ring"
                                    />
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraft((previous) => {
                                            if (!previous) return previous;
                                            return {
                                                ...previous,
                                                versionRevision: suggestedNextRevision,
                                            };
                                        });
                                    }}
                                    disabled={isPublishing}
                                    className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Use suggested revision
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handlePublish()}
                                    disabled={isPublishing}
                                    className="inline-flex h-10 items-center rounded-lg bg-accent-700 px-4 text-sm font-semibold text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isPublishing ? 'Publishing...' : 'Publish as Current'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {draft && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                        <h2 className="text-base font-semibold text-slate-900">Draft Preview</h2>
                        <div className="mt-3 grid gap-4 lg:grid-cols-2">
                            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">German binding</h3>
                                <div className="prose prose-sm mt-2 max-w-none prose-headings:mt-4 prose-headings:text-slate-900 prose-p:text-slate-700">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.contentDe}</ReactMarkdown>
                                </div>
                            </article>
                            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">English helper</h3>
                                <div className="prose prose-sm mt-2 max-w-none prose-headings:mt-4 prose-headings:text-slate-900 prose-p:text-slate-700">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.contentEn}</ReactMarkdown>
                                </div>
                            </article>
                        </div>
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-semibold text-slate-900">Version History</h2>
                        {currentVersion && (
                            <div className="text-xs text-slate-600">
                                Current: <span className="font-semibold text-slate-900">{currentVersion.version}</span>
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <p className="mt-3 text-sm text-slate-600">Loading version history...</p>
                    ) : versions.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-600">No terms versions found.</p>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {versions.map((version) => (
                                <article
                                    key={version.version}
                                    className={`rounded-xl border px-3 py-3 text-sm ${version.isCurrent ? 'border-accent-300 bg-accent-50' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-slate-900">{version.version}</p>
                                            <p className="text-xs text-slate-600">{version.title}</p>
                                            <p className="mt-1 text-xs text-slate-600">
                                                Last updated {normalizeDateInput(version.lastUpdated)} · Effective {toDateTimeLabel(version.effectiveAt)}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${version.requiresReaccept ? 'border-amber-300 bg-amber-100 text-amber-900' : 'border-sky-300 bg-sky-100 text-sky-900'}`}>
                                                {version.requiresReaccept ? 'Force re-accept' : 'Inform only'}
                                            </span>
                                            {version.isCurrent && (
                                                <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {version.summary && (
                                        <p className="mt-2 text-xs text-slate-600">{version.summary}</p>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUseVersionAsBase(version)}
                                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                        >
                                            Use as Draft Basis
                                        </button>
                                        {!version.isCurrent && (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={isPublishing}
                                                    onClick={() => void handleSetCurrent(version.version, true)}
                                                    className="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    Set Current (Force)
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isPublishing}
                                                    onClick={() => void handleSetCurrent(version.version, false)}
                                                    className="inline-flex h-8 items-center rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    Set Current (Inform)
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </AdminShell>
    );
};
