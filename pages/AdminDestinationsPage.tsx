import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    ArrowsClockwise,
    ArrowSquareOut,
    CheckCircle,
    Database,
    FloppyDisk,
    GlobeHemisphereWest,
    PencilSimple,
    SpinnerGap,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';
import { useAppDialog } from '../components/AppDialogProvider';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
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
            setError(loadError instanceof Error ? loadError.message : 'Could not load destination content.');
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
            setError(saveError instanceof Error ? saveError.message : 'Could not save the override.');
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
            setError(resetError instanceof Error ? resetError.message : 'Could not reset the override.');
        } finally {
            setSaving(false);
        }
    };

    const latestRun = catalog.importRuns[0];
    const selectedName = selectedGuide?.name || selectedProfile?.name || 'Select an item';
    const publicPath = selectedGuide
        ? openGuidePath(selectedGuide, catalog.guides)
        : selectedProfile ? `/inspirations/country/${selectedProfile.slug}` : null;

    return (
        <AdminShell
            title="Destinations"
            description="Browse imported destination content and layer persistent editorial changes over future refreshes."
            searchValue={query}
            onSearchValueChange={setQuery}
            showDateRange={false}
            actions={(
                <button type="button" onClick={() => void loadCatalog()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            )}
        >
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['Guides', catalog.guides.length, GlobeHemisphereWest],
                        ['Country profiles', catalog.profiles.length, Database],
                        ['Editorial overrides', catalog.overrides.length, PencilSimple],
                        ['Referral records', catalog.referralCount, CheckCircle],
                    ].map(([label, value, Icon]) => (
                        <AdminSurfaceCard key={String(label)} className="flex items-center justify-between">
                            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{String(label)}</div><div className="mt-1 text-2xl font-bold text-slate-950">{String(value)}</div></div>
                            {React.createElement(Icon as React.ComponentType<{ size: number }>, { size: 24 })}
                        </AdminSurfaceCard>
                    ))}
                </div>

                {latestRun && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Latest import: <strong>{String(latestRun.source_provider || 'unknown')}</strong> · {String(latestRun.status || 'unknown')} · {formatDate(latestRun.finished_at || latestRun.started_at)}</div>}
                {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><WarningCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}

                <div className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(380px,0.9fr)_minmax(520px,1.1fr)]">
                    <AdminSurfaceCard className="flex min-h-0 flex-col p-0">
                        <div className="grid gap-2 border-b border-slate-200 p-4 sm:grid-cols-3">
                            <Select value={view} onValueChange={(value) => { setView(value as CatalogView); setKind('all'); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guides">Guides</SelectItem><SelectItem value="profiles">Country profiles</SelectItem></SelectContent></Select>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="base">No override</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select>
                            {view === 'guides' ? <Select value={kind} onValueChange={(value) => setKind(value as KindFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="country">Countries</SelectItem><SelectItem value="city">Cities</SelectItem><SelectItem value="island">Islands</SelectItem></SelectContent></Select> : <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">{filteredProfiles.length} profiles</div>}
                        </div>
                        <div className="max-h-[720px] flex-1 overflow-y-auto p-2">
                            {loading ? <div className="flex h-48 items-center justify-center text-slate-500"><SpinnerGap size={24} className="animate-spin" /></div> : null}
                            {!loading && view === 'guides' && filteredGuides.map((guide) => {
                                const existing = overridesByTarget.get(overrideKey('guide', guide.id));
                                const active = selection?.targetKind === 'guide' && selection.targetId === guide.id;
                                return <button key={guide.id} type="button" onClick={() => selectItem({ targetKind: 'guide', targetId: guide.id }, existing)} className={cn('mb-1 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-start transition-colors', active ? 'border-accent-300 bg-accent-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50')}><div className="min-w-0"><div className="truncate font-semibold text-slate-900">{guide.name}</div><div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{guide.kind} · {guide.country_code} · {guide.region}</div></div><span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold', existing?.status === 'published' ? 'bg-emerald-100 text-emerald-800' : existing ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>{existing?.status || 'base'}</span></button>;
                            })}
                            {!loading && view === 'profiles' && filteredProfiles.map((profile) => {
                                const existing = overridesByTarget.get(overrideKey('country_profile', profile.country_code));
                                const active = selection?.targetKind === 'country_profile' && selection.targetId === profile.country_code;
                                return <button key={profile.country_code} type="button" onClick={() => selectItem({ targetKind: 'country_profile', targetId: profile.country_code }, existing)} className={cn('mb-1 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-start transition-colors', active ? 'border-accent-300 bg-accent-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50')}><div className="min-w-0"><div className="truncate font-semibold text-slate-900">{profile.name}</div><div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{profile.country_code} · {profile.region} · {profile.source_provider}</div></div><span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold', existing?.status === 'published' ? 'bg-emerald-100 text-emerald-800' : existing ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>{existing?.status || 'base'}</span></button>;
                            })}
                        </div>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Editorial override</div><h2 className="mt-1 text-xl font-bold text-slate-950">{selectedName}</h2>{selectedOverride && <div className="mt-1 text-xs text-slate-500">Updated {formatDate(selectedOverride.updated_at)}</div>}</div>
                            {publicPath && <a href={publicPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Open page <ArrowSquareOut size={15} /></a>}
                        </div>
                        {selection ? <div className="mt-4 space-y-4">
                            {selectedProfile && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><div className="font-semibold text-slate-800">Source provenance</div><a className="mt-1 block break-all text-accent-700 hover:underline" href={selectedProfile.origin_url} target="_blank" rel="noreferrer">{selectedProfile.origin_url}</a><div className="mt-1 text-xs text-slate-500">Fetched {formatDate(selectedProfile.source_fetched_at)}</div></div>}
                            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-semibold text-slate-700">Status<Select value={editorStatus} onValueChange={(value) => setEditorStatus(value as AdminDestinationOverrideStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft — admin only</SelectItem><SelectItem value="published">Published — public</SelectItem></SelectContent></Select></label><label className="space-y-1 text-sm font-semibold text-slate-700">Editor note<Input value={editorNote} onChange={(event) => setEditorNote(event.target.value)} placeholder="Why is this changed?" /></label></div>
                            <label className="block space-y-1 text-sm font-semibold text-slate-700">Override patch<textarea value={editorJson} onChange={(event) => setEditorJson(event.target.value)} spellCheck={false} className="min-h-64 w-full resize-y rounded-xl border border-slate-300 bg-slate-950 p-4 font-mono text-xs font-normal leading-5 text-slate-100 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100" aria-describedby="destination-override-help" /></label>
                            <p id="destination-override-help" className="text-xs leading-5 text-slate-500">Only include fields you want to change. Nested objects merge; arrays replace the complete source array. Identity and provenance fields cannot be overridden.</p>
                            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50">{saving ? <SpinnerGap size={17} className="animate-spin" /> : <FloppyDisk size={17} />} {editorStatus === 'published' ? 'Publish override' : 'Save draft'}</button>{selectedOverride && <button type="button" onClick={() => void reset()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash size={17} /> Reset override</button>}</div>
                            <details className="rounded-xl border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Effective content preview</summary><pre className="max-h-80 overflow-auto border-t border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">{JSON.stringify(effectivePreview, null, 2)}</pre></details>
                        </div> : <div className="flex h-64 items-center justify-center text-sm text-slate-500">Select a destination item to inspect it.</div>}
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
