import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    ArrowsClockwise,
    DownloadSimple,
    FloppyDisk,
    MapPin,
    Plus,
    SpinnerGap,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';

import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { showAppToast } from '../components/ui/appToast';
import { useAppDialog } from '../components/AppDialogProvider';
import { cn } from '../lib/utils';
import {
    adminDeleteRecommendation,
    adminGetRecommendationCatalog,
    adminImportRecommendations,
    adminSaveRecommendation,
    adminSetRecommendationStatus,
    type AdminRecommendationRow,
} from '../services/adminService';
import { COST_BAND_VALUES, type RecommendationStatus } from '../shared/recommendations';

const STATUSES: RecommendationStatus[] = ['draft', 'in_review', 'published', 'rejected', 'retired'];

const STATUS_LABEL: Record<RecommendationStatus, string> = {
    draft: 'Draft',
    in_review: 'In review',
    published: 'Published',
    rejected: 'Rejected',
    retired: 'Retired',
};

const STATUS_TONE: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    in_review: 'bg-amber-100 text-amber-800',
    draft: 'bg-slate-100 text-slate-600',
    rejected: 'bg-red-100 text-red-800',
    retired: 'bg-slate-200 text-slate-500',
};

/** The editor works on strings; the table works on JSON. This is the seam. */
interface EditorState {
    id: string;
    slug: string;
    countryCode: string;
    cityName: string;
    title: string;
    summary: string;
    description: string;
    highlights: string;
    activityTypes: string;
    tags: string;
    costBand: string;
    typicalDurationMinutes: string;
    address: string;
    lat: string;
    lng: string;
    googlePlaceId: string;
    imageUrl: string;
    imageAttribution: string;
    status: RecommendationStatus;
}

const toList = (value: unknown): string[] => (Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []);

const blankEditor = (countryCode: string): EditorState => ({
    id: '',
    slug: '',
    countryCode,
    cityName: '',
    title: '',
    summary: '',
    description: '',
    highlights: '',
    activityTypes: '',
    tags: '',
    costBand: '',
    typicalDurationMinutes: '',
    address: '',
    lat: '',
    lng: '',
    googlePlaceId: '',
    imageUrl: '',
    imageAttribution: '',
    status: 'draft',
});

const rowToEditor = (row: AdminRecommendationRow): EditorState => {
    const image = (row.image && typeof row.image === 'object' ? row.image : {}) as Record<string, unknown>;
    return {
        id: row.id,
        slug: row.slug,
        countryCode: row.country_code,
        cityName: row.city_name ?? '',
        title: row.title,
        summary: row.summary ?? '',
        description: row.description ?? '',
        // One per line: a bullet list is edited as a list, not as JSON.
        highlights: toList(row.highlights).join('\n'),
        activityTypes: toList(row.activity_types).join(', '),
        tags: toList(row.tags).join(', '),
        costBand: row.cost_band ?? '',
        typicalDurationMinutes: row.typical_duration_minutes == null ? '' : String(row.typical_duration_minutes),
        address: row.address ?? '',
        lat: row.lat == null ? '' : String(row.lat),
        lng: row.lng == null ? '' : String(row.lng),
        googlePlaceId: row.google_place_id ?? '',
        imageUrl: typeof image.url === 'string' ? image.url : '',
        imageAttribution: typeof image.attribution === 'string' ? image.attribution : '',
        status: (STATUSES.includes(row.status as RecommendationStatus) ? row.status : 'draft') as RecommendationStatus,
    };
};

const splitLines = (value: string): string[] => value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

const splitCommas = (value: string): string[] => value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const editorToPayload = (editor: EditorState): Record<string, unknown> => ({
    ...(editor.id ? { id: editor.id } : {}),
    slug: editor.slug || undefined,
    countryCode: editor.countryCode,
    cityName: editor.cityName,
    title: editor.title,
    summary: editor.summary,
    description: editor.description,
    highlights: splitLines(editor.highlights),
    activityTypes: splitCommas(editor.activityTypes),
    tags: splitCommas(editor.tags),
    costBand: editor.costBand || null,
    typicalDurationMinutes: editor.typicalDurationMinutes === '' ? null : Number(editor.typicalDurationMinutes),
    address: editor.address,
    formattedAddress: editor.address,
    lat: editor.lat === '' ? null : Number(editor.lat),
    lng: editor.lng === '' ? null : Number(editor.lng),
    googlePlaceId: editor.googlePlaceId,
    image: editor.imageUrl
        ? { url: editor.imageUrl, provider: 'google_places', attribution: editor.imageAttribution || null }
        : null,
    origin: 'manual',
    status: editor.status,
});

