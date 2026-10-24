import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import {
    ArrowSquareOut,
    CheckCircle,
    Database,
    FloppyDisk,
    GlobeHemisphereWest,
    Info,
    PencilSimple,
    SpinnerGap,
    Trash,
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
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { showAppToast } from '../components/ui/appToast';
import { cn } from '../lib/utils';
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
type StatusFilter = 'all' | 'base' | 'draft' | 'published';

interface Selection {
    targetKind: AdminDestinationTargetKind;
    targetId: string;
}

const emptyCatalog: AdminDestinationCatalogResponse = {
    guides: [], profiles: [], overrides: [], importRuns: [], referralCount: 0,
};

const overrideKey = (targetKind: AdminDestinationTargetKind, targetId: string) => `${targetKind}:${targetId}`;

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

const formatDate = (value: unknown): string => {
    if (typeof value !== 'string' || !value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const openGuidePath = (guide: AdminDestinationGuideRow, guides: AdminDestinationGuideRow[]): string => {
    if (guide.kind === 'country') return `/inspirations/country/${guide.slug}`;
    const parent = guides.find((candidate) => candidate.id === guide.parent_id);
    return parent ? `/inspirations/country/${parent.slug}/${guide.slug}` : `/inspirations`;
};

export const AdminDestinationsPage: React.FC = () => {
    const dialog = useAppDialog();
    const [catalog, setCatalog] = useState(emptyCatalog);
    const [view, setView] = useState<CatalogView>('guides');
    const [kind, setKind] = useState<KindFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
    const [selection, setSelection] = useState<Selection | null>(null);
    const [editorStatus, setEditorStatus] = useState<AdminDestinationOverrideStatus>('draft');
    const [editorNote, setEditorNote] = useState('');
    const [editorJson, setEditorJson] = useState('{}');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCatalog = async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await adminGetDestinationCatalog();
            setCatalog(next);
            setSelection((current) => current || (next.guides[0] ? { targetKind: 'guide', targetId: next.guides[0].id } : null));
        } catch (loadError) {
            setError(toAdminErrorMessage(loadError, 'Could not load destination content.', 'admin-destinations'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void loadCatalog(); }, []);

    const overridesByTarget = useMemo(() => new Map(
        catalog.overrides.map((entry) => [overrideKey(entry.target_kind, entry.target_id), entry]),
    ), [catalog.overrides]);

    const filteredGuides = useMemo(() => catalog.guides.filter((guide) => {
        const override = overridesByTarget.get(overrideKey('guide', guide.id));
        const matchesQuery = !deferredQuery || `${guide.name} ${guide.slug} ${guide.country_code} ${guide.region}`.toLocaleLowerCase().includes(deferredQuery);
        const matchesKind = kind === 'all' || guide.kind === kind;
        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'base' ? !override : override?.status === statusFilter);
        return matchesQuery && matchesKind && matchesStatus;
    }), [catalog.guides, deferredQuery, kind, overridesByTarget, statusFilter]);

    const filteredProfiles = useMemo(() => catalog.profiles.filter((profile) => {
        const override = overridesByTarget.get(overrideKey('country_profile', profile.country_code));
        const matchesQuery = !deferredQuery || `${profile.name} ${profile.slug} ${profile.country_code} ${profile.region}`.toLocaleLowerCase().includes(deferredQuery);
        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'base' ? !override : override?.status === statusFilter);
        return matchesQuery && matchesStatus;
    }), [catalog.profiles, deferredQuery, overridesByTarget, statusFilter]);

    const selectedGuide = selection?.targetKind === 'guide'
        ? catalog.guides.find((guide) => guide.id === selection.targetId) || null
        : null;
    const selectedProfile = selection?.targetKind === 'country_profile'
        ? catalog.profiles.find((profile) => profile.country_code === selection.targetId) || null
        : null;
    const selectedOverride = selection
        ? overridesByTarget.get(overrideKey(selection.targetKind, selection.targetId)) || null
        : null;
    const selectedBase = selectedGuide?.payload || (selectedProfile ? profilePublicBase(selectedProfile) : null);
    const effectivePreview = selectedBase
        ? deepMergeDestinationContent(selectedBase, selectedOverride?.patch || {})
        : null;

    const selectItem = (next: Selection, existing: AdminDestinationOverrideRow | undefined) => {
        setSelection(next);
        setEditorStatus(existing?.status || 'draft');
        setEditorNote(existing?.note || '');
        setEditorJson(JSON.stringify(existing?.patch || {}, null, 2));
        setError(null);
    };

    const save = async () => {
        if (!selection) return;
        let patch: unknown;
        try { patch = JSON.parse(editorJson); } catch { setError('The override must be valid JSON.'); return; }
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            setError('The override must be a JSON object.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const saved = await adminSaveDestinationOverride({
                ...selection, status: editorStatus, patch: patch as Record<string, unknown>, note: editorNote,
            });
            setCatalog((current) => ({
                ...current,
                overrides: [saved, ...current.overrides.filter((entry) => entry.id !== saved.id)],
            }));
            showAppToast({ title: editorStatus === 'published' ? 'Destination override published' : 'Destination draft saved', tone: 'success' });
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
            setEditorStatus('draft'); setEditorNote(''); setEditorJson('{}');
            showAppToast({ title: 'Destination override reset', tone: 'success' });
        } catch (resetError) {
            setError(toAdminErrorMessage(resetError, 'Could not reset the override.', 'admin-destinations'));
        } finally {
            setSaving(false);
        }
    };

    const latestRun = catalog.importRuns[0];
    const selectedName = selectedGuide?.name || selectedProfile?.name || 'Select an item';
    const publicPath = selectedGuide
        ? openGuidePath(selectedGuide, catalog.guides)
        : selectedProfile ? `/inspirations/country/${selectedProfile.slug}` : null;

    const renderOverrideBadge = (existing: AdminDestinationOverrideRow | undefined) => (
        <AdminStatusBadge tone={existing?.status === 'published' ? 'success' : existing ? 'warning' : 'neutral'}>
            {existing?.status === 'published' ? 'Published' : existing ? 'Draft' : 'Base'}
        </AdminStatusBadge>
    );

    const listRowClass = (active: boolean) => cn(
        'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-start transition-colors',
        active
            ? 'border-accent-300 bg-accent-50 dark:border-accent-400/30 dark:bg-accent-400/12'
            : 'border-transparent hover:bg-muted/50',
    );

    const visibleCount = view === 'guides' ? filteredGuides.length : filteredProfiles.length;

    return (
        <AdminShell
            title="Destinations"
            description="Browse imported destination content and layer editorial changes over future refreshes."
            searchValue={query}
            onSearchValueChange={setQuery}
            showDateRange={false}
            actions={(
                <AdminReloadButton onClick={() => void loadCatalog()} isLoading={loading} label="Refresh" />
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard label="Guides" icon={<GlobeHemisphereWest />} value={catalog.guides.length} isLoading={loading} />
                    <AdminStatCard label="Country profiles" icon={<Database />} value={catalog.profiles.length} isLoading={loading} />
                    <AdminStatCard label="Editorial overrides" icon={<PencilSimple />} value={catalog.overrides.length} isLoading={loading} />
                    <AdminStatCard label="Referral records" icon={<CheckCircle />} value={catalog.referralCount} isLoading={loading} />
                </div>

                {latestRun && (
                    <Alert>
                        <Info />
                        <AlertDescription>
                            <p>
                                Latest import: <strong className="font-medium text-foreground">{String(latestRun.provider || 'unknown')}</strong>
                                {' · '}{String(latestRun.status || 'unknown')}
                                {' · '}{formatDate(latestRun.completed_at || latestRun.started_at)}
                            </p>
                        </AlertDescription>
                    </Alert>
                )}
                {error && <AdminErrorAlert message={error} />}

                <div className="grid gap-4 xl:min-h-[640px] xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
                    <AdminSurfaceCard className="flex min-h-0 min-w-0 flex-col p-0">
                        <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-3">
                            <Select value={view} onValueChange={(value) => { setView(value as CatalogView); setKind('all'); }}>
                                <SelectTrigger aria-label="Catalog"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="guides">Guides</SelectItem><SelectItem value="profiles">Country profiles</SelectItem></SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                                <SelectTrigger aria-label="Override status"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="base">No override</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent>
                            </Select>
                            {view === 'guides' ? (
                                <Select value={kind} onValueChange={(value) => setKind(value as KindFilter)}>
                                    <SelectTrigger aria-label="Destination type"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="country">Countries</SelectItem><SelectItem value="city">Cities</SelectItem><SelectItem value="island">Islands</SelectItem></SelectContent>
                                </Select>
                            ) : (
                                <div className="flex h-9 items-center rounded-md bg-secondary px-3 text-sm tabular-nums text-muted-foreground">{filteredProfiles.length} profiles</div>
                            )}
                        </div>
                        <div className="max-h-[720px] flex-1 overflow-y-auto p-2">
                            {loading ? (
                                <div className="flex h-48 items-center justify-center text-muted-foreground" role="status" aria-label="Loading destinations">
                                    <SpinnerGap size={24} className="animate-spin" />
                                </div>
                            ) : null}
                            {!loading && visibleCount === 0 && (
                                <AdminEmptyState
                                    className="m-2"
                                    title="No matching items"
                                    description="Clear the search or change the filters to see more destinations."
                                />
                            )}
                            {!loading && view === 'guides' && filteredGuides.map((guide) => {
                                const existing = overridesByTarget.get(overrideKey('guide', guide.id));
                                const active = selection?.targetKind === 'guide' && selection.targetId === guide.id;
                                return (
                                    <button key={guide.id} type="button" aria-pressed={active} onClick={() => selectItem({ targetKind: 'guide', targetId: guide.id }, existing)} className={listRowClass(active)}>
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">{guide.name}</div>
                                            <div className="mt-0.5 truncate text-xs text-muted-foreground"><span className="capitalize">{guide.kind}</span> · {guide.country_code} · {guide.region}</div>
                                        </div>
                                        {renderOverrideBadge(existing)}
                                    </button>
                                );
                            })}
                            {!loading && view === 'profiles' && filteredProfiles.map((profile) => {
                                const existing = overridesByTarget.get(overrideKey('country_profile', profile.country_code));
                                const active = selection?.targetKind === 'country_profile' && selection.targetId === profile.country_code;
                                return (
                                    <button key={profile.country_code} type="button" aria-pressed={active} onClick={() => selectItem({ targetKind: 'country_profile', targetId: profile.country_code }, existing)} className={listRowClass(active)}>
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">{profile.name}</div>
                                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{profile.country_code} · {profile.region} · {profile.source_provider}</div>
                                        </div>
                                        {renderOverrideBadge(existing)}
                                    </button>
                                );
                            })}
                        </div>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader
                            className="border-b border-border pb-4"
                            title={selectedName}
                            description={selectedOverride ? `Editorial override · updated ${formatDate(selectedOverride.updated_at)}` : 'Editorial override'}
                            actions={publicPath ? (
                                <Button asChild variant="outline" size="sm">
                                    <a href={publicPath} target="_blank" rel="noreferrer">Open page <ArrowSquareOut /></a>
                                </Button>
                            ) : null}
                        />
                        {selection ? (
                            <div className="flex flex-col gap-4">
                                {selectedProfile && (
                                    <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                                        <div className="font-medium text-foreground">Source provenance</div>
                                        <a className="mt-1 block break-all text-accent-700 hover:underline dark:text-accent-200" href={selectedProfile.origin_url} target="_blank" rel="noreferrer">{selectedProfile.origin_url}</a>
                                        <div className="mt-1 text-xs text-muted-foreground">Fetched {formatDate(selectedProfile.source_fetched_at)}</div>
                                    </div>
                                )}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="destination-override-status" className="text-xs font-medium text-muted-foreground">Status</label>
                                        <Select value={editorStatus} onValueChange={(value) => setEditorStatus(value as AdminDestinationOverrideStatus)}>
                                            <SelectTrigger id="destination-override-status"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="draft">Draft — admin only</SelectItem><SelectItem value="published">Published — public</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="destination-override-note" className="text-xs font-medium text-muted-foreground">Editor note</label>
                                        <Input id="destination-override-note" value={editorNote} onChange={(event) => setEditorNote(event.target.value)} placeholder="Why is this changed?" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="destination-override-patch" className="text-xs font-medium text-muted-foreground">Override patch</label>
                                    <textarea
                                        id="destination-override-patch"
                                        value={editorJson}
                                        onChange={(event) => setEditorJson(event.target.value)}
                                        spellCheck={false}
                                        className="min-h-64 w-full resize-y rounded-md border border-border bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        aria-describedby="destination-override-help"
                                    />
                                    <p id="destination-override-help" className="text-xs leading-5 text-muted-foreground">Only include fields you want to change. Nested objects merge; arrays replace the complete source array. Identity and provenance fields cannot be overridden.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
                                        {saving ? <SpinnerGap className="animate-spin" /> : <FloppyDisk />} {editorStatus === 'published' ? 'Publish override' : 'Save draft'}
                                    </Button>
                                    {selectedOverride && (
                                        <Button type="button" variant="destructive" onClick={() => void reset()} disabled={saving}>
                                            <Trash /> Reset override
                                        </Button>
                                    )}
                                </div>
                                <details className="rounded-md border border-border">
                                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">Effective content preview</summary>
                                    <pre className="max-h-80 overflow-auto border-t border-border bg-muted/50 p-4 text-xs leading-5 text-foreground">{JSON.stringify(effectivePreview, null, 2)}</pre>
                                </details>
                            </div>
                        ) : (
                            <AdminEmptyState title="Nothing selected" description="Select a destination item to inspect it." className="min-h-64" />
                        )}
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
