import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, FileText } from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
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
            setErrorMessage(toAdminErrorMessage(error, 'Could not load the terms versions. Reload to try again.', 'admin-legal'));
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
        setActionMessage(`Loaded ${version.version} as the draft basis.`);
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
                `Published ${published.version} as the current terms (${published.requiresReaccept ? 'force re-accept' : 'inform only'}).`
            );
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not publish this terms version. Your draft is still here; try publishing again.', 'admin-legal'));
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
            setActionMessage(`Set ${updated.version} as the current terms (${updated.requiresReaccept ? 'force re-accept' : 'inform only'}).`);
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, `Could not make ${version} the current terms. Try again in a moment.`, 'admin-legal'));
        } finally {
            setIsPublishing(false);
        }
    }, [loadVersions]);

    const fieldLabelClass = 'flex flex-col gap-1.5 text-sm font-medium text-foreground';
    const fieldHintClass = 'text-xs font-normal text-muted-foreground';

    return (
        <AdminShell
            title="Legal terms"
            description="Publish versioned DE/EN terms, choose force or inform rollout, and keep an auditable history."
            showDateRange={false}
            showGlobalSearch={false}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadVersions({ keepDraft: true })}
                    isLoading={isLoading}
                />
            )}
        >
            <div className="flex flex-col gap-6">
                {(actionMessage || errorMessage) && (
                    <div className="flex flex-col gap-3">
                        {actionMessage && (
                            <Alert variant="success">
                                <CheckCircle weight="fill" />
                                <AlertDescription>{actionMessage}</AlertDescription>
                            </Alert>
                        )}
                        {errorMessage && <AdminErrorAlert message={errorMessage} />}
                    </div>
                )}

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Publish a new version"
                        description={(
                            <>
                                Start from the current version, edit the DE/EN text, then publish. Use <code className="font-mono text-xs">{'{appName}'}</code> in the content to keep the app name dynamic.
                            </>
                        )}
                        actions={(
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (!currentVersion) return;
                                    setDraft(buildDraftFromBase(currentVersion, versions));
                                    setActionMessage('Draft reset from the current version.');
                                    setErrorMessage(null);
                                }}
                                disabled={!currentVersion || isLoading}
                            >
                                Reset draft from current
                            </Button>
                        )}
                    />

                    {!draft ? (
                        isLoading ? (
                            <p className="text-sm text-muted-foreground" aria-live="polite">Loading terms…</p>
                        ) : (
                            <AdminEmptyState
                                icon={<FileText />}
                                title="No terms version available"
                                description="Publish a first version from the database seed, then reload this page."
                            />
                        )
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <label className={fieldLabelClass}>
                                    Version date prefix
                                    <Input
                                        type="text"
                                        aria-label="Version date prefix"
                                        value={draft.versionDate}
                                        readOnly
                                        className="bg-muted font-mono tabular-nums"
                                    />
                                    <span className={fieldHintClass}>
                                        Current: {currentVersion?.version || 'n/a'} · Suggested next: {suggestedNextVersion}
                                    </span>
                                    <span className={fieldHintClass}>
                                        Draft version: {buildVersionFromParts(draft.versionDate, draft.versionRevision)}
                                    </span>
                                </label>
                                <label className={fieldLabelClass}>
                                    Revision suffix
                                    <Input
                                        type="number"
                                        aria-label="Revision suffix"
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
                                        className="tabular-nums"
                                    />
                                    <span className={fieldHintClass}>
                                        0 = {draft.versionDate}; 1 = {draft.versionDate}-1
                                    </span>
                                </label>
                                <label className={fieldLabelClass}>
                                    Last updated
                                    <Input
                                        type="date"
                                        aria-label="Last updated"
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
                                    />
                                </label>
                                <label className={cn(fieldLabelClass, 'md:col-span-2 lg:col-span-1')}>
                                    Title
                                    <Input
                                        type="text"
                                        aria-label="Title"
                                        value={draft.title}
                                        onChange={(event) => handleDraftField('title', event.target.value)}
                                        placeholder="Terms of Service / AGB"
                                    />
                                </label>
                            </div>

                            <label className={fieldLabelClass}>
                                Summary (internal)
                                <Textarea
                                    aria-label="Summary"
                                    value={draft.summary}
                                    onChange={(event) => handleDraftField('summary', event.target.value)}
                                    className="min-h-[72px]"
                                    placeholder="What changed in this version?"
                                />
                            </label>

                            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground">
                                <Checkbox
                                    id="legal-terms-requires-reaccept"
                                    aria-label="Force re-acceptance"
                                    className="mt-0.5"
                                    checked={draft.requiresReaccept}
                                    onCheckedChange={(checked) => handleDraftField('requiresReaccept', checked === true)}
                                />
                                <label htmlFor="legal-terms-requires-reaccept" className="cursor-pointer">
                                    <span className="font-medium">Force re-acceptance</span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                        On: users must accept before protected usage continues. Off: users are informed only, nothing is blocked.
                                    </span>
                                </label>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <label className={fieldLabelClass}>
                                    German binding text (Markdown)
                                    <Textarea
                                        aria-label="German binding text"
                                        value={draft.contentDe}
                                        onChange={(event) => handleDraftField('contentDe', event.target.value)}
                                        className="min-h-[320px] font-mono text-xs leading-5 md:text-xs"
                                    />
                                </label>
                                <label className={fieldLabelClass}>
                                    English helper text (Markdown)
                                    <Textarea
                                        aria-label="English helper text"
                                        value={draft.contentEn}
                                        onChange={(event) => handleDraftField('contentEn', event.target.value)}
                                        className="min-h-[320px] font-mono text-xs leading-5 md:text-xs"
                                    />
                                </label>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
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
                                >
                                    Use suggested revision
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void handlePublish()}
                                    disabled={isPublishing}
                                >
                                    {isPublishing ? 'Publishing…' : 'Publish as current'}
                                </Button>
                            </div>
                        </div>
                    )}
                </AdminSurfaceCard>

                {draft && (
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader title="Draft preview" />
                        <div className="grid gap-4 lg:grid-cols-2">
                            <article className="min-w-0 rounded-md border border-border bg-muted/40 p-3">
                                <h3 className="text-xs font-medium text-muted-foreground">German binding</h3>
                                <div className="prose dark:prose-invert prose-sm mt-2 max-w-none break-words prose-headings:mt-4 prose-headings:text-foreground prose-p:text-foreground">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.contentDe}</ReactMarkdown>
                                </div>
                            </article>
                            <article className="min-w-0 rounded-md border border-border bg-muted/40 p-3">
                                <h3 className="text-xs font-medium text-muted-foreground">English helper</h3>
                                <div className="prose dark:prose-invert prose-sm mt-2 max-w-none break-words prose-headings:mt-4 prose-headings:text-foreground prose-p:text-foreground">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.contentEn}</ReactMarkdown>
                                </div>
                            </article>
                        </div>
                    </AdminSurfaceCard>
                )}

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Version history"
                        actions={currentVersion && (
                            <span className="text-xs text-muted-foreground">
                                Current: <span className="font-medium text-foreground tabular-nums">{currentVersion.version}</span>
                            </span>
                        )}
                    />

                    {isLoading && versions.length === 0 ? (
                        <p className="text-sm text-muted-foreground" aria-live="polite">Loading version history…</p>
                    ) : versions.length === 0 ? (
                        <AdminEmptyState
                            icon={<FileText />}
                            title="No terms versions found"
                            description="Published versions appear here with their rollout mode."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {versions.map((version) => (
                                <li
                                    key={version.version}
                                    className={cn(
                                        'rounded-md border p-3 text-sm',
                                        version.isCurrent
                                            ? 'border-accent-200 bg-accent-50/60 dark:border-accent-400/30 dark:bg-accent-400/12'
                                            : 'border-border bg-card',
                                    )}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-medium text-foreground tabular-nums">{version.version}</p>
                                            <p className="text-xs text-muted-foreground">{version.title}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Last updated {normalizeDateInput(version.lastUpdated)} · Effective {toDateTimeLabel(version.effectiveAt)}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <AdminStatusBadge tone={version.requiresReaccept ? 'warning' : 'info'}>
                                                {version.requiresReaccept ? 'Force re-accept' : 'Inform only'}
                                            </AdminStatusBadge>
                                            {version.isCurrent && (
                                                <AdminStatusBadge tone="success">Current</AdminStatusBadge>
                                            )}
                                        </div>
                                    </div>
                                    {version.summary && (
                                        <p className="mt-2 text-xs text-muted-foreground">{version.summary}</p>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() => handleUseVersionAsBase(version)}
                                        >
                                            Use as draft basis
                                        </Button>
                                        {!version.isCurrent && (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="xs"
                                                    disabled={isPublishing}
                                                    onClick={() => void handleSetCurrent(version.version, true)}
                                                >
                                                    Set current (force)
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="xs"
                                                    disabled={isPublishing}
                                                    onClick={() => void handleSetCurrent(version.version, false)}
                                                >
                                                    Set current (inform)
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
