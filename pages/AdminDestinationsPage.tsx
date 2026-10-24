import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import {
    ArrowSquareOut,
    CloudArrowDown,
    FloppyDisk,
    PencilSimple,
    SpinnerGap,
    Trash,
    UploadSimple,
} from '@phosphor-icons/react';
import { useAppDialog } from '../components/AppDialogProvider';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminEditorListItem } from '../components/admin/AdminEditorListItem';
import {
    countByStatus,
    formatAdminAbsoluteTime,
    formatAdminRelativeTime,
    isStackedEditorLayout,
    parseOverridePatch,
} from '../components/admin/adminContentEditorModel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { showAppToast } from '../components/ui/appToast';
import { cn } from '../lib/utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    adminDeleteDestinationOverride,
    adminGetDestinationCatalog,
    adminSaveDestinationOverride,
    type AdminDestinationCatalogResponse,
    type AdminDestinationGuideRow,
    type AdminDestinationOverrideRow,
    type AdminDestinationOverrideStatus,
    type AdminDestinationProfileRow,
    type AdminDestinationTargetKind,
} from '../services/adminService';
import { deepMergeDestinationContent } from '../shared/destinationContentOverrides';

type CatalogView = 'guides' | 'profiles';
type KindFilter = 'all' | 'country' | 'city' | 'island';
type OverrideState = 'base' | 'draft' | 'published';
type StatusFilter = 'all' | OverrideState;

interface Selection {
    targetKind: AdminDestinationTargetKind;
    targetId: string;
}

interface EditorDraft {
    status: AdminDestinationOverrideStatus;
    note: string;
    json: string;
}

const emptyCatalog: AdminDestinationCatalogResponse = {
    guides: [], profiles: [], overrides: [], importRuns: [], referralCount: 0,
};

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
    all: 'All statuses',
    base: 'No override',
    draft: 'Draft',
    published: 'Published',
};

const KIND_FILTER_LABEL: Record<KindFilter, string> = {
    all: 'All types',
    country: 'Countries',
    city: 'Cities',
    island: 'Islands',
};

const overrideKey = (targetKind: AdminDestinationTargetKind, targetId: string) => `${targetKind}:${targetId}`;

const overrideStateOf = (override: AdminDestinationOverrideRow | undefined | null): OverrideState => (
    !override ? 'base' : override.status === 'published' ? 'published' : 'draft'
);

const draftFromOverride = (override: AdminDestinationOverrideRow | undefined | null): EditorDraft => ({
    status: override?.status || 'draft',
    note: override?.note || '',
    json: JSON.stringify(override?.patch || {}, null, 2),
});

const profilePublicBase = (profile: AdminDestinationProfileRow): Record<string, unknown> => ({
    currencyCode: profile.currency_code ?? null,
    timezone: profile.timezone ?? null,
    callingCode: profile.calling_code ?? null,
    popularity: profile.popularity ?? null,
    summary: profile.summary ?? null,
    alertMessage: profile.alert_message ?? null,
    safetyTips: profile.safety_tips ?? [],
    bonusTips: profile.bonus_tips ?? [],
    sections: profile.static_sections ?? {},
    faqs: profile.faqs ?? [],
    recentUpdates: profile.recent_updates ?? [],
    airports: profile.airports ?? [],
    beaches: profile.beaches ?? [],
    cities: profile.cities ?? [],
    weather: profile.weather ?? [],
    exchange: { rate: profile.exchange_rate ?? null, base: profile.exchange_base ?? null },
});

const openGuidePath = (guide: AdminDestinationGuideRow, guides: AdminDestinationGuideRow[]): string => {
    if (guide.kind === 'country') return `/inspirations/country/${guide.slug}`;
    const parent = guides.find((candidate) => candidate.id === guide.parent_id);
    return parent ? `/inspirations/country/${parent.slug}/${guide.slug}` : `/inspirations`;
};

const OverrideBadge: React.FC<{ state: OverrideState }> = ({ state }) => (
    <AdminStatusBadge tone={state === 'published' ? 'success' : state === 'draft' ? 'warning' : 'neutral'}>
        {state === 'published' ? 'Published' : state === 'draft' ? 'Draft' : 'Base'}
    </AdminStatusBadge>
);

const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';

