import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    CheckCircle,
    DownloadSimple,
    FloppyDisk,
    ImageBroken,
    MapPin,
    PencilSimple,
    Plus,
    SpinnerGap,
    Trash,
} from '@phosphor-icons/react';

import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge, type AdminStatusTone } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
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

const STATUS_TONE: Record<RecommendationStatus, AdminStatusTone> = {
    published: 'success',
    in_review: 'warning',
    draft: 'neutral',
    rejected: 'danger',
    retired: 'neutral',
};

const resolveStatus = (value: string | null | undefined): RecommendationStatus => (
    STATUSES.includes(value as RecommendationStatus) ? value as RecommendationStatus : 'draft'
);

/** A labelled form field: the label wraps the control so the name is programmatic. */
const EditorField: React.FC<{ label: React.ReactNode; className?: string; children: React.ReactNode }> = ({ label, className, children }) => (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {children}
    </label>
);

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
            // The bundled file, not the ordinary loader: once the table exists
            // and is empty, that loader correctly answers "nothing published",
            // which is exactly the wrong answer for a seed.
            const { loadBundledRecommendationDataset } = await import('../services/recommendationsService');
            const dataset = await loadBundledRecommendationDataset(country);
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
            description="The shared library of place ideas behind the trip Ideas deck. Travellers only ever see published entries."
            searchValue={query}
            onSearchValueChange={setQuery}
            showDateRange={false}
            actions={(
                <>
                    <Button type="button" variant="outline" onClick={() => void importBundled()} disabled={saving || loading}>
                        <DownloadSimple /> Import bundled
                    </Button>
                    <AdminReloadButton onClick={() => void load(country)} isLoading={loading} label="Refresh" />
                    <Button type="button" onClick={startNew}>
                        <Plus /> New
                    </Button>
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard label="In this country" icon={<MapPin />} value={counts.total} isLoading={loading} />
                    <AdminStatCard label="Published" icon={<CheckCircle />} value={counts.published} isLoading={loading} />
                    <AdminStatCard label="Draft or in review" icon={<PencilSimple />} value={counts.drafts} isLoading={loading} />
                    <AdminStatCard label="Without a photo" icon={<ImageBroken />} value={counts.withoutImage} isLoading={loading} />
                </div>

                {error && <AdminErrorAlert message={error} />}

                <div className="grid gap-4 xl:min-h-[640px] xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
                    <AdminSurfaceCard className="flex min-h-0 min-w-0 flex-col p-0">
                        <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-2">
                            <Select value={country} onValueChange={setCountry}>
                                <SelectTrigger aria-label="Country"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {countryOptions.map((code) => (
                                        <SelectItem key={code} value={code}>{code}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | RecommendationStatus)}>
                                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
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
                                <div className="flex h-48 items-center justify-center text-muted-foreground" role="status" aria-label="Loading recommendations">
                                    <SpinnerGap size={24} className="animate-spin" />
                                </div>
                            )}
                            {!loading && filtered.length === 0 && (
                                <AdminEmptyState
                                    className="m-2"
                                    title="Nothing here yet"
                                    description={<>Use <strong className="font-medium text-foreground">Import bundled</strong> to seed this country, or <strong className="font-medium text-foreground">New</strong> to write one.</>}
                                />
                            )}
                            {!loading && filtered.map((row) => {
                                const status = resolveStatus(row.status);
                                const active = selectedId === row.id;
                                return (
                                    <button
                                        key={row.id}
                                        type="button"
                                        onClick={() => select(row)}
                                        aria-pressed={active}
                                        data-testid="admin-recommendation-row"
                                        className={cn(
                                            'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-start transition-colors',
                                            active
                                                ? 'border-accent-300 bg-accent-50 dark:border-accent-400/30 dark:bg-accent-400/12'
                                                : 'border-transparent hover:bg-muted/50',
                                        )}
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">{row.title}</div>
                                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                                {[row.city_name, row.country_code, row.image ? 'Photo' : 'No photo'].filter(Boolean).join(' · ')}
                                            </div>
                                        </div>
                                        <AdminStatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</AdminStatusBadge>
                                    </button>
                                );
                            })}
                        </div>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader
                            className="border-b border-border pb-4"
                            title={editor.title || 'Untitled'}
                            description={(
                                <>
                                    {selectedId ? 'Edit recommendation' : 'New recommendation'}
                                    {editor.id && <span className="mt-0.5 block break-all font-mono text-xs">{editor.id}</span>}
                                </>
                            )}
                            actions={selectedId && editor.status !== 'published' ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const row = rows.find((entry) => entry.id === selectedId);
                                        if (row) void changeStatus(row, 'published');
                                    }}
                                >
                                    <CheckCircle /> Publish now
                                </Button>
                            ) : null}
                        />

                        <div className="flex flex-col gap-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <EditorField label="Title">
                                    <Input value={editor.title} onChange={field('title')} placeholder="Din Tai Fung (Xinsheng Branch)" />
                                </EditorField>
                                <EditorField label="City">
                                    <Input value={editor.cityName} onChange={field('cityName')} placeholder="Taipei" />
                                </EditorField>
                                <EditorField label="Country code">
                                    <Input value={editor.countryCode} onChange={field('countryCode')} placeholder="TW" maxLength={2} />
                                </EditorField>
                                <EditorField label="Status">
                                    <Select value={editor.status} onValueChange={(value) => setEditor((current) => ({ ...current, status: value as RecommendationStatus }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {STATUSES.map((status) => (
                                                <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </EditorField>
                            </div>

                            <EditorField label="One-line summary">
                                <Input value={editor.summary} onChange={field('summary')} placeholder="Famous soup dumplings, expect a queue" />
                            </EditorField>

                            <EditorField label="Description">
                                <Textarea
                                    value={editor.description}
                                    onChange={field('description')}
                                    rows={6}
                                    className="resize-y leading-6 [field-sizing:fixed]"
                                    placeholder="A paragraph or two. This is what the card shows."
                                />
                            </EditorField>

                            <EditorField label="Recommendations — one per line">
                                <Textarea
                                    value={editor.highlights}
                                    onChange={field('highlights')}
                                    rows={5}
                                    className="resize-y leading-6 [field-sizing:fixed]"
                                    placeholder={'Order the xiaolongbao\nGo before noon to skip the queue'}
                                />
                            </EditorField>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <EditorField label="Activity types — comma separated">
                                    <Input value={editor.activityTypes} onChange={field('activityTypes')} placeholder="food, sightseeing" />
                                </EditorField>
                                <EditorField label="Tags — comma separated">
                                    <Input value={editor.tags} onChange={field('tags')} placeholder="food-drink, taipei" />
                                </EditorField>
                                <EditorField label="Cost">
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
                                </EditorField>
                                <EditorField label="Typical duration (minutes)">
                                    <Input
                                        value={editor.typicalDurationMinutes}
                                        onChange={field('typicalDurationMinutes')}
                                        inputMode="numeric"
                                        placeholder="75"
                                    />
                                </EditorField>
                            </div>

                            <EditorField label="Address">
                                <Input value={editor.address} onChange={field('address')} placeholder="No. 277, Section 2, Xinyi Rd, Taipei" />
                            </EditorField>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <EditorField label="Latitude">
                                    <Input value={editor.lat} onChange={field('lat')} inputMode="decimal" placeholder="25.033889" />
                                </EditorField>
                                <EditorField label="Longitude">
                                    <Input value={editor.lng} onChange={field('lng')} inputMode="decimal" placeholder="121.532134" />
                                </EditorField>
                                <EditorField label="Google place id">
                                    <Input value={editor.googlePlaceId} onChange={field('googlePlaceId')} placeholder="ChIJ..." />
                                </EditorField>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <EditorField label="Photo URL">
                                    <Input
                                        value={editor.imageUrl}
                                        onChange={field('imageUrl')}
                                        placeholder="/api/place-photo?ref=places/.../photos/..."
                                    />
                                </EditorField>
                                <EditorField label="Photo credit">
                                    <Input value={editor.imageAttribution} onChange={field('imageAttribution')} placeholder="Photographer name" />
                                </EditorField>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">
                                Photos are referenced, never copied. Paste a
                                {' '}<code className="break-all rounded bg-secondary px-1">/api/place-photo?ref=places/&lt;placeId&gt;/photos/&lt;photoId&gt;</code>{' '}
                                path and credit the photographer. Leave the coordinates filled in and the card draws its own map.
                            </p>

                            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                                <Button
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving || !editor.title.trim()}
                                    aria-busy={saving || undefined}
                                >
                                    {saving ? <SpinnerGap className="animate-spin" /> : <FloppyDisk />}
                                    {selectedId ? 'Save changes' : 'Create recommendation'}
                                </Button>
                                {selectedId && (
                                    <Button type="button" variant="destructive" onClick={() => void remove()} disabled={saving}>
                                        <Trash /> Delete
                                    </Button>
                                )}
                            </div>
                        </div>
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
