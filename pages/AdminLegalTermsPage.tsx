import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, DotsThreeVertical, FileText } from '@phosphor-icons/react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { useAppDialog } from '../components/AppDialogProvider';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildDangerConfirmDialog, buildDecisionConfirmDialog } from '../services/appDialogPresets';
import {
    adminListTermsVersions,
    adminPublishTermsVersion,
    adminSetCurrentTermsVersion,
} from '../services/adminService';
import type { LegalTermsVersionRecord } from '../services/legalTermsService';

interface TermsDraft {
    /** The version the draft was started from; shown so the admin knows what they are editing. */
    basisVersion: string | null;
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

export const buildTermsVersionCandidate = (baseDateIso: string, existingVersions: string[]): string => {
    const normalizedDate = normalizeDateInput(baseDateIso) || '2026-03-03';
    const nextRevision = getNextTermsRevision(normalizedDate, existingVersions);
    return buildVersionFromParts(normalizedDate, nextRevision);
};

/**
 * The version string a publish will actually use. The draft's own date and
 * suffix win unless that version already exists, in which case the next free
 * suffix for the last-updated date is used. The page shows this value before
 * publishing, so what the admin reads is what gets written.
 */
export const resolveTermsPublishVersion = (
    draft: Pick<TermsDraft, 'versionDate' | 'versionRevision' | 'lastUpdated'>,
    existingVersions: string[],
): string => {
    const requested = buildVersionFromParts(draft.versionDate, draft.versionRevision);
    if (requested && !existingVersions.includes(requested)) return requested;
    return buildTermsVersionCandidate(
        normalizeDateInput(draft.lastUpdated || draft.versionDate || new Date().toISOString()),
        existingVersions,
    );
};

/** True when the draft differs from what a fresh draft of the same basis would hold. */
export const isTermsDraftEdited = (draft: TermsDraft | null, baseline: TermsDraft | null): boolean => {
    if (!draft || !baseline) return false;
    return draft.title !== baseline.title
        || draft.summary !== baseline.summary
        || draft.contentDe !== baseline.contentDe
        || draft.contentEn !== baseline.contentEn;
};

const formatDateTime = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
};

const relativeDateFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const formatRelativeDate = (value: string): string => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    const days = Math.round((parsed - Date.now()) / 86_400_000);
    if (Math.abs(days) < 1) return 'today';
    if (Math.abs(days) < 31) return relativeDateFormatter.format(days, 'day');
    if (Math.abs(days) < 365) return relativeDateFormatter.format(Math.round(days / 30), 'month');
    return relativeDateFormatter.format(Math.round(days / 365), 'year');
};