export const AdminDestinationsPage: React.FC = () => {
    const dialog = useAppDialog();
    const [catalog, setCatalog] = useState(emptyCatalog);
    const [view, setView] = useState<CatalogView>('guides');
    const [kind, setKind] = useState<KindFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
    const [selection, setSelection] = useState<Selection | null>(null);
    const [draft, setDraft] = useState<EditorDraft>(() => draftFromOverride(null));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement | null>(null);

    const loadCatalog = async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await adminGetDestinationCatalog();
            setCatalog(next);
            // The first load opens the first guide. Its editor must start from
            // that guide's saved override — starting from `{}` and saving would
            // silently wipe an existing patch.
            if (!selection && next.guides[0]) {
                const firstGuide = next.guides[0];
                const existing = next.overrides.find((entry) => entry.target_kind === 'guide' && entry.target_id === firstGuide.id);
                setSelection({ targetKind: 'guide', targetId: firstGuide.id });
                setDraft(draftFromOverride(existing));
            }
        } catch (loadError) {
            setError(toAdminErrorMessage(loadError, 'Could not load destination content.', 'admin-destinations'));
        } finally {
            setLoading(false);
        }
    };

    // The catalog is a network read on mount: an external system.
    useEffect(() => { void loadCatalog(); }, []);

    const overridesByTarget = useMemo(() => new Map(
        catalog.overrides.map((entry) => [overrideKey(entry.target_kind, entry.target_id), entry]),
    ), [catalog.overrides]);

    const guideState = (guide: AdminDestinationGuideRow) => overrideStateOf(overridesByTarget.get(overrideKey('guide', guide.id)));
    const profileState = (profile: AdminDestinationProfileRow) => overrideStateOf(overridesByTarget.get(overrideKey('country_profile', profile.country_code)));

    const matchesQuery = (haystack: string) => !deferredQuery || haystack.toLocaleLowerCase().includes(deferredQuery);

    // Search and type narrow the list first; the status counts describe that
    // narrowed set, so "Draft (3)" is what you get when you pick it.
    const searchedGuides = useMemo(() => catalog.guides.filter((guide) => (
        matchesQuery(`${guide.name} ${guide.slug} ${guide.country_code} ${guide.region}`)
        && (kind === 'all' || guide.kind === kind)
    )), [catalog.guides, deferredQuery, kind]);
    const searchedProfiles = useMemo(() => catalog.profiles.filter((profile) => (
        matchesQuery(`${profile.name} ${profile.slug} ${profile.country_code} ${profile.region}`)
    )), [catalog.profiles, deferredQuery]);

    const statusCounts = useMemo(() => (view === 'guides'
        ? countByStatus(searchedGuides, guideState)
        : countByStatus(searchedProfiles, profileState)
    ), [overridesByTarget, searchedGuides, searchedProfiles, view]);

    const filteredGuides = useMemo(
        () => (statusFilter === 'all' ? searchedGuides : searchedGuides.filter((guide) => guideState(guide) === statusFilter)),
        [overridesByTarget, searchedGuides, statusFilter],
    );
    const filteredProfiles = useMemo(
        () => (statusFilter === 'all' ? searchedProfiles : searchedProfiles.filter((profile) => profileState(profile) === statusFilter)),
        [overridesByTarget, searchedProfiles, statusFilter],
    );

    const selectedGuide = selection?.targetKind === 'guide'
        ? catalog.guides.find((guide) => guide.id === selection.targetId) || null
        : null;
    const selectedProfile = selection?.targetKind === 'country_profile'
        ? catalog.profiles.find((profile) => profile.country_code === selection.targetId) || null
        : null;
    const selectedOverride = selection
        ? overridesByTarget.get(overrideKey(selection.targetKind, selection.targetId)) || null
        : null;
    const savedDraft = draftFromOverride(selectedOverride);
    const isDirty = Boolean(selection) && (
        draft.status !== savedDraft.status || draft.note !== savedDraft.note || draft.json !== savedDraft.json
    );
    const parsedPatch = parseOverridePatch(draft.json);
    const selectedBase = selectedGuide?.payload || (selectedProfile ? profilePublicBase(selectedProfile) : null);
    // The preview follows what is typed, so an editor can check a patch before
    // saving it; while the JSON is broken it falls back to the saved patch.
    const effectivePreview = selectedBase
        ? deepMergeDestinationContent(selectedBase, (parsedPatch.ok && parsedPatch.patch) || selectedOverride?.patch || {})
        : null;

    const confirmDiscard = async (): Promise<boolean> => {
        if (!isDirty) return true;
        return dialog.confirm({
            title: 'Discard unsaved changes?',
            message: 'Your edits to this override have not been saved.',
            confirmLabel: 'Discard changes',
            cancelLabel: 'Keep editing',
            tone: 'danger',
        });
    };

    const selectItem = async (next: Selection) => {
        if (selection?.targetKind === next.targetKind && selection.targetId === next.targetId) return;
        if (!(await confirmDiscard())) return;
        setSelection(next);
        setDraft(draftFromOverride(overridesByTarget.get(overrideKey(next.targetKind, next.targetId))));
        setError(null);
        trackEvent('admin__destinations--select', { target_kind: next.targetKind });
        // Below xl the editor sits under a long list; bring it into view.
        if (isStackedEditorLayout()) editorRef.current?.scrollIntoView({ block: 'start' });
    };

    const save = async () => {
        if (!selection) return;
        if (!parsedPatch.ok || !parsedPatch.patch) {
            setError(parsedPatch.message);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const saved = await adminSaveDestinationOverride({
                ...selection, status: draft.status, patch: parsedPatch.patch, note: draft.note,
            });
            setCatalog((current) => ({
                ...current,
                overrides: [saved, ...current.overrides.filter((entry) => entry.id !== saved.id)],
            }));
            setDraft(draftFromOverride(saved));
            trackEvent('admin__destinations--save', { status: draft.status });
            showAppToast({ title: draft.status === 'published' ? 'Destination override published' : 'Destination draft saved', tone: 'success' });
        } catch (saveError) {
            setError(toAdminErrorMessage(saveError, 'Could not save the override.', 'admin-destinations'));
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        if (!selection || !selectedOverride) return;
        const confirmed = await dialog.confirm({
            title: 'Reset destination override?',
            message: 'This removes the editorial patch and returns the item to its imported base content.',
            confirmLabel: 'Reset override', tone: 'danger',
        });
        if (!confirmed) return;
        setSaving(true);
        try {
            await adminDeleteDestinationOverride(selection.targetKind, selection.targetId);
            setCatalog((current) => ({ ...current, overrides: current.overrides.filter((entry) => entry.id !== selectedOverride.id) }));
            setDraft(draftFromOverride(null));
            trackEvent('admin__destinations--reset_override');
            showAppToast({ title: 'Destination override reset', tone: 'success' });
        } catch (resetError) {
            setError(toAdminErrorMessage(resetError, 'Could not reset the override.', 'admin-destinations'));
        } finally {
            setSaving(false);
        }
    };

    const changeView = (next: string) => {
        setView(next as CatalogView);
        setKind('all');
        trackEvent('admin__destinations--view', { view: next });
    };

    const hasActiveFilter = statusFilter !== 'all' || kind !== 'all' || query.trim() !== '';
    const resetFilters = () => {
        setStatusFilter('all');
        setKind('all');
        setQuery('');
        trackEvent('admin__destinations--reset_filters');
    };

    const latestRun = catalog.importRuns[0];
    const latestRunAt = latestRun ? (latestRun.completed_at || latestRun.started_at) : null;
    const draftCount = catalog.overrides.filter((entry) => entry.status !== 'published').length;
    const publishedCount = catalog.overrides.length - draftCount;
    const selectedName = selectedGuide?.name || selectedProfile?.name || 'Nothing selected';
    const selectedSubtitle = selectedGuide
        ? [selectedGuide.kind, selectedGuide.country_code, selectedGuide.region].filter(Boolean).join(' · ')
        : selectedProfile ? ['Country profile', selectedProfile.country_code, selectedProfile.region].filter(Boolean).join(' · ') : '';
    const publicPath = selectedGuide
        ? openGuidePath(selectedGuide, catalog.guides)
        : selectedProfile ? `/inspirations/country/${selectedProfile.slug}` : null;

    const visibleCount = view === 'guides' ? filteredGuides.length : filteredProfiles.length;
    const totalInView = view === 'guides' ? catalog.guides.length : catalog.profiles.length;

    return (
        <AdminShell
            title="Destinations"
            description="Layer editorial changes over imported destination content. Overrides survive future imports."
            searchValue={query}
            onSearchValueChange={setQuery}
            showDateRange={false}
            actions={(
                <AdminReloadButton onClick={() => void loadCatalog()} isLoading={loading} label="Refresh" />
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                    <AdminStatCard
                        label="Unpublished drafts"
                        icon={<PencilSimple />}
                        value={draftCount}
                        hint={draftCount > 0 ? 'Only admins see these. Publish them to go live.' : 'Nothing waiting to be published.'}
                        hintTone={draftCount > 0 ? 'warning' : 'neutral'}
                        isLoading={loading}
                    />
                    <AdminStatCard
                        label="Published overrides"
                        icon={<UploadSimple />}
                        value={publishedCount}
                        hint="Live over the imported content."
                        isLoading={loading}
                    />
                    <AdminStatCard
                        label="Latest import"
                        icon={<CloudArrowDown />}
                        value={(
                            <span className="block truncate text-xl" data-tooltip={latestRunAt ? formatAdminAbsoluteTime(latestRunAt) : undefined}>
                                {latestRun ? formatAdminRelativeTime(latestRunAt) : 'None yet'}
                            </span>
                        )}
                        hint={latestRun
                            ? `${String(latestRun.provider || 'Unknown source')} · ${String(latestRun.status || 'unknown')} · ${catalog.referralCount.toLocaleString()} referral links`
                            : `${catalog.referralCount.toLocaleString()} referral links`}
                        hintTone={latestRun && /fail|error/i.test(String(latestRun.status || '')) ? 'negative' : 'neutral'}
                        isLoading={loading}
                    />
                </div>

                {error && <AdminErrorAlert message={error} />}

                <div className="grid gap-4 xl:min-h-[640px] xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
                    <AdminSurfaceCard className="flex min-h-0 min-w-0 flex-col p-0">
                        <div className="flex flex-col gap-3 border-b border-border p-4">
                            <Tabs value={view} onValueChange={changeView}>
                                <TabsList className="w-full">
                                    <TabsTrigger value="guides" {...getAnalyticsDebugAttributes('admin__destinations--view', { view: 'guides' })}>
                                        Guides <span className="tabular-nums opacity-70">{catalog.guides.length}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="profiles" {...getAnalyticsDebugAttributes('admin__destinations--view', { view: 'profiles' })}>
                                        Country profiles <span className="tabular-nums opacity-70">{catalog.profiles.length}</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                                    <SelectTrigger aria-label="Override status" className="w-auto min-w-36"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {STATUS_FILTER_LABEL[value]}
                                                {value !== 'all' && <span className="ms-1 tabular-nums text-muted-foreground">({statusCounts[value] ?? 0})</span>}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {view === 'guides' && (
                                    <Select value={kind} onValueChange={(value) => setKind(value as KindFilter)}>
                                        <SelectTrigger aria-label="Destination type" className="w-auto min-w-32"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {(Object.keys(KIND_FILTER_LABEL) as KindFilter[]).map((value) => (
                                                <SelectItem key={value} value={value}>{KIND_FILTER_LABEL[value]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {hasActiveFilter && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        {...getAnalyticsDebugAttributes('admin__destinations--reset_filters')}
                                    >
                                        Reset
                                    </Button>
                                )}
                                <span className="ms-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
                                    {loading ? '' : `${visibleCount.toLocaleString()} of ${totalInView.toLocaleString()}`}
                                </span>
                            </div>
                        </div>
                        <div className="max-h-[720px] flex-1 overflow-y-auto p-2">
                            {loading && (
                                <div className="flex h-48 items-center justify-center text-muted-foreground" role="status" aria-label="Loading destinations">
                                    <SpinnerGap size={24} className="animate-spin" />
                                </div>
                            )}
                            {!loading && visibleCount === 0 && (
                                <AdminEmptyState
                                    className="m-2"
                                    title={totalInView === 0 ? 'No destination content yet' : 'No matching items'}
                                    description={totalInView === 0
                                        ? 'Run the destination import and sync described in the ingestion runbook, then refresh.'
                                        : 'Clear the search or reset the filters to see more destinations.'}
                                    action={totalInView > 0 && hasActiveFilter ? (
                                        <Button type="button" variant="outline" size="sm" onClick={resetFilters}>Reset filters</Button>
                                    ) : undefined}
                                />
                            )}
                            {!loading && view === 'guides' && filteredGuides.map((guide) => (
                                <AdminEditorListItem
                                    key={guide.id}
                                    active={selection?.targetKind === 'guide' && selection.targetId === guide.id}
                                    onClick={() => void selectItem({ targetKind: 'guide', targetId: guide.id })}
                                    title={guide.name}
                                    subtitle={<><span className="capitalize">{guide.kind}</span> · {guide.country_code} · {guide.region}</>}
                                    badge={<OverrideBadge state={guideState(guide)} />}
                                />
                            ))}
                            {!loading && view === 'profiles' && filteredProfiles.map((profile) => (
                                <AdminEditorListItem
                                    key={profile.country_code}
                                    active={selection?.targetKind === 'country_profile' && selection.targetId === profile.country_code}
                                    onClick={() => void selectItem({ targetKind: 'country_profile', targetId: profile.country_code })}
                                    title={profile.name}
                                    subtitle={`${profile.country_code} · ${profile.region} · ${profile.source_provider}`}
                                    badge={<OverrideBadge state={profileState(profile)} />}
                                />
                            ))}
                        </div>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard ref={editorRef} className="flex min-w-0 scroll-mt-4 flex-col gap-4 p-0">
                        <AdminSectionHeader
                            className="border-b border-border p-4"
                            title={selectedName}
                            description={selection ? (
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="capitalize">{selectedSubtitle}</span>
                                    <OverrideBadge state={overrideStateOf(selectedOverride)} />
                                    {selectedOverride && (
                                        <span data-tooltip={formatAdminAbsoluteTime(selectedOverride.updated_at)}>
                                            Updated {formatAdminRelativeTime(selectedOverride.updated_at)}
                                        </span>
                                    )}
                                </span>
                            ) : 'Pick an item from the list to edit its override.'}
                            actions={publicPath ? (
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href={publicPath}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={() => trackEvent('admin__destinations--open_page')}
                                        {...getAnalyticsDebugAttributes('admin__destinations--open_page')}
                                    >
                                        Open page <ArrowSquareOut />
                                    </a>
                                </Button>
                            ) : null}
                        />
                        {selection ? (
                            <>
                                <div className="flex flex-col gap-4 px-4">
                                    {selectedProfile && (
                                        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                                            <div className="font-medium text-foreground">Source provenance</div>
                                            <a className="mt-1 block break-all text-accent-700 hover:underline dark:text-accent-200" href={selectedProfile.origin_url} target="_blank" rel="noreferrer">{selectedProfile.origin_url}</a>
                                            <div className="mt-1 text-xs text-muted-foreground" data-tooltip={formatAdminAbsoluteTime(selectedProfile.source_fetched_at)}>
                                                Fetched {formatAdminRelativeTime(selectedProfile.source_fetched_at)}
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="flex flex-col gap-1.5">
                                            <label htmlFor="destination-override-status" className={FIELD_LABEL_CLASS}>Status</label>
                                            <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as AdminDestinationOverrideStatus }))}>
                                                <SelectTrigger id="destination-override-status"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="draft">Draft — admin only</SelectItem><SelectItem value="published">Published — public</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label htmlFor="destination-override-note" className={FIELD_LABEL_CLASS}>Editor note</label>
                                            <Input id="destination-override-note" value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Why is this changed?" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="destination-override-patch" className={FIELD_LABEL_CLASS}>Override patch</label>
                                        <textarea
                                            id="destination-override-patch"
                                            value={draft.json}
                                            onChange={(event) => setDraft((current) => ({ ...current, json: event.target.value }))}
                                            spellCheck={false}
                                            aria-invalid={!parsedPatch.ok || undefined}
                                            className={cn(
                                                'min-h-64 w-full resize-y rounded-md border bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus-visible:ring-[3px]',
                                                parsedPatch.ok
                                                    ? 'border-border focus-visible:border-ring focus-visible:ring-ring/50'
                                                    : 'border-red-500 focus-visible:ring-red-500/30 dark:border-red-400',
                                            )}
                                            aria-describedby="destination-override-help"
                                        />
                                        <p id="destination-override-help" className={cn('text-xs leading-5', parsedPatch.ok ? 'text-muted-foreground' : 'text-red-700 dark:text-red-300')}>
                                            {parsedPatch.ok
                                                ? 'Only include fields you want to change. Nested objects merge; arrays replace the complete source array. Identity and provenance fields cannot be overridden.'
                                                : parsedPatch.message}
                                        </p>
                                    </div>
                                    <details className="rounded-md border border-border">
                                        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">Effective content preview</summary>
                                        <pre className="max-h-80 overflow-auto border-t border-border bg-muted/50 p-4 text-xs leading-5 text-foreground">{JSON.stringify(effectivePreview, null, 2)}</pre>
                                    </details>
                                </div>
                                <div className="sticky bottom-0 mt-auto flex flex-wrap items-center gap-2 rounded-b-lg border-t border-border bg-card px-4 py-3">
                                    <Button
                                        type="button"
                                        onClick={() => void save()}
                                        disabled={saving || !parsedPatch.ok}
                                        aria-busy={saving || undefined}
                                        {...getAnalyticsDebugAttributes('admin__destinations--save')}
                                    >
                                        {saving ? <SpinnerGap className="animate-spin" /> : <FloppyDisk />} {draft.status === 'published' ? 'Publish override' : 'Save draft'}
                                    </Button>
                                    {isDirty && <span className="text-xs text-muted-foreground" role="status">Unsaved changes</span>}
                                    {selectedOverride && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            className="ms-auto"
                                            onClick={() => void reset()}
                                            disabled={saving}
                                            {...getAnalyticsDebugAttributes('admin__destinations--reset_override')}
                                        >
                                            <Trash /> Reset override
                                        </Button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <AdminEmptyState title="Nothing selected" description="Select a destination item to inspect it." className="m-4 min-h-64" />
                        )}
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