export const AdminRecommendationsPage: React.FC = () => {
    const dialog = useAppDialog();
    const [rows, setRows] = useState<AdminRecommendationRow[]>([]);
    const [countries, setCountries] = useState<string[]>([]);
    const [country, setCountry] = useState('TW');
    const [statusFilter, setStatusFilter] = useState<'all' | RecommendationStatus>('all');
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<EditorState>(() => blankEditor('TW'));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async (nextCountry: string) => {
        setLoading(true);
        setError(null);
        try {
            const catalog = await adminGetRecommendationCatalog(nextCountry);
            setRows(catalog.rows);
            setCountries(catalog.countries);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Could not load the recommendation library.');
        } finally {
            setLoading(false);
        }
    };

    // The catalog is a network read keyed by the country filter, which is
    // exactly what an effect is for.
    useEffect(() => { void load(country); }, [country]);

    const filtered = useMemo(() => rows.filter((row) => {
        const matchesQuery = !deferredQuery
            || `${row.title} ${row.slug} ${row.city_name ?? ''} ${toList(row.tags).join(' ')}`
                .toLocaleLowerCase()
                .includes(deferredQuery);
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
        return matchesQuery && matchesStatus;
    }), [deferredQuery, rows, statusFilter]);

    const counts = useMemo(() => ({
        total: rows.length,
        published: rows.filter((row) => row.status === 'published').length,
        drafts: rows.filter((row) => row.status === 'draft' || row.status === 'in_review').length,
        withoutImage: rows.filter((row) => !row.image).length,
    }), [rows]);

    const select = (row: AdminRecommendationRow) => {
        setSelectedId(row.id);
        setEditor(rowToEditor(row));
        setError(null);
    };

    const startNew = () => {
        setSelectedId(null);
        setEditor(blankEditor(country));
        setError(null);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const saved = await adminSaveRecommendation(editorToPayload(editor));
            setRows((current) => {
                const without = current.filter((row) => row.id !== saved.id);
                return [saved, ...without];
            });
            setSelectedId(saved.id);
            setEditor(rowToEditor(saved));
            showAppToast({ title: 'Recommendation saved', tone: 'success' });
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Could not save the recommendation.');
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (row: AdminRecommendationRow, status: RecommendationStatus) => {
        try {
            const updated = await adminSetRecommendationStatus(row.id, status);
            setRows((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
            if (selectedId === updated.id) setEditor(rowToEditor(updated));
        } catch (statusError) {
            setError(statusError instanceof Error ? statusError.message : 'Could not change the status.');
        }
    };

    const remove = async () => {
        if (!selectedId) return;
        const confirmed = await dialog.confirm({
            title: 'Delete this recommendation?',
            message: 'It disappears from every traveller’s deck. Ideas already kept on a trip are unaffected, because those are copies.',
            confirmLabel: 'Delete',
            tone: 'danger',
        });
        if (!confirmed) return;

        setSaving(true);
        try {
            await adminDeleteRecommendation(selectedId);
            setRows((current) => current.filter((row) => row.id !== selectedId));
            startNew();
            showAppToast({ title: 'Recommendation deleted', tone: 'success' });
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the recommendation.');
        } finally {
            setSaving(false);
        }
    };

    /**
     * Seeds an empty country from the copy bundled with the app. Rows arrive
     * as they are in the dataset — usually `in_review` — so nothing becomes
     * visible to a traveller until somebody publishes it.
     */
    const importBundled = async () => {
        const confirmed = await dialog.confirm({
            title: `Import the bundled ${country} dataset?`,
            message: 'Existing rows with the same id are overwritten, including any edits made here. Imported rows keep their dataset status, so nothing is published automatically.',
            confirmLabel: 'Import',
        });
        if (!confirmed) return;

        setSaving(true);
        setError(null);
        try {
            const { loadRecommendationDataset } = await import('../services/recommendationsService');
            const dataset = await loadRecommendationDataset(country);
            const entries = dataset?.recommendations ?? [];
            if (entries.length === 0) throw new Error(`No bundled dataset is available for ${country}.`);
            const imported = await adminImportRecommendations(entries as unknown as Record<string, unknown>[]);
            showAppToast({ title: `Imported ${imported} recommendations`, tone: 'success' });
            await load(country);
        } catch (importError) {
            setError(importError instanceof Error ? importError.message : 'Could not import the dataset.');
        } finally {
            setSaving(false);
        }
    };

    const field = (key: keyof EditorState) => (
        event: { target: { value: string } },
    ) => setEditor((current) => ({ ...current, [key]: event.target.value }));

    const countryOptions = Array.from(new Set([country, 'TW', ...countries])).filter(Boolean).sort();

    return (
        <AdminShell
            title="Recommendations"
            description="The shared library of place ideas behind the trip Ideas deck. Add, edit and publish entries; travellers only ever see published ones."
            searchValue={query}
            onSearchValueChange={setQuery}
            showDateRange={false}
            actions={(
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => void importBundled()}
                        disabled={saving || loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <DownloadSimple size={16} /> Import bundled
                    </button>
                    <button
                        type="button"
                        onClick={() => void load(country)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <ArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={startNew}
                        className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-700"
                    >
                        <Plus size={16} /> New
                    </button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {([
                        ['In this country', counts.total],
                        ['Published', counts.published],
                        ['Draft or in review', counts.drafts],
                        ['Without a photo', counts.withoutImage],
                    ] as const).map(([label, value]) => (
                        <AdminSurfaceCard key={label} className="flex items-center justify-between">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                                <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
                            </div>
                            <MapPin size={24} />
                        </AdminSurfaceCard>
                    ))}
                </div>

                {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <WarningCircle size={18} className="mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(340px,0.8fr)_minmax(520px,1.2fr)]">
                    <AdminSurfaceCard className="flex min-h-0 flex-col p-0">
                        <div className="grid gap-2 border-b border-slate-200 p-4 sm:grid-cols-2">
                            <Select value={country} onValueChange={setCountry}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {countryOptions.map((code) => (
                                        <SelectItem key={code} value={code}>{code}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | RecommendationStatus)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    {STATUSES.map((status) => (
                                        <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="max-h-[720px] flex-1 overflow-y-auto p-2">
                            {loading && (
                                <div className="flex h-48 items-center justify-center text-slate-500">
                                    <SpinnerGap size={24} className="animate-spin" />
                                </div>
                            )}
                            {!loading && filtered.length === 0 && (
                                <div className="px-4 py-10 text-center text-sm text-slate-500">
                                    Nothing here yet. Use <strong>Import bundled</strong> to seed this country, or <strong>New</strong> to write one.
                                </div>
                            )}
                            {!loading && filtered.map((row) => (
                                <button
                                    key={row.id}
                                    type="button"
                                    onClick={() => select(row)}
                                    data-testid="admin-recommendation-row"
                                    className={cn(
                                        'mb-1 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-3 text-start transition-colors',
                                        selectedId === row.id
                                            ? 'border-accent-300 bg-accent-50'
                                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                                    )}
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-semibold text-slate-900">{row.title}</div>
                                        <div className="mt-0.5 truncate text-xs uppercase tracking-wide text-slate-500">
                                            {[row.city_name, row.country_code, row.image ? 'photo' : 'no photo'].filter(Boolean).join(' · ')}
                                        </div>
                                    </div>
                                    <span className={cn('shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold', STATUS_TONE[row.status ?? 'draft'])}>
                                        {STATUS_LABEL[(row.status ?? 'draft') as RecommendationStatus]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {selectedId ? 'Edit recommendation' : 'New recommendation'}
                                </div>
                                <h2 className="mt-1 text-xl font-bold text-slate-950">{editor.title || 'Untitled'}</h2>
                                {editor.id && <div className="mt-1 font-mono text-xs text-slate-500">{editor.id}</div>}
                            </div>
                            {selectedId && editor.status !== 'published' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const row = rows.find((entry) => entry.id === selectedId);
                                        if (row) void changeStatus(row, 'published');
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                                >
                                    Publish now
                                </button>
                            )}
                        </div>

                        <div className="mt-4 space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Title
                                    <Input value={editor.title} onChange={field('title')} placeholder="Din Tai Fung (Xinsheng Branch)" />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    City
                                    <Input value={editor.cityName} onChange={field('cityName')} placeholder="Taipei" />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Country code
                                    <Input value={editor.countryCode} onChange={field('countryCode')} placeholder="TW" maxLength={2} />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Status
                                    <Select value={editor.status} onValueChange={(value) => setEditor((current) => ({ ...current, status: value as RecommendationStatus }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {STATUSES.map((status) => (
                                                <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </label>
                            </div>

                            <label className="block space-y-1 text-sm font-semibold text-slate-700">
                                One-line summary
                                <Input value={editor.summary} onChange={field('summary')} placeholder="Famous soup dumplings, expect a queue" />
                            </label>

                            <label className="block space-y-1 text-sm font-semibold text-slate-700">
                                Description
                                <textarea
                                    value={editor.description}
                                    onChange={field('description')}
                                    rows={6}
                                    className="w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal leading-6 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100"
                                    placeholder="A paragraph or two. This is what the card shows."
                                />
                            </label>

                            <label className="block space-y-1 text-sm font-semibold text-slate-700">
                                Recommendations — one per line
                                <textarea
                                    value={editor.highlights}
                                    onChange={field('highlights')}
                                    rows={5}
                                    className="w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal leading-6 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100"
                                    placeholder={'Order the xiaolongbao\nGo before noon to skip the queue'}
                                />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Activity types — comma separated
                                    <Input value={editor.activityTypes} onChange={field('activityTypes')} placeholder="food, sightseeing" />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Tags — comma separated
                                    <Input value={editor.tags} onChange={field('tags')} placeholder="food-drink, taipei" />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Cost
                                    <Select
                                        value={editor.costBand || 'none'}
                                        onValueChange={(value) => setEditor((current) => ({ ...current, costBand: value === 'none' ? '' : value }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Not set</SelectItem>
                                            {COST_BAND_VALUES.map((band) => (
                                                <SelectItem key={band} value={band}>{band === 'free' ? 'Free' : band}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Typical duration (minutes)
                                    <Input
                                        value={editor.typicalDurationMinutes}
                                        onChange={field('typicalDurationMinutes')}
                                        inputMode="numeric"
                                        placeholder="75"
                                    />
                                </label>
                            </div>

                            <label className="block space-y-1 text-sm font-semibold text-slate-700">
                                Address
                                <Input value={editor.address} onChange={field('address')} placeholder="No. 277, Section 2, Xinyi Rd, Taipei" />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Latitude
                                    <Input value={editor.lat} onChange={field('lat')} inputMode="decimal" placeholder="25.033889" />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Longitude
                                    <Input value={editor.lng} onChange={field('lng')} inputMode="decimal" placeholder="121.532134" />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Google place id
                                    <Input value={editor.googlePlaceId} onChange={field('googlePlaceId')} placeholder="ChIJ..." />
                                </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Photo URL
                                    <Input
                                        value={editor.imageUrl}
                                        onChange={field('imageUrl')}
                                        placeholder="/api/place-photo?ref=places/.../photos/..."
                                    />
                                </label>
                                <label className="space-y-1 text-sm font-semibold text-slate-700">
                                    Photo credit
                                    <Input value={editor.imageAttribution} onChange={field('imageAttribution')} placeholder="Photographer name" />
                                </label>
                            </div>
                            <p className="text-xs leading-5 text-slate-500">
                                Photos are referenced, never copied. Paste a
                                {' '}<code className="rounded bg-slate-100 px-1">/api/place-photo?ref=places/&lt;placeId&gt;/photos/&lt;photoId&gt;</code>{' '}
                                path and credit the photographer. Leave the coordinates filled in and the card draws its own map.
                            </p>

                            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving || !editor.title.trim()}
                                    className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                                >
                                    {saving ? <SpinnerGap size={17} className="animate-spin" /> : <FloppyDisk size={17} />}
                                    {selectedId ? 'Save changes' : 'Create recommendation'}
                                </button>
                                {selectedId && (
                                    <button
                                        type="button"
                                        onClick={() => void remove()}
                                        disabled={saving}
                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                        <Trash size={17} /> Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