const buildDraftFromBase = (
    base: LegalTermsVersionRecord,
    allVersions: LegalTermsVersionRecord[]
): TermsDraft => {
    const todayIso = normalizeDateInput(new Date().toISOString());
    const nextRevision = getNextTermsRevision(todayIso, allVersions.map((item) => item.version));
    return {
        basisVersion: base.version,
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

const ROLLOUT_OPTIONS: Array<{ value: 'force' | 'inform'; label: string; description: string }> = [
    {
        value: 'force',
        label: 'Require re-acceptance',
        description: 'Signed-in users must accept the new terms before they can keep using protected features.',
    },
    {
        value: 'inform',
        label: 'Inform only',
        description: 'Users see a notice about the change. Nothing is blocked.',
    },
];

const rolloutLabel = (requiresReaccept: boolean): string => (requiresReaccept ? 'Re-accept required' : 'Inform only');

const MarkdownPreview: React.FC<{ content: string; label: string }> = ({ content, label }) => (
    <section aria-label={label} className="min-w-0 rounded-md border border-border bg-muted/40 p-3">
        <h4 className="text-xs font-medium text-muted-foreground">Preview</h4>
        <div className="prose dark:prose-invert prose-sm mt-2 max-h-[480px] max-w-none overflow-y-auto break-words prose-headings:mt-4 prose-headings:text-foreground prose-p:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    </section>
);

const VersionRowActions: React.FC<{
    version: LegalTermsVersionRecord;
    disabled: boolean;
    onUseAsBasis: () => void;
    onSetCurrent: (requiresReaccept: boolean) => void;
}> = ({ version, disabled, onUseAsBasis, onSetCurrent }) => (
    <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Open actions for version ${version.version}`}
                data-tooltip="Version actions"
            >
                <DotsThreeVertical weight="bold" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuItem
                onSelect={onUseAsBasis}
                {...getAnalyticsDebugAttributes('admin__legal_terms--use_as_basis')}
            >
                Start a draft from this version
            </DropdownMenuItem>
            {!version.isCurrent && (
                <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onSetCurrent(true)}
                        {...getAnalyticsDebugAttributes('admin__legal_terms--set_current', { rollout: 'force' })}
                    >
                        Make current, require re-acceptance
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onSetCurrent(false)}
                        {...getAnalyticsDebugAttributes('admin__legal_terms--set_current', { rollout: 'inform' })}
                    >
                        Make current, inform only
                    </DropdownMenuItem>
                </>
            )}
        </DropdownMenuContent>
    </DropdownMenu>
);

/**
 * Legal terms: one flow — start a draft from the live version, edit the German
 * (binding) and English (helper) text side by side with a preview, choose the
 * rollout, publish. The version history sits below as a reference table, with
 * "start from" and "make current" behind each row's menu.
 */
export const AdminLegalTermsPage: React.FC = () => {
    const { confirm } = useAppDialog();
    const [versions, setVersions] = useState<LegalTermsVersionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [draft, setDraft] = useState<TermsDraft | null>(null);
    const [draftBaseline, setDraftBaseline] = useState<TermsDraft | null>(null);

    const startDraft = useCallback((base: LegalTermsVersionRecord, allVersions: LegalTermsVersionRecord[]) => {
        const next = buildDraftFromBase(base, allVersions);
        setDraft(next);
        setDraftBaseline(next);
    }, []);

    const loadVersions = useCallback(async (options?: { keepDraft?: boolean }) => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const rows = await adminListTermsVersions();
            setVersions(rows);
            const current = rows.find((row) => row.isCurrent) || rows[0] || null;
            if (current) {
                const fresh = buildDraftFromBase(current, rows);
                if (options?.keepDraft) {
                    setDraft((previous) => previous ?? fresh);
                    setDraftBaseline((previous) => previous ?? fresh);
                } else {
                    setDraft(fresh);
                    setDraftBaseline(fresh);
                }
            }
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
    const existingVersionIds = useMemo(() => versions.map((row) => row.version), [versions]);
    const publishVersion = draft ? resolveTermsPublishVersion(draft, existingVersionIds) : null;
    const suggestedNextRevision = draft
        ? getNextTermsRevision(draft.versionDate || draft.lastUpdated, existingVersionIds)
        : 0;
    const isDraftEdited = isTermsDraftEdited(draft, draftBaseline);

    const handleDraftField = useCallback(<K extends keyof TermsDraft>(field: K, value: TermsDraft[K]) => {
        setDraft((previous) => (previous ? { ...previous, [field]: value } : previous));
    }, []);

    const confirmDiscardEdits = useCallback(async (): Promise<boolean> => {
        if (!isDraftEdited) return true;
        return confirm(buildDangerConfirmDialog({
            title: 'Discard your edits?',
            message: 'The draft has changes that are not published. Starting over replaces them.',
            confirmLabel: 'Discard edits',
        }));
    }, [confirm, isDraftEdited]);

    const handleUseVersionAsBase = useCallback(async (version: LegalTermsVersionRecord) => {
        trackEvent('admin__legal_terms--use_as_basis');
        if (!(await confirmDiscardEdits())) return;
        startDraft(version, versions);
        setActionMessage(`The draft now starts from ${version.version}.`);
        setErrorMessage(null);
    }, [confirmDiscardEdits, startDraft, versions]);

    const handleDiscardDraft = useCallback(async () => {
        trackEvent('admin__legal_terms--discard_draft');
        if (!(await confirmDiscardEdits())) return;
        const basis = versions.find((row) => row.version === draft?.basisVersion) || currentVersion;
        if (!basis) return;
        startDraft(basis, versions);
        setActionMessage(null);
        setErrorMessage(null);
    }, [confirmDiscardEdits, currentVersion, draft?.basisVersion, startDraft, versions]);

    const handlePublish = useCallback(async () => {
        if (!draft || isPublishing || !publishVersion) return;
        const confirmed = await confirm((draft.requiresReaccept ? buildDangerConfirmDialog : buildDecisionConfirmDialog)({
            title: `Publish ${publishVersion}?`,
            message: draft.requiresReaccept
                ? 'It becomes the live terms right away, and every signed-in user has to accept it before continuing.'
                : 'It becomes the live terms right away. Users see a notice; nothing is blocked.',
            confirmLabel: 'Publish',
        }));
        if (!confirmed) return;

        trackEvent('admin__legal_terms--publish', { rollout: draft.requiresReaccept ? 'force' : 'inform' });
        setIsPublishing(true);
        setErrorMessage(null);
        setActionMessage(null);

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
            setActionMessage(`Published ${published.version} as the live terms (${rolloutLabel(published.requiresReaccept).toLowerCase()}).`);
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not publish this terms version. Your draft is still here; try publishing again.', 'admin-legal'));
        } finally {
            setIsPublishing(false);
        }
    }, [confirm, draft, isPublishing, loadVersions, publishVersion]);

    const handleSetCurrent = useCallback(async (version: string, requiresReaccept: boolean) => {
        const confirmed = await confirm((requiresReaccept ? buildDangerConfirmDialog : buildDecisionConfirmDialog)({
            title: `Make ${version} the live terms?`,
            message: requiresReaccept
                ? 'Every signed-in user has to accept it before continuing.'
                : 'Users see a notice; nothing is blocked.',
            confirmLabel: 'Make current',
        }));
        if (!confirmed) return;

        trackEvent('admin__legal_terms--set_current', { rollout: requiresReaccept ? 'force' : 'inform' });
        setIsPublishing(true);
        setErrorMessage(null);
        setActionMessage(null);

        try {
            const updated = await adminSetCurrentTermsVersion(version, { requiresReaccept });
            await loadVersions({ keepDraft: true });
            setActionMessage(`${updated.version} is now the live terms (${rolloutLabel(updated.requiresReaccept).toLowerCase()}).`);
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, `Could not make ${version} the current terms. Try again in a moment.`, 'admin-legal'));
        } finally {
            setIsPublishing(false);
        }
    }, [confirm, loadVersions]);

    const fieldLabelClass = 'flex flex-col gap-1.5 text-sm font-medium text-foreground';
    const fieldHintClass = 'text-xs font-normal text-muted-foreground';

    return (
        <AdminShell
            title="Legal terms"
            description="Draft the next terms version from the live one, edit German and English, then publish it as required or informational."
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

                {currentVersion && (
                    <AdminSurfaceCard className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3" role="region" aria-label="Live terms">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Live now</span>
                            <span className="font-medium tabular-nums text-foreground">{currentVersion.version}</span>
                            <span className="min-w-0 truncate text-sm text-muted-foreground">{currentVersion.title}</span>
                        </div>
                        <AdminStatusBadge tone={currentVersion.requiresReaccept ? 'warning' : 'info'}>
                            {rolloutLabel(currentVersion.requiresReaccept)}
                        </AdminStatusBadge>
                        <span className="text-xs text-muted-foreground" data-tooltip={formatDateTime(currentVersion.effectiveAt)}>
                            Effective {formatRelativeDate(currentVersion.effectiveAt)}
                        </span>
                    </AdminSurfaceCard>
                )}

                <AdminSurfaceCard className="flex flex-col gap-6">
                    <AdminSectionHeader
                        title="Next version"
                        description={draft?.basisVersion
                            ? `Started from ${draft.basisVersion}${draft.basisVersion === currentVersion?.version ? ' (live)' : ''}. Edit the text, choose the rollout, publish.`
                            : 'Edit the text, choose the rollout, publish.'}
                        actions={isDraftEdited && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDiscardDraft()}
                                disabled={isPublishing}
                                {...getAnalyticsDebugAttributes('admin__legal_terms--discard_draft')}
                            >
                                Discard edits
                            </Button>
                        )}
                    />

                    {!draft ? (
                        isLoading ? (
                            <p className="text-sm text-muted-foreground" role="status">Loading terms…</p>
                        ) : (
                            <AdminEmptyState
                                icon={<FileText />}
                                title="No terms version available"
                                description="Publish a first version from the database seed, then reload this page."
                            />
                        )
                    ) : (
                        <>
                            <section className="flex flex-col gap-3" aria-labelledby="legal-terms-step-text">
                                <AdminSectionHeader
                                    as="h3"
                                    title={<span id="legal-terms-step-text">1. Edit the text</span>}
                                    description={<>German is the binding text; English helps readers. Markdown, with <code className="font-mono text-xs">{'{appName}'}</code> for the app name.</>}
                                />
                                <Tabs defaultValue="de" className="gap-3">
                                    <TabsList>
                                        <TabsTrigger value="de">German (binding)</TabsTrigger>
                                        <TabsTrigger value="en">English (helper)</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="de" className="grid gap-4 lg:grid-cols-2">
                                        <Textarea
                                            aria-label="German binding text"
                                            value={draft.contentDe}
                                            onChange={(event) => handleDraftField('contentDe', event.target.value)}
                                            className="min-h-[480px] font-mono text-xs leading-5 md:text-xs"
                                        />
                                        <MarkdownPreview content={draft.contentDe} label="German preview" />
                                    </TabsContent>
                                    <TabsContent value="en" className="grid gap-4 lg:grid-cols-2">
                                        <Textarea
                                            aria-label="English helper text"
                                            value={draft.contentEn}
                                            onChange={(event) => handleDraftField('contentEn', event.target.value)}
                                            className="min-h-[480px] font-mono text-xs leading-5 md:text-xs"
                                        />
                                        <MarkdownPreview content={draft.contentEn} label="English preview" />
                                    </TabsContent>
                                </Tabs>
                            </section>

                            <section className="flex flex-col gap-3 border-t border-border pt-6" aria-labelledby="legal-terms-step-details">
                                <AdminSectionHeader
                                    as="h3"
                                    title={<span id="legal-terms-step-details">2. Describe the version</span>}
                                />
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className={fieldLabelClass}>
                                        Title
                                        <Input
                                            type="text"
                                            aria-label="Title"
                                            value={draft.title}
                                            onChange={(event) => handleDraftField('title', event.target.value)}
                                            placeholder="Terms of Service / AGB"
                                        />
                                    </label>
                                    <label className={fieldLabelClass}>
                                        Last updated
                                        <Input
                                            type="date"
                                            aria-label="Last updated"
                                            value={normalizeDateInput(draft.lastUpdated)}
                                            onChange={(event) => {
                                                const nextDate = normalizeDateInput(event.target.value);
                                                const nextRevision = getNextTermsRevision(nextDate, existingVersionIds);
                                                setDraft((previous) => (previous ? {
                                                    ...previous,
                                                    lastUpdated: nextDate,
                                                    versionDate: nextDate,
                                                    versionRevision: nextRevision,
                                                } : previous));
                                            }}
                                        />
                                        <span className={fieldHintClass}>Shown to users on the terms page. Also sets the version date.</span>
                                    </label>
                                </div>
                                <label className={fieldLabelClass}>
                                    What changed (internal)
                                    <Textarea
                                        aria-label="Summary"
                                        value={draft.summary}
                                        onChange={(event) => handleDraftField('summary', event.target.value)}
                                        className="min-h-[72px]"
                                        placeholder="One or two sentences for the version history."
                                    />
                                </label>
                                <details className="group rounded-md border border-border px-3 py-2 text-sm">
                                    <summary className="cursor-pointer select-none text-sm text-foreground">
                                        Version number <span className="font-medium tabular-nums">{publishVersion}</span>
                                        <span className="ms-2 text-xs text-muted-foreground">Change</span>
                                    </summary>
                                    <div className="mt-3 flex flex-wrap items-end gap-3">
                                        <label className={fieldLabelClass}>
                                            Revision suffix
                                            <Input
                                                type="number"
                                                aria-label="Revision suffix"
                                                min={0}
                                                step={1}
                                                value={draft.versionRevision}
                                                onChange={(event) => handleDraftField('versionRevision', normalizeRevision(Number(event.target.value)))}
                                                className="w-32 tabular-nums"
                                            />
                                        </label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDraftField('versionRevision', suggestedNextRevision)}
                                            disabled={isPublishing || draft.versionRevision === suggestedNextRevision}
                                        >
                                            Use next free suffix
                                        </Button>
                                        <p className={cn(fieldHintClass, 'basis-full')}>
                                            0 publishes {draft.versionDate}; 1 publishes {draft.versionDate}-1. A suffix that is already taken moves to the next free one automatically.
                                        </p>
                                    </div>
                                </details>
                            </section>

                            <section className="flex flex-col gap-3 border-t border-border pt-6" aria-labelledby="legal-terms-step-rollout">
                                <AdminSectionHeader
                                    as="h3"
                                    title={<span id="legal-terms-step-rollout">3. Choose the rollout and publish</span>}
                                />
                                <div role="radiogroup" aria-label="Rollout" className="grid gap-3 md:grid-cols-2">
                                    {ROLLOUT_OPTIONS.map((option) => {
                                        const checked = (option.value === 'force') === draft.requiresReaccept;
                                        return (
                                            <label
                                                key={option.value}
                                                className={cn(
                                                    'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                                                    checked ? 'border-primary bg-muted/60' : 'border-border hover:bg-muted/40',
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="legal-terms-rollout"
                                                    value={option.value}
                                                    checked={checked}
                                                    onChange={() => handleDraftField('requiresReaccept', option.value === 'force')}
                                                    className="mt-1 accent-primary"
                                                />
                                                <span>
                                                    <span className="font-medium text-foreground">{option.label}</span>
                                                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        Publishes {publishVersion} · {rolloutLabel(draft.requiresReaccept).toLowerCase()}
                                    </span>
                                    <Button
                                        type="button"
                                        onClick={() => void handlePublish()}
                                        disabled={isPublishing}
                                        {...getAnalyticsDebugAttributes('admin__legal_terms--publish')}
                                    >
                                        {isPublishing ? 'Publishing…' : 'Publish version'}
                                    </Button>
                                </div>
                            </section>
                        </>
                    )}
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Version history"
                        description="Every published version, newest first. Use a row's menu to start a draft from it or make it live again."
                    />

                    {isLoading && versions.length === 0 ? (
                        <p className="text-sm text-muted-foreground" role="status">Loading version history…</p>
                    ) : versions.length === 0 ? (
                        <AdminEmptyState
                            icon={<FileText />}
                            title="No terms versions found"
                            description="Published versions appear here with their rollout mode."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Rollout</TableHead>
                                    <TableHead>Effective</TableHead>
                                    <TableHead className="hidden lg:table-cell">What changed</TableHead>
                                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {versions.map((version) => (
                                    <TableRow key={version.version}>
                                        <TableCell className="max-w-[280px]">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium tabular-nums text-foreground">{version.version}</span>
                                                {version.isCurrent && <AdminStatusBadge tone="success">Live</AdminStatusBadge>}
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground">{version.title}</div>
                                        </TableCell>
                                        <TableCell>
                                            <AdminStatusBadge tone={version.requiresReaccept ? 'warning' : 'info'}>
                                                {rolloutLabel(version.requiresReaccept)}
                                            </AdminStatusBadge>
                                        </TableCell>
                                        <TableCell className="text-sm text-foreground">
                                            <span data-tooltip={`Effective ${formatDateTime(version.effectiveAt)} · last updated ${normalizeDateInput(version.lastUpdated)}`}>
                                                {formatRelativeDate(version.effectiveAt)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="hidden max-w-[420px] text-xs text-muted-foreground lg:table-cell">
                                            <span className="line-clamp-2">{version.summary || '—'}</span>
                                        </TableCell>
                                        <TableCell className="text-end">
                                            <VersionRowActions
                                                version={version}
                                                disabled={isPublishing}
                                                onUseAsBasis={() => void handleUseVersionAsBase(version)}
                                                onSetCurrent={(requiresReaccept) => void handleSetCurrent(version.version, requiresReaccept)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
