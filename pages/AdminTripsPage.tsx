import { TripOgPreviewPanel } from '../components/admin/TripOgPreviewPanel';
import { AdminUserFacingError, toAdminErrorMessage } from '../services/adminErrorMessages';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from '@/app/navigation';
import {
    ArrowSquareOut,
    DotsThreeVertical,
    Hourglass,
    MapPin,
    SpinnerGap,
    SuitcaseRolling,
    Trash,
    Warning,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { AI_MODEL_CATALOG, getDefaultCreateTripModel, sortAiModels } from '../config/aiModelCatalog';
import {
    adminGetUserProfile,
    adminHardDeleteTrip,
    adminListTrips,
    adminListUsers,
    adminUpdateTrip,
    type AdminTripRecord,
    type AdminUserRecord,
} from '../services/adminService';
import {
    buildDangerConfirmDialog,
    buildTransferTargetPromptDialog,
} from '../services/appDialogPresets';
import { dbAdminOverrideTripCommit, dbGetTrip, dbUpsertTrip } from '../services/dbService';
import { getTripCityStops, buildMiniMapUrl } from '../components/profile/tripPreviewUtils';
import type { ITrip, TripGenerationAttemptSummary, TripGenerationJobSummary, TripGenerationState } from '../types';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge, type AdminStatusTone } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminDetailSheet } from '../components/admin/AdminDetailSheet';
import { AdminSelectionBar } from '../components/admin/AdminSelectionBar';
import { AdminPagination } from '../components/admin/AdminPagination';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { AiProviderLogo } from '../components/admin/AiProviderLogo';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import {
    buildAdminUserSheetPath,
    getAdminTripExpirationBucket,
    getLegacyOwnerDeepLinkTarget,
    getPageSelectionState,
    resolveAdminTripGenerationState,
    isAdminTripInDateRange,
    summarizeAdminTrips,
} from '../components/admin/adminTripsModel';
import { Checkbox } from '../components/ui/checkbox';
import { useAppDialog } from '../components/AppDialogProvider';
import { showAppToast, type AppToastTone } from '../components/ui/appToast';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    AdminSortHeaderButton,
} from '../components/admin/AdminDataTable';
import {
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    ADMIN_TABLE_SORTED_HEADER_CLASS,
    getAdminStickyBodyCellClass,
    getAdminStickyHeaderCellClass,
} from '../components/admin/AdminDataTableUtils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { generateTripId } from '../utils';
import {
    getLatestTripGenerationAttempt,
    getTripGenerationState,
    normalizeTripGenerationAttemptsForDisplay,
} from '../services/tripGenerationDiagnosticsService';
import { retryTripGenerationWithDefaultModel } from '../services/tripGenerationRetryService';
import { listAdminTripGenerationAttempts } from '../services/tripGenerationAttemptLogService';
import { buildBenchmarkScenarioImportUrl } from '../services/tripGenerationBenchmarkBridge';
import { listTripGenerationJobsByTrip, requeueTripGenerationJob } from '../services/tripGenerationJobService';

const toDateTimeInputValue = (value: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
};

const fromDateTimeInputValue = (value: string): string | null => {
    if (!value.trim()) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
};

type TripStatus = 'active' | 'archived' | 'expired';
type TripExpirationFilter = 'no_expiration' | 'already_expired' | 'expiring_24h' | 'expiring_7d' | 'scheduled';
type TripVisibleColumnId = 'owner' | 'lifecycle' | 'generation' | 'source' | 'expires' | 'updated' | 'created' | 'archived';
type TripSortColumn = 'trip' | 'owner' | 'lifecycle' | 'generation' | 'source' | 'expires' | 'updated' | 'created' | 'archived';
type TripSortDirection = 'asc' | 'desc';

const TRIPS_PAGE_SIZE = 25;
const TRIPS_CACHE_KEY = 'admin.trips.cache.v1';
const DEFAULT_TRIP_SORT_COLUMN: TripSortColumn = 'updated';
const DEFAULT_TRIP_SORT_DIRECTION: TripSortDirection = 'desc';
const TRIP_STATUS_VALUES: readonly TripStatus[] = ['active', 'archived', 'expired'];
const TRIP_GENERATION_STATE_VALUES: readonly TripGenerationState[] = ['failed', 'running', 'queued', 'succeeded'];
const TRIP_EXPIRATION_FILTER_VALUES: readonly TripExpirationFilter[] = [
    'already_expired',
    'expiring_24h',
    'expiring_7d',
    'scheduled',
    'no_expiration',
];
const TRIP_VISIBLE_COLUMN_IDS: readonly TripVisibleColumnId[] = [
    'owner',
    'lifecycle',
    'generation',
    'source',
    'expires',
    'updated',
    'created',
    'archived',
];
const TRIP_VISIBLE_COLUMN_OPTIONS: Array<{ value: TripVisibleColumnId; label: string }> = [
    { value: 'owner', label: 'Owner' },
    { value: 'lifecycle', label: 'Status' },
    { value: 'generation', label: 'Generation' },
    { value: 'source', label: 'Source' },
    { value: 'expires', label: 'Expires' },
    { value: 'updated', label: 'Updated' },
    { value: 'created', label: 'Created' },
    { value: 'archived', label: 'Archived' },
];
// What an admin scans for: who owns it, is it live, did generation work, when
// does it lapse, when was it touched. Source, created and archived dates are
// one click away in the column picker and always shown in the trip's details.
const DEFAULT_VISIBLE_TRIP_COLUMNS: TripVisibleColumnId[] = [
    'owner',
    'lifecycle',
    'generation',
    'expires',
    'updated',
];
// Fixed widths of the two frozen columns (selection, trip).
const SELECT_COLUMN_WIDTH = 48;
const TRIP_COLUMN_WIDTH = 320;
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const DEFAULT_RETRY_MODEL_ID = getDefaultCreateTripModel().id;
const ACTIVE_RETRY_MODEL_OPTIONS = sortAiModels(
    AI_MODEL_CATALOG.filter((entry) => entry.availability === 'active')
)
    .map((entry) => ({
        id: entry.id,
        provider: entry.provider,
        providerLabel: entry.providerLabel,
        model: entry.model,
        label: entry.label,
    }));

const parseQueryMultiValue = <T extends string>(
    value: string | null,
    allowedValues: readonly T[]
): T[] => {
    if (!value) return [];
    const allowSet = new Set<string>(allowedValues);
    const unique = new Set<string>();
    for (const chunk of value.split(',')) {
        const trimmed = chunk.trim();
        if (!trimmed || !allowSet.has(trimmed)) continue;
        unique.add(trimmed);
    }
    return allowedValues.filter((candidate) => unique.has(candidate));
};

const parseRawQueryMultiValue = (value: string | null): string[] => {
    if (!value) return [];
    return Array.from(new Set(
        value
            .split(',')
            .flatMap((chunk) => {
                const trimmed = chunk.trim();
                return trimmed ? [trimmed] : [];
            })
    ));
};

const sanitizeTripVisibleColumns = (values: string[] | null | undefined): TripVisibleColumnId[] => {
    if (!Array.isArray(values) || values.length === 0) return [...DEFAULT_VISIBLE_TRIP_COLUMNS];
    const unique = new Set<string>();
    values.forEach((value) => {
        if (TRIP_VISIBLE_COLUMN_IDS.includes(value as TripVisibleColumnId)) {
            unique.add(value);
        }
    });
    const ordered = TRIP_VISIBLE_COLUMN_IDS.filter((columnId) => unique.has(columnId));
    return ordered.length > 0 ? ordered : [...DEFAULT_VISIBLE_TRIP_COLUMNS];
};

const parseTripVisibleColumns = (value: string | null): TripVisibleColumnId[] => {
    const parsed = parseRawQueryMultiValue(value);
    return sanitizeTripVisibleColumns(parsed);
};

const parseTripSortColumn = (value: string | null): TripSortColumn => {
    if (
        value === 'trip'
        || value === 'owner'
        || value === 'lifecycle'
        || value === 'generation'
        || value === 'source'
        || value === 'expires'
        || value === 'updated'
        || value === 'created'
        || value === 'archived'
    ) {
        return value;
    }
    return DEFAULT_TRIP_SORT_COLUMN;
};

const parseTripSortDirection = (value: string | null): TripSortDirection => (
    value === 'asc' ? 'asc' : 'desc'
);

const parsePositivePage = (value: string | null): number => {
    if (!value) return 1;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
};

const formatTimestamp = (value: string | null | undefined, fallback = 'Not set'): string => {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return fallback;
    return new Date(parsed).toLocaleString();
};

const formatRelativeTimestamp = (value: string | null | undefined, fallback = 'No data'): string => {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return fallback;
    const diffMs = parsed - Date.now();
    const absDiffMs = Math.abs(diffMs);
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;
    const yearMs = 365 * dayMs;
    if (absDiffMs < minuteMs) return relativeTimeFormatter.format(Math.round(diffMs / 1000), 'second');
    if (absDiffMs < hourMs) return relativeTimeFormatter.format(Math.round(diffMs / minuteMs), 'minute');
    if (absDiffMs < dayMs) return relativeTimeFormatter.format(Math.round(diffMs / hourMs), 'hour');
    if (absDiffMs < weekMs) return relativeTimeFormatter.format(Math.round(diffMs / dayMs), 'day');
    if (absDiffMs < monthMs) return relativeTimeFormatter.format(Math.round(diffMs / weekMs), 'week');
    if (absDiffMs < yearMs) return relativeTimeFormatter.format(Math.round(diffMs / monthMs), 'month');
    return relativeTimeFormatter.format(Math.round(diffMs / yearMs), 'year');
};

const formatDurationMs = (durationMs: number | null | undefined): string => {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return 'n/a';
    if (durationMs < 1_000) return `${Math.max(0, Math.round(durationMs))} ms`;
    return `${(Math.max(0, durationMs) / 1_000).toFixed(2)} s`;
};

const normalizeIsoTimestamp = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
};

const formatSourceKindLabel = (sourceKind: string | null | undefined): string => {
    const normalized = (sourceKind || '').trim();
    if (!normalized) return 'Unknown source';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const getExpirationFilterLabel = (value: TripExpirationFilter): string => {
    if (value === 'already_expired') return 'Already expired';
    if (value === 'expiring_24h') return 'Expiring in 24h';
    if (value === 'expiring_7d') return 'Expiring in 7d';
    if (value === 'scheduled') return 'Scheduled';
    return 'No expiration';
};

const getTripExpirationBucket = (trip: Pick<AdminTripRecord, 'trip_expires_at'>): TripExpirationFilter => (
    getAdminTripExpirationBucket(trip)
);

const getUserDisplayName = (user: AdminUserRecord): string => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (user.display_name?.trim()) return user.display_name.trim();
    if (user.username_display?.trim()) return user.username_display.trim();
    if (user.username?.trim()) return user.username.trim();
    if (user.email?.trim()) return user.email.trim();
    return user.user_id;
};

const getUserReferenceText = (user: AdminUserRecord): string => {
    const name = getUserDisplayName(user);
    const email = (user.email || '').trim();
    return email ? `${name} (${email})` : `${name} (${user.user_id})`;
};

const getLifecycleTone = (status: TripStatus): AdminStatusTone => {
    if (status === 'archived') return 'neutral';
    if (status === 'expired') return 'warning';
    return 'success';
};

const getLifecycleLabel = (status: TripStatus): string => (
    status.charAt(0).toUpperCase() + status.slice(1)
);

// Succeeded is the normal case, so it stays neutral and the states that need
// attention (failed, in flight) are the only tinted badges in the column.
const getGenerationTone = (state: TripGenerationState): AdminStatusTone => {
    if (state === 'failed') return 'danger';
    if (state === 'running' || state === 'queued') return 'warning';
    return 'neutral';
};

const getGenerationStateLabel = (state: TripGenerationState): string => {
    if (state === 'failed') return 'Failed';
    if (state === 'running') return 'Running';
    if (state === 'queued') return 'Queued';
    return 'Succeeded';
};

const getGenerationJobTone = (state: TripGenerationJobSummary['state']): AdminStatusTone => {
    if (state === 'dead' || state === 'failed') return 'danger';
    if (state === 'queued' || state === 'leased') return 'warning';
    return 'success';
};

// Show the authored sentence; keep the raw exception in the console for diagnosis.
const reportAdminTripsError = (fallback: string, error: unknown): string => (
    toAdminErrorMessage(error, fallback, 'admin-trips')
);

const resolveTripGenerationState = resolveAdminTripGenerationState;

// Results of an action are transient: a toast, not a banner that stays on the page.
const notifyTripsResult = (title: string, tone: AppToastTone = 'success', description?: string) => {
    showAppToast({ tone, title, description });
};

const resolveRetryModelIdFromAttempt = (attempt: TripGenerationAttemptSummary | null | undefined): string => {
    if (!attempt) return DEFAULT_RETRY_MODEL_ID;
    const matching = ACTIVE_RETRY_MODEL_OPTIONS.find((option) => (
        option.provider === (attempt.provider || '')
        && option.model === (attempt.model || '')
    ));
    return matching?.id || DEFAULT_RETRY_MODEL_ID;
};

const isLikelyUserId = (value: string): boolean => USER_ID_PATTERN.test(value.trim());
const isLikelyEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

const getTripLink = (tripId: string): string => `/trip/${encodeURIComponent(tripId)}`;

const buildDuplicateTitle = (title: string | null): string => {
    const baseTitle = title?.trim() || 'Untitled trip';
    if (/^Copy of /i.test(baseTitle)) return baseTitle;
    return `Copy of ${baseTitle}`;
};

const sanitizeFilenameSegment = (value: string): string => {
    const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    return normalized || 'trip';
};

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

const TripRowActionsMenu: React.FC<{
    trip: AdminTripRecord;
    disabled: boolean;
    onOpenDetails: (trip: AdminTripRecord) => void;
    onPreviewTrip: (trip: AdminTripRecord) => void;
    onDuplicateTrip: (trip: AdminTripRecord) => void;
    onTransferTrip: (trip: AdminTripRecord) => void;
    onDownloadTripJson: (trip: AdminTripRecord) => void;
    onSoftDeleteTrip: (trip: AdminTripRecord) => void;
    onHardDeleteTrip: (trip: AdminTripRecord) => void;
}> = ({
    trip,
    disabled,
    onOpenDetails,
    onPreviewTrip,
    onDuplicateTrip,
    onTransferTrip,
    onDownloadTripJson,
    onSoftDeleteTrip,
    onHardDeleteTrip,
}) => {
    const isArchived = trip.status === 'archived';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label="Open trip actions"
                    data-tooltip="Trip actions"
                >
                    <DotsThreeVertical size={16} weight="bold" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem onSelect={() => onOpenDetails(trip)}>Open details</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPreviewTrip(trip)}>
                    Open trip
                    <ArrowSquareOut className="ms-auto rtl:-scale-x-100" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDuplicateTrip(trip)}>Duplicate…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onTransferTrip(trip)}>Transfer owner…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDownloadTripJson(trip)}>Download JSON</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onSoftDeleteTrip(trip)}>
                    {isArchived ? 'Restore trip' : 'Archive trip'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onHardDeleteTrip(trip)}>
                    <Trash />
                    Delete permanently
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

/** A label/value pair in the trip sheet's description lists. */
const DetailField: React.FC<{ label: string; children: React.ReactNode; wide?: boolean; mono?: boolean }> = ({
    label,
    children,
    wide = false,
    mono = false,
}) => (
    <div className={wide ? 'flex min-w-0 flex-col gap-0.5 sm:col-span-2' : 'flex min-w-0 flex-col gap-0.5'}>
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className={mono ? 'break-all font-mono text-xs text-foreground' : 'break-words text-sm text-foreground'}>{children}</dd>
    </div>
);

/** Relative time with the absolute timestamp in the tooltip. */
const RelativeTime: React.FC<{ value: string | null | undefined; fallback: string; className?: string }> = ({
    value,
    fallback,
    className,
}) => {
    const hasValue = Boolean(normalizeIsoTimestamp(value));
    return (
        <span
            className={className ?? 'tabular-nums'}
            data-tooltip={hasValue ? formatTimestamp(value, fallback) : undefined}
        >
            {formatRelativeTimestamp(value, fallback)}
        </span>
    );
};

const formatRelativeWithAbsolute = (value: string | null | undefined): string => (
    value && normalizeIsoTimestamp(value)
        ? `${formatRelativeTimestamp(value, 'n/a')} (${formatTimestamp(value, 'n/a')})`
        : 'n/a'
);

const JsonBlock: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
    <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <pre className="max-h-48 overflow-auto rounded-md border border-border bg-slate-900 p-2 font-mono text-[11px] text-slate-100 dark:bg-slate-950">
            {JSON.stringify(value, null, 2)}
        </pre>
    </div>
);

export const AdminTripsPage: React.FC = () => {
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
    const [searchParams, setSearchParams] = useSearchParams();
    const cachedTrips = useMemo(
        () => readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []),
        []
    );
    const [trips, setTrips] = useState<AdminTripRecord[]>(cachedTrips);
    const [isLoading, setIsLoading] = useState(() => cachedTrips.length === 0);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(() => new Set());
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [statusFilters, setStatusFilters] = useState<TripStatus[]>(
        () => parseQueryMultiValue(searchParams.get('status'), TRIP_STATUS_VALUES)
    );
    const [generationStateFilters, setGenerationStateFilters] = useState<TripGenerationState[]>(
        () => parseQueryMultiValue(searchParams.get('generation'), TRIP_GENERATION_STATE_VALUES)
    );
    const [expirationFilters, setExpirationFilters] = useState<TripExpirationFilter[]>(
        () => parseQueryMultiValue(searchParams.get('expires'), TRIP_EXPIRATION_FILTER_VALUES)
    );
    const [sourceFilters, setSourceFilters] = useState<string[]>(
        () => parseRawQueryMultiValue(searchParams.get('source'))
    );
    const [visibleColumns, setVisibleColumns] = useState<TripVisibleColumnId[]>(
        () => parseTripVisibleColumns(searchParams.get('cols'))
    );
    const [sortColumn, setSortColumn] = useState<TripSortColumn>(
        () => parseTripSortColumn(searchParams.get('sort'))
    );
    const [sortDirection, setSortDirection] = useState<TripSortDirection>(
        () => parseTripSortDirection(searchParams.get('dir'))
    );
    const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
    const tripsTableScrollRef = useRef<HTMLDivElement | null>(null);
    const [isTripsTableScrolledHorizontally, setIsTripsTableScrolledHorizontally] = useState(false);
    const [selectedTripDrawerId, setSelectedTripDrawerId] = useState<string | null>(null);
    const [isTripDrawerOpen, setIsTripDrawerOpen] = useState(false);
    const [selectedFullTrip, setSelectedFullTrip] = useState<ITrip | null>(null);
    const [selectedTripAttemptLogRows, setSelectedTripAttemptLogRows] = useState<TripGenerationAttemptSummary[]>([]);
    const [selectedTripGenerationJobRows, setSelectedTripGenerationJobRows] = useState<TripGenerationJobSummary[]>([]);
    const [isLoadingTripAttemptLogRows, setIsLoadingTripAttemptLogRows] = useState(false);
    const [isLoadingTripGenerationJobRows, setIsLoadingTripGenerationJobRows] = useState(false);
    const [requeueingGenerationJobId, setRequeueingGenerationJobId] = useState<string | null>(null);
    const [isRetryingGeneration, setIsRetryingGeneration] = useState(false);
    const [generationNowMs, setGenerationNowMs] = useState(() => Date.now());
    const [drawerRetryModelId, setDrawerRetryModelId] = useState<string>(DEFAULT_RETRY_MODEL_ID);
    const [isLoadingFullTrip, setIsLoadingFullTrip] = useState(false);
    const [drawerLifecycleDraft, setDrawerLifecycleDraft] = useState<TripStatus>('active');
    const [drawerExpirationDraft, setDrawerExpirationDraft] = useState('');
    const handledDeepLinkedTripIdRef = useRef<string | null>(null);
    // Owner details live in the Users sheet; the old owner drawer link forwards there.
    const legacyOwnerDeepLinkTarget = useMemo(() => getLegacyOwnerDeepLinkTarget(searchParams), [searchParams]);
    const deepLinkedTripId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const tripId = searchParams.get('trip');
        if (drawer !== 'trip' || !tripId) return null;
        return tripId;
    }, [searchParams]);

    useEffect(() => {
        if (legacyOwnerDeepLinkTarget) return;
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (statusFilters.length > 0 && statusFilters.length < TRIP_STATUS_VALUES.length) {
            next.set('status', statusFilters.join(','));
        }
        if (generationStateFilters.length > 0 && generationStateFilters.length < TRIP_GENERATION_STATE_VALUES.length) {
            next.set('generation', generationStateFilters.join(','));
        }
        if (expirationFilters.length > 0 && expirationFilters.length < TRIP_EXPIRATION_FILTER_VALUES.length) {
            next.set('expires', expirationFilters.join(','));
        }
        if (sourceFilters.length > 0) {
            next.set('source', sourceFilters.join(','));
        }
        const hasCustomColumns = (
            visibleColumns.length !== DEFAULT_VISIBLE_TRIP_COLUMNS.length
            || visibleColumns.some((columnId, index) => columnId !== DEFAULT_VISIBLE_TRIP_COLUMNS[index])
        );
        if (hasCustomColumns) {
            next.set('cols', visibleColumns.join(','));
        }
        if (dateRange !== '30d') next.set('range', dateRange);
        if (page > 1) next.set('page', String(page));
        if (sortColumn !== DEFAULT_TRIP_SORT_COLUMN || sortDirection !== DEFAULT_TRIP_SORT_DIRECTION) {
            next.set('sort', sortColumn);
            next.set('dir', sortDirection);
        }
        const drawerTripId = selectedTripDrawerId || deepLinkedTripId;
        if ((isTripDrawerOpen || deepLinkedTripId) && drawerTripId) {
            next.set('trip', drawerTripId);
            next.set('drawer', 'trip');
        }
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        dateRange,
        deepLinkedTripId,
        expirationFilters,
        generationStateFilters,
        isTripDrawerOpen,
        legacyOwnerDeepLinkTarget,
        page,
        searchParams,
        searchValue,
        selectedTripDrawerId,
        setSearchParams,
        sortColumn,
        sortDirection,
        sourceFilters,
        statusFilters,
        visibleColumns,
    ]);

    const loadTrips = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setDataSourceNotice(null);
        try {
            const rows = await adminListTrips({
                limit: 600,
                status: 'all',
            });
            setTrips(rows);
            writeAdminCache(TRIPS_CACHE_KEY, rows);
        } catch (error) {
            const reason = reportAdminTripsError('Could not load trips.', error);
            setErrorMessage(reason);
            const cachedRows = readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setTrips(cachedRows);
                setDataSourceNotice(`Live admin trips failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser.`);
            } else {
                setTrips([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadTrips();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedTripForDrawer = useMemo(
        () => trips.find((trip) => trip.trip_id === selectedTripDrawerId) || null,
        [selectedTripDrawerId, trips]
    );
    const selectedFullTripDerivedGenerationState = selectedFullTrip
        ? getTripGenerationState(selectedFullTrip, generationNowMs)
        : null;

    const shouldPollSelectedTripGenerationState = (
        isTripDrawerOpen
        && (
            selectedTripForDrawer?.generation_state === 'running'
            || selectedTripForDrawer?.generation_state === 'queued'
            || selectedFullTripDerivedGenerationState === 'running'
            || selectedFullTripDerivedGenerationState === 'queued'
        )
    );

    useEffect(() => {
        if (!shouldPollSelectedTripGenerationState) return undefined;
        const timer = window.setInterval(() => {
            setGenerationNowMs(Date.now());
        }, 1_000);
        return () => window.clearInterval(timer);
    }, [shouldPollSelectedTripGenerationState]);

    useEffect(() => {
        if (!selectedTripForDrawer || !selectedFullTrip) return;
        const nextState = getTripGenerationState(selectedFullTrip, generationNowMs);
        setTrips((current) => {
            let changed = false;
            const next = current.map((trip) => {
                if (trip.trip_id !== selectedTripForDrawer.trip_id) return trip;
                if (trip.generation_state === nextState) return trip;
                changed = true;
                return {
                    ...trip,
                    generation_state: nextState,
                    updated_at: trip.updated_at || new Date(generationNowMs).toISOString(),
                };
            });
            return changed ? next : current;
        });
    }, [generationNowMs, selectedFullTrip, selectedTripForDrawer]);

    useEffect(() => {
        if (!selectedTripForDrawer) {
            setDrawerLifecycleDraft('active');
            setDrawerExpirationDraft('');
            return;
        }
        setDrawerLifecycleDraft(selectedTripForDrawer.status);
        setDrawerExpirationDraft(toDateTimeInputValue(selectedTripForDrawer.trip_expires_at));
    }, [
        selectedTripForDrawer?.trip_id,
        selectedTripForDrawer?.status,
        selectedTripForDrawer?.trip_expires_at,
    ]);

    useEffect(() => {
        if (!isTripDrawerOpen || !selectedTripDrawerId || !selectedTripForDrawer) {
            setSelectedFullTrip(null);
            return;
        }

        let isMounted = true;
        setIsLoadingFullTrip(true);
        dbGetTrip(selectedTripDrawerId)
            .then((res) => {
                if (!isMounted) return;
                setSelectedFullTrip(res?.trip || null);
            })
            .catch((err) => {
                console.error('Failed to load full trip for drawer preview', err);
                if (isMounted) setSelectedFullTrip(null);
            })
            .finally(() => {
                if (isMounted) setIsLoadingFullTrip(false);
            });

        return () => { isMounted = false; };
    }, [isTripDrawerOpen, selectedTripDrawerId, selectedTripForDrawer]);

    useEffect(() => {
        if (!isTripDrawerOpen || !selectedTripDrawerId || !selectedTripForDrawer) {
            setSelectedTripAttemptLogRows([]);
            return;
        }
        let isMounted = true;
        setIsLoadingTripAttemptLogRows(true);
        void listAdminTripGenerationAttempts(selectedTripDrawerId, 24)
            .then((rows) => {
                if (!isMounted) return;
                setSelectedTripAttemptLogRows(rows);
            })
            .catch(() => {
                if (!isMounted) return;
                setSelectedTripAttemptLogRows([]);
            })
            .finally(() => {
                if (!isMounted) return;
                setIsLoadingTripAttemptLogRows(false);
            });
        return () => {
            isMounted = false;
        };
    }, [isTripDrawerOpen, selectedTripDrawerId, selectedTripForDrawer]);

    useEffect(() => {
        if (!isTripDrawerOpen || !selectedTripDrawerId || !selectedTripForDrawer) {
            setSelectedTripGenerationJobRows([]);
            return;
        }
        let isMounted = true;
        setIsLoadingTripGenerationJobRows(true);
        void listTripGenerationJobsByTrip(selectedTripDrawerId, { limit: 24 })
            .then((rows) => {
                if (!isMounted) return;
                setSelectedTripGenerationJobRows(rows);
            })
            .catch(() => {
                if (!isMounted) return;
                setSelectedTripGenerationJobRows([]);
            })
            .finally(() => {
                if (!isMounted) return;
                setIsLoadingTripGenerationJobRows(false);
            });
        return () => {
            isMounted = false;
        };
    }, [isTripDrawerOpen, selectedTripDrawerId, selectedTripForDrawer]);

    useEffect(() => {
        if (!shouldPollSelectedTripGenerationState || !selectedTripDrawerId) return undefined;

        let cancelled = false;
        const pollTripGenerationUpdates = async () => {
            try {
                const [tripResult, attemptRows, jobRows] = await Promise.all([
                    dbGetTrip(selectedTripDrawerId),
                    listAdminTripGenerationAttempts(selectedTripDrawerId, 24),
                    listTripGenerationJobsByTrip(selectedTripDrawerId, { limit: 24 }),
                ]);
                if (cancelled) return;

                if (Array.isArray(attemptRows)) {
                    setSelectedTripAttemptLogRows(attemptRows);
                }
                if (Array.isArray(jobRows)) {
                    setSelectedTripGenerationJobRows(jobRows);
                }

                const nextTrip = tripResult?.trip || null;
                if (!nextTrip) return;
                setSelectedFullTrip(nextTrip);
                const nextState = getTripGenerationState(nextTrip, Date.now());
                setTrips((current) => {
                    let changed = false;
                    const next = current.map((trip) => {
                        if (trip.trip_id !== selectedTripDrawerId) return trip;
                        if (trip.generation_state === nextState) return trip;
                        changed = true;
                        return {
                            ...trip,
                            generation_state: nextState,
                        };
                    });
                    return changed ? next : current;
                });
            } catch {
                // Keep the current state and continue polling; failures are transient.
            }
        };

        void pollTripGenerationUpdates();
        const timer = window.setInterval(() => {
            void pollTripGenerationUpdates();
        }, 5_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [selectedTripDrawerId, shouldPollSelectedTripGenerationState]);


    const previewCityStops = useMemo(() => {
        if (!selectedFullTrip) return [];
        return getTripCityStops(selectedFullTrip);
    }, [selectedFullTrip]);

    const previewMapUrl = useMemo(() => {
        if (!selectedFullTrip) return null;
        return buildMiniMapUrl(selectedFullTrip, 'en');
    }, [selectedFullTrip]);

    const selectedTripGenerationState = useMemo<TripGenerationState>(() => {
        if (selectedFullTripDerivedGenerationState) {
            return selectedFullTripDerivedGenerationState;
        }
        if (selectedTripForDrawer) {
            return resolveTripGenerationState(selectedTripForDrawer);
        }
        return 'succeeded';
    }, [selectedFullTripDerivedGenerationState, selectedTripForDrawer]);

    const selectedTripGenerationAttempts = useMemo<TripGenerationAttemptSummary[]>(() => {
        const metaAttempts = Array.isArray(selectedFullTrip?.aiMeta?.generation?.attempts)
            ? selectedFullTrip.aiMeta.generation.attempts
            : [];
        return normalizeTripGenerationAttemptsForDisplay(
            [
                ...selectedTripAttemptLogRows,
                ...metaAttempts,
            ],
            {
                nowMs: generationNowMs,
                limit: 12,
            },
        );
    }, [generationNowMs, selectedFullTrip, selectedTripAttemptLogRows]);

    const selectedTripLatestAttempt = useMemo<TripGenerationAttemptSummary | null>(() => {
        if (selectedTripGenerationAttempts.length > 0) return selectedTripGenerationAttempts[0];
        if (selectedFullTrip) {
            return getLatestTripGenerationAttempt(selectedFullTrip);
        }
        return null;
    }, [selectedFullTrip, selectedTripGenerationAttempts]);

    useEffect(() => {
        if (!isTripDrawerOpen || !selectedTripForDrawer) {
            setDrawerRetryModelId(DEFAULT_RETRY_MODEL_ID);
            return;
        }
        setDrawerRetryModelId(resolveRetryModelIdFromAttempt(selectedTripLatestAttempt));
    }, [
        isTripDrawerOpen,
        selectedTripForDrawer?.trip_id,
        selectedTripLatestAttempt?.id,
        selectedTripLatestAttempt?.model,
        selectedTripLatestAttempt?.provider,
    ]);

    const selectedTripGenerationMeta = selectedFullTrip?.aiMeta?.generation || null;
    const selectedTripLatestAttemptMetadata = useMemo<Record<string, unknown> | null>(() => {
        const metadata = selectedTripLatestAttempt?.metadata;
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
        return metadata as Record<string, unknown>;
    }, [selectedTripLatestAttempt?.metadata]);
    const selectedTripRequestPayload = useMemo<Record<string, unknown> | null>(() => {
        const payload = selectedTripLatestAttemptMetadata?.requestPayload;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
        return payload as Record<string, unknown>;
    }, [selectedTripLatestAttemptMetadata]);
    const selectedTripOrchestrationMode = useMemo(() => {
        const value = selectedTripLatestAttemptMetadata?.orchestration;
        return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
    }, [selectedTripLatestAttemptMetadata]);
    const selectedTripLatestAttemptDetails = useMemo(() => {
        const value = selectedTripLatestAttemptMetadata?.details;
        return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
    }, [selectedTripLatestAttemptMetadata]);
    const selectedTripInputSnapshot = useMemo(() => {
        return selectedTripGenerationMeta?.inputSnapshot || null;
    }, [selectedTripGenerationMeta?.inputSnapshot]);
    const selectedTripRetryCount = useMemo(() => {
        if (typeof selectedTripGenerationMeta?.retryCount === 'number') {
            return Math.max(0, Math.round(selectedTripGenerationMeta.retryCount));
        }
        return Math.max(0, selectedTripGenerationAttempts.filter((attempt) => attempt.source.includes('retry')).length);
    }, [selectedTripGenerationAttempts, selectedTripGenerationMeta?.retryCount]);
    const selectedTripDeadLetterJobCount = useMemo(
        () => selectedTripGenerationJobRows.filter((job) => job.state === 'dead').length,
        [selectedTripGenerationJobRows]
    );
    const selectedTripLatestGenerationJob = useMemo(
        () => selectedTripGenerationJobRows[0] || null,
        [selectedTripGenerationJobRows]
    );
    const selectedTripLatestGenerationJobPayload = useMemo<Record<string, unknown> | null>(() => {
        const payload = selectedTripLatestGenerationJob?.payload;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
        return payload as Record<string, unknown>;
    }, [selectedTripLatestGenerationJob?.payload]);

    const groupedRetryModelOptions = useMemo(() => {
        const groups = new Map<string, typeof ACTIVE_RETRY_MODEL_OPTIONS>();
        ACTIVE_RETRY_MODEL_OPTIONS.forEach((option) => {
            const key = option.providerLabel;
            const existing = groups.get(key) || [];
            existing.push(option);
            groups.set(key, existing);
        });
        return Array.from(groups.entries()).map(([providerLabel, options]) => ({
            providerLabel,
            options,
        }));
    }, []);

    const selectedDrawerRetryModelOption = useMemo(
        () => ACTIVE_RETRY_MODEL_OPTIONS.find((option) => option.id === drawerRetryModelId) || null,
        [drawerRetryModelId]
    );

    const canRetryGenerationInDrawer = Boolean(
        selectedTripForDrawer
        && selectedFullTrip
        && selectedFullTrip.aiMeta?.generation?.inputSnapshot
        && selectedTripGenerationState !== 'running'
        && selectedTripGenerationState !== 'queued'
        && !isRetryingGeneration
    );

    const drawerRetryDisabledReason = (
        isRetryingGeneration
            ? 'Retry is already in progress.'
            : !selectedTripForDrawer
                ? 'No trip selected.'
                : !selectedFullTrip?.aiMeta?.generation?.inputSnapshot
                    ? 'Retry is unavailable because no input snapshot was captured for this trip.'
                    : (selectedTripGenerationState === 'running' || selectedTripGenerationState === 'queued')
                        ? 'Retry is unavailable while generation is still running.'
                        : null
    );


    const visibleTrips = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return trips.filter((trip) => {
            if (!isAdminTripInDateRange(trip, dateRange)) return false;
            if (statusFilters.length > 0 && !statusFilters.includes(trip.status)) return false;
            if (generationStateFilters.length > 0 && !generationStateFilters.includes(resolveTripGenerationState(trip))) return false;
            if (expirationFilters.length > 0 && !expirationFilters.includes(getTripExpirationBucket(trip))) return false;
            const normalizedSource = (trip.source_kind || '').trim() || 'unknown';
            if (sourceFilters.length > 0 && !sourceFilters.includes(normalizedSource)) return false;
            if (!token) return true;
            return (
                (trip.title || '').toLowerCase().includes(token)
                || trip.trip_id.toLowerCase().includes(token)
                || (trip.owner_email || '').toLowerCase().includes(token)
                || trip.owner_id.toLowerCase().includes(token)
                || normalizedSource.toLowerCase().includes(token)
            );
        });
    }, [dateRange, expirationFilters, generationStateFilters, searchValue, sourceFilters, statusFilters, trips]);

    const sortedVisibleTrips = useMemo(() => {
        const compareText = (left: string, right: string): number => left.localeCompare(right, undefined, { sensitivity: 'base' });
        const getDateValue = (value: string | null | undefined): number | null => {
            if (!value) return null;
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const compareDate = (left: string | null | undefined, right: string | null | undefined): number => {
            const leftValue = getDateValue(left);
            const rightValue = getDateValue(right);
            if (leftValue === null && rightValue === null) return 0;
            if (leftValue === null) return 1;
            if (rightValue === null) return -1;
            return leftValue - rightValue;
        };
        const compareBySortColumn = (left: AdminTripRecord, right: AdminTripRecord): number => {
            if (sortColumn === 'trip') {
                return compareText((left.title || left.trip_id).trim(), (right.title || right.trip_id).trim());
            }
            if (sortColumn === 'owner') {
                return compareText(left.owner_email || left.owner_id, right.owner_email || right.owner_id);
            }
            if (sortColumn === 'lifecycle') {
                const order: Record<TripStatus, number> = { active: 0, expired: 1, archived: 2 };
                return order[left.status] - order[right.status];
            }
            if (sortColumn === 'generation') {
                const order: Record<TripGenerationState, number> = { failed: 0, running: 1, queued: 2, succeeded: 3 };
                return order[resolveTripGenerationState(left)] - order[resolveTripGenerationState(right)];
            }
            if (sortColumn === 'source') {
                return compareText(
                    formatSourceKindLabel(left.source_kind),
                    formatSourceKindLabel(right.source_kind),
                );
            }
            if (sortColumn === 'expires') {
                return compareDate(left.trip_expires_at, right.trip_expires_at);
            }
            if (sortColumn === 'updated') {
                return compareDate(left.updated_at, right.updated_at);
            }
            if (sortColumn === 'created') {
                return compareDate(left.created_at, right.created_at);
            }
            if (sortColumn === 'archived') {
                return compareDate(left.archived_at, right.archived_at);
            }
            return 0;
        };
        return visibleTrips.slice().sort((left, right) => {
            const base = compareBySortColumn(left, right);
            if (base === 0) return left.trip_id.localeCompare(right.trip_id);
            return sortDirection === 'asc' ? base : -base;
        });
    }, [sortColumn, sortDirection, visibleTrips]);
    const tripPageCount = Math.max(Math.ceil(sortedVisibleTrips.length / TRIPS_PAGE_SIZE), 1);
    const pagedTrips = useMemo(() => {
        const start = (page - 1) * TRIPS_PAGE_SIZE;
        return sortedVisibleTrips.slice(start, start + TRIPS_PAGE_SIZE);
    }, [page, sortedVisibleTrips]);

    const tripsInDateRange = useMemo(
        () => trips.filter((trip) => isAdminTripInDateRange(trip, dateRange)),
        [dateRange, trips]
    );

    const summary = useMemo(() => summarizeAdminTrips(tripsInDateRange), [tripsInDateRange]);
    const selectedVisibleTrips = useMemo(
        () => visibleTrips.filter((trip) => selectedTripIds.has(trip.trip_id)),
        [selectedTripIds, visibleTrips]
    );
    const pageTripIds = useMemo(() => pagedTrips.map((trip) => trip.trip_id), [pagedTrips]);
    const pageSelectionState = getPageSelectionState(pageTripIds, selectedTripIds);
    const canSelectAllMatchingTrips = (
        pageSelectionState === 'all'
        && selectedVisibleTrips.length < visibleTrips.length
    );
    const activeTripFilterCount = (
        statusFilters.length
        + generationStateFilters.length
        + expirationFilters.length
        + sourceFilters.length
    );
    const hasActiveTripFilters = activeTripFilterCount > 0;
    const visibleTripColumnSet = useMemo(() => new Set<TripVisibleColumnId>(visibleColumns), [visibleColumns]);
    const isTripColumnVisible = (columnId: TripVisibleColumnId): boolean => visibleTripColumnSet.has(columnId);
    const tripsTableColumnCount = visibleColumns.length + 3;

    useEffect(() => {
        if (page > tripPageCount) {
            setPage(tripPageCount);
        }
    }, [page, tripPageCount]);

    const statusFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => TRIP_STATUS_VALUES.map((value) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
            count: tripsInDateRange.filter((trip) => trip.status === value).length,
        })),
        [tripsInDateRange]
    );

    const generationFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => TRIP_GENERATION_STATE_VALUES.map((value) => ({
            value,
            label: getGenerationStateLabel(value),
            count: tripsInDateRange.filter((trip) => resolveTripGenerationState(trip) === value).length,
        })),
        [tripsInDateRange]
    );

    const expirationFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => TRIP_EXPIRATION_FILTER_VALUES.map((value) => ({
            value,
            label: getExpirationFilterLabel(value),
            count: tripsInDateRange.filter((trip) => getTripExpirationBucket(trip) === value).length,
        })),
        [tripsInDateRange]
    );

    const sourceFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        tripsInDateRange.forEach((trip) => {
            const normalizedSource = (trip.source_kind || '').trim() || 'unknown';
            counts.set(normalizedSource, (counts.get(normalizedSource) || 0) + 1);
        });
        return Array.from(counts.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([value, count]) => ({
                value,
                label: formatSourceKindLabel(value),
                count,
            }));
    }, [tripsInDateRange]);

    useEffect(() => {
        if (sourceFilters.length === 0) return;
        const allowed = new Set(sourceFilterOptions.map((option) => option.value));
        setSourceFilters((current) => {
            const next = current.filter((value) => allowed.has(value));
            return next.length === current.length ? current : next;
        });
    }, [sourceFilterOptions, sourceFilters.length]);

    const visibleTripColumnOptions = useMemo<AdminFilterMenuOption[]>(
        () => TRIP_VISIBLE_COLUMN_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
        []
    );

    const updateTripStatus = async (
        trip: AdminTripRecord,
        patch: {
            status?: 'active' | 'archived' | 'expired';
            tripExpiresAt?: string | null;
        },
        successMessage = 'Trip updated.'
    ) => {
        setIsSaving(true);
        setErrorMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, patch);
            notifyTripsResult(successMessage);
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not update trip.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedTripDrawerExpirationIso = normalizeIsoTimestamp(selectedTripForDrawer?.trip_expires_at);
    const drawerDraftExpirationIso = normalizeIsoTimestamp(fromDateTimeInputValue(drawerExpirationDraft));
    const hasDrawerLifecycleChanges = Boolean(
        selectedTripForDrawer
        && (
            drawerLifecycleDraft !== selectedTripForDrawer.status
            || drawerDraftExpirationIso !== selectedTripDrawerExpirationIso
        )
    );

    const handleSaveDrawerLifecycle = async () => {
        if (!selectedTripForDrawer) return;
        const patch: {
            status?: 'active' | 'archived' | 'expired';
            tripExpiresAt?: string | null;
        } = {};
        if (drawerLifecycleDraft !== selectedTripForDrawer.status) {
            patch.status = drawerLifecycleDraft;
        }
        if (drawerDraftExpirationIso !== selectedTripDrawerExpirationIso) {
            patch.tripExpiresAt = drawerDraftExpirationIso;
        }
        if (Object.keys(patch).length === 0) return;
        await updateTripStatus(selectedTripForDrawer, patch, 'Trip lifecycle settings saved.');
    };

    const handleRetryTripGeneration = async () => {
        if (!selectedTripForDrawer || !selectedFullTrip) return;
        if (!selectedFullTrip.aiMeta?.generation?.inputSnapshot) {
            setErrorMessage('Retry is unavailable because this trip has no generation input snapshot.');
            return;
        }

        setIsRetryingGeneration(true);
        setIsSaving(true);
        setErrorMessage(null);

        try {
            const result = await retryTripGenerationWithDefaultModel(selectedFullTrip, {
                source: 'admin_trip_drawer',
                contextSource: 'admin_trip_drawer',
                modelId: drawerRetryModelId,
                onTripUpdate: async (nextTrip) => {
                    setSelectedFullTrip(nextTrip);
                    const committed = await dbAdminOverrideTripCommit(nextTrip, nextTrip.defaultView ?? undefined, 'Data: Admin retried generation');
                    if (!committed) {
                        throw new Error('Could not persist retried trip via admin override.');
                    }
                },
            });

            if (result.state === 'queued') {
                notifyTripsResult('Generation retry queued. It runs in the background.');
            } else {
                notifyTripsResult('Generation retry failed. The diagnostics below are updated.', 'warning');
            }
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not retry generation.', error));
        } finally {
            setIsRetryingGeneration(false);
            setIsSaving(false);
        }
    };

    const handleRequeueGenerationJob = async (job: TripGenerationJobSummary) => {
        if (!selectedTripForDrawer) return;
        if (job.state !== 'dead' && job.state !== 'failed') return;

        setRequeueingGenerationJobId(job.id);
        setErrorMessage(null);

        try {
            const requeued = await requeueTripGenerationJob(job.id, {
                reason: 'admin_trip_drawer_manual_requeue',
                resetRetryCount: true,
            });
            if (!requeued) {
                throw new Error('Could not requeue generation job.');
            }

            notifyTripsResult('Generation job requeued.', 'success', 'The worker queue will process this job again.');

            const [tripResult, attemptRows, jobRows] = await Promise.all([
                dbGetTrip(selectedTripForDrawer.trip_id),
                listAdminTripGenerationAttempts(selectedTripForDrawer.trip_id, 24),
                listTripGenerationJobsByTrip(selectedTripForDrawer.trip_id, { limit: 24 }),
            ]);

            setSelectedTripAttemptLogRows(attemptRows);
            setSelectedTripGenerationJobRows(jobRows);

            const refreshedTrip = tripResult?.trip || null;
            if (refreshedTrip) {
                setSelectedFullTrip(refreshedTrip);
                const nextState = getTripGenerationState(refreshedTrip, Date.now());
                setTrips((current) => current.map((trip) => (
                    trip.trip_id === refreshedTrip.id
                        ? {
                            ...trip,
                            generation_state: nextState,
                            updated_at: new Date().toISOString(),
                        }
                        : trip
                )));
            } else {
                await loadTrips();
            }
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not requeue generation job.', error));
        } finally {
            setRequeueingGenerationJobId(null);
        }
    };

    const handleOpenBenchmarkFromDrawer = () => {
        if (!selectedTripForDrawer) return;
        const snapshot = selectedFullTrip?.aiMeta?.generation?.inputSnapshot || null;
        const importUrl = buildBenchmarkScenarioImportUrl({
            snapshot,
            source: 'admin_trip_drawer',
            tripId: selectedTripForDrawer.trip_id,
        });
        if (!importUrl) {
            setErrorMessage('No generation input snapshot available for benchmark import.');
            return;
        }
        window.open(importUrl, '_blank', 'noopener,noreferrer');
        notifyTripsResult('Opened the AI benchmark with this trip\'s generation input.', 'info');
    };

    const resolveTransferTargetUser = async (rawInput: string): Promise<AdminUserRecord> => {
        const normalizedInput = rawInput.trim();
        if (!normalizedInput) {
            throw new AdminUserFacingError('Enter a target user email or UUID.');
        }
        const normalizedLower = normalizedInput.toLowerCase();

        if (isLikelyUserId(normalizedInput)) {
            const profile = await adminGetUserProfile(normalizedInput);
            if (profile) return profile;
        }

        if (isLikelyEmail(normalizedInput)) {
            const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
            const exactMatches = rows.filter((candidate) => (candidate.email || '').trim().toLowerCase() === normalizedLower);
            if (exactMatches.length > 1) {
                throw new AdminUserFacingError('Multiple users found for that email. Enter a UUID instead.');
            }
            if (exactMatches.length === 1) {
                return exactMatches[0];
            }
        }

        const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
        const idMatches = rows.filter((candidate) => candidate.user_id.toLowerCase() === normalizedLower);
        if (idMatches.length > 1) {
            throw new AdminUserFacingError('Multiple users matched that UUID. Enter a more specific value.');
        }
        if (idMatches.length === 1) {
            return idMatches[0];
        }

        throw new AdminUserFacingError('Target user not found. Enter an existing user email or UUID.');
    };

    const handleOpenTripPreview = (trip: AdminTripRecord) => {
        const href = getTripLink(trip.trip_id);
        window.open(href, '_blank', 'noopener,noreferrer');
    };

    const handleTransferTrip = async (trip: AdminTripRecord) => {
        const transferTargetInput = await promptDialog(buildTransferTargetPromptDialog({
            title: 'Transfer trip owner',
            message: 'Enter the target user email or UUID for this trip.',
            confirmLabel: 'Continue',
            label: 'Target owner (email or UUID)',
        }));
        if (transferTargetInput === null) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const targetUser = await resolveTransferTargetUser(transferTargetInput);
            if (targetUser.user_id === trip.owner_id) {
                throw new AdminUserFacingError('Target owner is already the current owner.');
            }
            const targetStatus = (targetUser.account_status || 'active').toLowerCase();
            if (targetStatus !== 'active') {
                throw new AdminUserFacingError('Target user must be an active account.');
            }

            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Confirm transfer',
                message: `Transfer this trip to ${getUserReferenceText(targetUser)}?`,
                confirmLabel: 'Transfer',
            }));
            if (!confirmed) return;

            await adminUpdateTrip(trip.trip_id, { ownerId: targetUser.user_id });
            notifyTripsResult(`Trip owner transferred to ${getUserReferenceText(targetUser)}.`);
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not transfer trip owner.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDuplicateTrip = async (trip: AdminTripRecord) => {
        const transferTargetInput = await promptDialog(buildTransferTargetPromptDialog({
            title: 'Duplicate trip',
            message: 'Optionally enter a target user email or UUID for the duplicated trip. Leave blank to keep ownership unchanged.',
            label: 'Target owner (optional)',
            defaultValue: '',
            confirmLabel: 'Duplicate',
            tone: 'default',
        }));
        if (transferTargetInput === null) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const targetInput = transferTargetInput.trim();
            const targetUser = targetInput ? await resolveTransferTargetUser(targetInput) : null;
            if (targetUser) {
                const targetStatus = (targetUser.account_status || 'active').toLowerCase();
                if (targetStatus !== 'active') {
                    throw new AdminUserFacingError('Target user must be an active account.');
                }
            }

            const result = await dbGetTrip(trip.trip_id);
            if (!result?.trip) {
                throw new AdminUserFacingError('Could not load source trip data for duplication.');
            }

            const sourceTrip = result.trip;
            const now = Date.now();
            const duplicatedTripId = generateTripId();
            const duplicatedTrip: ITrip = {
                ...sourceTrip,
                id: duplicatedTripId,
                title: buildDuplicateTitle(sourceTrip.title || trip.title),
                createdAt: now,
                updatedAt: now,
                status: 'active',
                tripExpiresAt: null,
                isFavorite: false,
                sourceKind: 'duplicate_trip',
                forkedFromTripId: trip.trip_id,
            };

            const upsertedTripId = await dbUpsertTrip(duplicatedTrip, result.view || undefined);
            if (!upsertedTripId) {
                throw new AdminUserFacingError('Could not save duplicated trip.');
            }

            if (targetUser && targetUser.user_id !== trip.owner_id) {
                await adminUpdateTrip(upsertedTripId, { ownerId: targetUser.user_id });
                notifyTripsResult(`Trip duplicated and transferred to ${getUserReferenceText(targetUser)}.`);
            } else {
                notifyTripsResult('Trip duplicated.');
            }

            await loadTrips();
            openTripDrawer(upsertedTripId);
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not duplicate trip.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadTripJson = async (trip: AdminTripRecord) => {
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const result = await dbGetTrip(trip.trip_id);
            if (!result?.trip) {
                throw new AdminUserFacingError('Could not load trip JSON.');
            }
            const payload = {
                exported_at: new Date().toISOString(),
                trip_id: trip.trip_id,
                owner_id: trip.owner_id,
                owner_email: trip.owner_email,
                title: trip.title,
                status: trip.status,
                trip_expires_at: trip.trip_expires_at,
                trip: result.trip,
                view: result.view,
                access: result.access,
            };
            const fileName = `${sanitizeFilenameSegment(trip.title || 'trip')}-${sanitizeFilenameSegment(trip.trip_id)}.json`;
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            downloadBlob(blob, fileName);
            notifyTripsResult('Trip JSON downloaded.');
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not download trip JSON.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSoftDeleteTrip = async (trip: AdminTripRecord) => {
        const nextStatus: TripStatus = trip.status === 'archived' ? 'active' : 'archived';
        if (nextStatus === 'archived') {
            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Archive trip',
                message: `Archive ${trip.title || trip.trip_id}?`,
                confirmLabel: 'Archive',
            }));
            if (!confirmed) return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, { status: nextStatus });
            notifyTripsResult(nextStatus === 'archived' ? 'Trip archived.' : 'Trip restored.');
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not update trip status.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleHardDeleteTrip = async (trip: AdminTripRecord) => {
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Delete trip permanently',
            message: `Permanently delete ${trip.title || trip.trip_id}? This cannot be undone.`,
            confirmLabel: 'Delete permanently',
        }));
        if (!confirmed) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            await adminHardDeleteTrip(trip.trip_id);
            notifyTripsResult('Trip permanently deleted.');
            if (selectedTripDrawerId === trip.trip_id) {
                setIsTripDrawerOpen(false);
                setSelectedTripDrawerId(null);
            }
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not hard-delete trip.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const resetTripFilters = () => {
        setStatusFilters([]);
        setGenerationStateFilters([]);
        setExpirationFilters([]);
        setSourceFilters([]);
        setPage(1);
    };

    // A KPI tile narrows the table to the trips it counts.
    const applyKpiFilter = (kpi: 'failed' | 'generating' | 'expiring') => {
        trackEvent('admin__trips_kpi--filter', { kpi });
        setSourceFilters([]);
        setGenerationStateFilters(
            kpi === 'failed' ? ['failed'] : kpi === 'generating' ? ['running', 'queued'] : []
        );
        // "Expiring soon" counts trips that are not archived.
        setStatusFilters(kpi === 'expiring' ? ['active', 'expired'] : []);
        setExpirationFilters(kpi === 'expiring' ? ['expiring_24h', 'expiring_7d'] : []);
        setPage(1);
    };

    const handleSortChange = (column: TripSortColumn) => {
        if (sortColumn !== column) {
            setSortColumn(column);
            setSortDirection(column === 'updated' || column === 'created' || column === 'expires' || column === 'archived'
                ? 'desc'
                : 'asc');
            setPage(1);
            return;
        }
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        setPage(1);
    };

    const isTripSortedColumn = (column: TripSortColumn): boolean => sortColumn === column;
    const getTripAriaSort = (column: TripSortColumn): 'ascending' | 'descending' | undefined => {
        if (!isTripSortedColumn(column)) return undefined;
        return sortDirection === 'asc' ? 'ascending' : 'descending';
    };

    const openTripDrawer = (tripId: string) => {
        setErrorMessage(null);
        setSelectedTripDrawerId(tripId);
        setIsTripDrawerOpen(true);
    };

    const handleTripSheetOpenChange = (open: boolean) => {
        setIsTripDrawerOpen(open);
        if (open) return;
        setSelectedTripDrawerId(null);
        if (searchParams.has('trip') || searchParams.get('drawer') === 'trip') {
            const next = new URLSearchParams(searchParams);
            next.delete('trip');
            next.delete('drawer');
            setSearchParams(next, { replace: true });
        }
    };

    const toggleTripSelection = (tripId: string, checked: boolean) => {
        setSelectedTripIds((current) => {
            const next = new Set(current);
            if (checked) next.add(tripId);
            else next.delete(tripId);
            return next;
        });
    };

    // The header checkbox selects the rows you can see. Reaching past the page
    // is an explicit second step in the selection bar, so a bulk delete never
    // covers rows the admin has not looked at by accident.
    const toggleSelectPageTrips = (checked: boolean) => {
        setSelectedTripIds((current) => {
            const next = new Set(current);
            pageTripIds.forEach((tripId) => {
                if (checked) next.add(tripId);
                else next.delete(tripId);
            });
            return next;
        });
    };

    const selectAllMatchingTrips = () => {
        trackEvent('admin__trips_selection--select_all_matching', { count: visibleTrips.length });
        setSelectedTripIds(new Set(visibleTrips.map((trip) => trip.trip_id)));
    };

    const handleBulkSoftDeleteTrips = async () => {
        if (selectedVisibleTrips.length === 0) return;
        trackEvent('admin__trips_bulk--archive', { count: selectedVisibleTrips.length });
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Archive selected trips',
            message: `Archive ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? '' : 's'}?`,
            confirmLabel: 'Archive',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            await Promise.all(selectedVisibleTrips.map((trip) => adminUpdateTrip(trip.trip_id, { status: 'archived' })));
            notifyTripsResult(`${selectedVisibleTrips.length} trip${selectedVisibleTrips.length === 1 ? '' : 's'} archived.`);
            setSelectedTripIds(new Set());
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not archive selected trips.', error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkHardDeleteTrips = async () => {
        if (selectedVisibleTrips.length === 0) return;
        trackEvent('admin__trips_bulk--delete', { count: selectedVisibleTrips.length });
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Delete selected trips permanently',
            message: `Permanently delete ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? '' : 's'}? This cannot be undone.`,
            confirmLabel: 'Delete permanently',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const results = await Promise.allSettled(selectedVisibleTrips.map((trip) => adminHardDeleteTrip(trip.trip_id)));
            const failed = results.filter((result) => result.status === 'rejected').length;
            const deleted = results.length - failed;
            if (deleted > 0) {
                notifyTripsResult(
                    failed > 0
                        ? `${deleted} trip${deleted === 1 ? '' : 's'} permanently deleted. ${failed} failed.`
                        : `${deleted} trip${deleted === 1 ? '' : 's'} permanently deleted.`,
                    failed > 0 ? 'warning' : 'success',
                );
            }
            if (failed > 0 && deleted === 0) {
                throw new Error('Could not hard-delete selected trips.');
            }
            setSelectedTripIds(new Set());
            await loadTrips();
        } catch (error) {
            setErrorMessage(reportAdminTripsError('Could not hard-delete selected trips.', error));
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!deepLinkedTripId) {
            handledDeepLinkedTripIdRef.current = null;
            return;
        }
        if (handledDeepLinkedTripIdRef.current !== deepLinkedTripId) {
            setSelectedTripDrawerId(deepLinkedTripId);
            setIsTripDrawerOpen(true);
            handledDeepLinkedTripIdRef.current = deepLinkedTripId;
        }

        const hasTripInList = trips.some((trip) => trip.trip_id === deepLinkedTripId);
        if (hasTripInList) return;

        let active = true;
        void adminListTrips({ search: deepLinkedTripId, limit: 20, status: 'all' })
            .then((rows) => {
                if (!active) return;
                const exactMatch = rows.find((row) => row.trip_id === deepLinkedTripId);
                if (!exactMatch) return;
                setTrips((current) => {
                    const exists = current.some((candidate) => candidate.trip_id === exactMatch.trip_id);
                    const nextTrips = exists
                        ? current.map((candidate) => (
                            candidate.trip_id === exactMatch.trip_id ? { ...candidate, ...exactMatch } : candidate
                        ))
                        : [exactMatch, ...current];
                    writeAdminCache(TRIPS_CACHE_KEY, nextTrips);
                    return nextTrips;
                });
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(reportAdminTripsError('Could not load linked trip.', error));
            });

        return () => {
            active = false;
        };
    }, [deepLinkedTripId, trips]);

    useEffect(() => {
        setSelectedTripIds((current) => {
            if (current.size === 0) return current;
            const allowed = new Set(visibleTrips.map((trip) => trip.trip_id));
            let changed = false;
            const next = new Set<string>();
            current.forEach((tripId) => {
                if (allowed.has(tripId)) {
                    next.add(tripId);
                    return;
                }
                changed = true;
            });
            return changed ? next : current;
        });
    }, [visibleTrips]);

    useEffect(() => {
        const root = tripsTableScrollRef.current;
        const node = root?.querySelector<HTMLElement>('[data-slot="table-container"]');
        if (!node) return;
        const handleScroll = () => {
            setIsTripsTableScrolledHorizontally(node.scrollLeft > 4);
        };
        handleScroll();
        node.addEventListener('scroll', handleScroll, { passive: true });
        return () => node.removeEventListener('scroll', handleScroll);
    }, [visibleTrips.length]);


    if (legacyOwnerDeepLinkTarget) {
        return <Navigate to={legacyOwnerDeepLinkTarget} replace />;
    }

    const sortableHeader = (column: TripSortColumn, label: string) => (
        <TableHead
            aria-sort={getTripAriaSort(column)}
            className={`px-4 font-medium text-muted-foreground ${isTripSortedColumn(column) ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}
        >
            <AdminSortHeaderButton
                label={label}
                isActive={isTripSortedColumn(column)}
                direction={sortDirection}
                onClick={() => handleSortChange(column)}
            />
        </TableHead>
    );
    const sortedCellClass = (column: TripSortColumn): string => (
        isTripSortedColumn(column) ? ADMIN_TABLE_SORTED_CELL_CLASS : ''
    );
    const kpiFilterButton = (kpi: 'failed' | 'generating' | 'expiring', label: string) => (
        <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => applyKpiFilter(kpi)}
            {...getAnalyticsDebugAttributes('admin__trips_kpi--filter', { kpi })}
        >
            {label}
        </Button>
    );
    const selectedTrip = selectedTripForDrawer;

    return (
        <AdminShell
            title="Trips"
            description="Find a trip, fix failed generations, and manage status, expiry and ownership."
            searchValue={searchValue}
            onSearchValueChange={(value) => {
                setSearchValue(value);
                setPage(1);
            }}
            dateRange={dateRange}
            onDateRangeChange={(value) => {
                setDateRange(value);
                setPage(1);
            }}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadTrips()}
                    isLoading={isLoading}
                    label="Reload"
                />
            )}
        >
            <div className="flex flex-col gap-4">
                {errorMessage && !isTripDrawerOpen && <AdminErrorAlert message={errorMessage} />}
                {dataSourceNotice && (
                    <Alert variant="warning">
                        <Warning weight="fill" />
                        <AlertDescription>{dataSourceNotice}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard
                        label="Failed generation"
                        icon={<WarningCircle />}
                        value={<AdminCountUpNumber value={summary.failedGeneration} />}
                        hint={summary.failedGeneration > 0 ? 'Open a trip to retry it.' : 'Nothing to retry.'}
                        hintTone={summary.failedGeneration > 0 ? 'negative' : 'neutral'}
                        isLoading={isLoading}
                    >
                        {summary.failedGeneration > 0 && kpiFilterButton('failed', 'Show failed')}
                    </AdminStatCard>
                    <AdminStatCard
                        label="Generating now"
                        icon={<SpinnerGap />}
                        value={<AdminCountUpNumber value={summary.generating} />}
                        hint="Queued or running."
                        isLoading={isLoading}
                    >
                        {summary.generating > 0 && kpiFilterButton('generating', 'Show generating')}
                    </AdminStatCard>
                    <AdminStatCard
                        label="Expiring in 7 days"
                        icon={<Hourglass />}
                        value={<AdminCountUpNumber value={summary.expiringSoon} />}
                        hint={summary.expiringSoon > 0 ? 'Extend the date in the trip’s details.' : 'None due this week.'}
                        hintTone={summary.expiringSoon > 0 ? 'warning' : 'neutral'}
                        isLoading={isLoading}
                    >
                        {summary.expiringSoon > 0 && kpiFilterButton('expiring', 'Show expiring')}
                    </AdminStatCard>
                    <AdminStatCard
                        label="Active trips"
                        icon={<SuitcaseRolling />}
                        value={<AdminCountUpNumber value={summary.active} />}
                        hint={`Of ${summary.total.toLocaleString()} updated in this range.`}
                        isLoading={isLoading}
                    />
                </div>

                <AdminSurfaceCard className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Trip filters">
                        <AdminFilterMenu
                            label="Status"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={(next) => {
                                setStatusFilters(next as TripStatus[]);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Generation"
                            options={generationFilterOptions}
                            selectedValues={generationStateFilters}
                            onSelectedValuesChange={(next) => {
                                setGenerationStateFilters(next as TripGenerationState[]);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Expiration"
                            options={expirationFilterOptions}
                            selectedValues={expirationFilters}
                            onSelectedValuesChange={(next) => {
                                setExpirationFilters(next as TripExpirationFilter[]);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Source"
                            options={sourceFilterOptions}
                            selectedValues={sourceFilters}
                            onSelectedValuesChange={(next) => {
                                setSourceFilters(next);
                                setPage(1);
                            }}
                        />
                        {hasActiveTripFilters && (
                            <Button type="button" variant="ghost" size="sm" onClick={resetTripFilters}>
                                <X size={14} />
                                Reset
                            </Button>
                        )}
                        <AdminFilterMenu
                            className="ms-auto"
                            label="Columns"
                            options={visibleTripColumnOptions}
                            selectedValues={visibleColumns}
                            selectAllLabel="Show all"
                            clearLabel="Default columns"
                            onSelectedValuesChange={(next) => {
                                setVisibleColumns(sanitizeTripVisibleColumns(next));
                            }}
                        />
                    </div>

                    <div ref={tripsTableScrollRef} className="overflow-hidden rounded-lg border border-border bg-card">
                        <Table className="w-[max(100%,960px)]">
                            <TableHeader className="bg-secondary">
                                <TableRow>
                                    <TableHead
                                        className={`sticky start-0 z-40 px-4 ${getAdminStickyHeaderCellClass({
                                            isScrolled: isTripsTableScrolledHorizontally,
                                            isFirst: true,
                                        })}`}
                                        style={{ width: SELECT_COLUMN_WIDTH, minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH }}
                                    >
                                        <Checkbox
                                            checked={pageSelectionState === 'all' ? true : (pageSelectionState === 'some' ? 'indeterminate' : false)}
                                            onCheckedChange={(checked) => toggleSelectPageTrips(Boolean(checked))}
                                            disabled={pageTripIds.length === 0}
                                            aria-label="Select all trips on this page"
                                        />
                                    </TableHead>
                                    <TableHead
                                        aria-sort={getTripAriaSort('trip')}
                                        className={`sticky z-30 px-4 font-medium text-muted-foreground ${getAdminStickyHeaderCellClass({
                                            isScrolled: isTripsTableScrolledHorizontally,
                                            isFirst: false,
                                            isSorted: isTripSortedColumn('trip'),
                                        })}`}
                                        style={{ insetInlineStart: SELECT_COLUMN_WIDTH, width: TRIP_COLUMN_WIDTH, minWidth: TRIP_COLUMN_WIDTH, maxWidth: TRIP_COLUMN_WIDTH }}
                                    >
                                        <AdminSortHeaderButton
                                            label="Trip"
                                            isActive={isTripSortedColumn('trip')}
                                            direction={sortDirection}
                                            onClick={() => handleSortChange('trip')}
                                        />
                                    </TableHead>
                                    {isTripColumnVisible('owner') && sortableHeader('owner', 'Owner')}
                                    {isTripColumnVisible('lifecycle') && sortableHeader('lifecycle', 'Status')}
                                    {isTripColumnVisible('generation') && sortableHeader('generation', 'Generation')}
                                    {isTripColumnVisible('source') && sortableHeader('source', 'Source')}
                                    {isTripColumnVisible('expires') && sortableHeader('expires', 'Expires')}
                                    {isTripColumnVisible('updated') && sortableHeader('updated', 'Updated')}
                                    {isTripColumnVisible('created') && sortableHeader('created', 'Created')}
                                    {isTripColumnVisible('archived') && sortableHeader('archived', 'Archived')}
                                    <TableHead className="w-12 px-4">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagedTrips.map((trip) => {
                                    const isSelected = selectedTripIds.has(trip.trip_id);
                                    const generationState = resolveTripGenerationState(trip);
                                    const normalizedSource = (trip.source_kind || '').trim() || 'unknown';
                                    const tripName = trip.title || 'Untitled trip';
                                    return (
                                        <TableRow
                                            key={trip.trip_id}
                                            className={ADMIN_TABLE_ROW_SURFACE_CLASS}
                                            data-state={isSelected ? 'selected' : undefined}
                                        >
                                            <TableCell
                                                className={`sticky start-0 z-40 px-4 py-2.5 ${getAdminStickyBodyCellClass({
                                                    isSelected,
                                                    isScrolled: isTripsTableScrolledHorizontally,
                                                    isFirst: true,
                                                })}`}
                                                style={{ width: SELECT_COLUMN_WIDTH, minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH }}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => toggleTripSelection(trip.trip_id, Boolean(checked))}
                                                    aria-label={`Select trip ${tripName}`}
                                                />
                                            </TableCell>
                                            <TableCell
                                                className={`sticky z-30 px-4 py-2.5 ${getAdminStickyBodyCellClass({
                                                    isSelected,
                                                    isScrolled: isTripsTableScrolledHorizontally,
                                                    isFirst: false,
                                                    isSorted: isTripSortedColumn('trip'),
                                                })}`}
                                                style={{ insetInlineStart: SELECT_COLUMN_WIDTH, width: TRIP_COLUMN_WIDTH, minWidth: TRIP_COLUMN_WIDTH, maxWidth: TRIP_COLUMN_WIDTH }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => openTripDrawer(trip.trip_id)}
                                                    className="block max-w-full truncate rounded-sm text-start text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                                    aria-label={`Open details for ${tripName}`}
                                                >
                                                    {tripName}
                                                </button>
                                                <div className="mt-0.5 text-xs text-muted-foreground">
                                                    <CopyableUuid
                                                        value={trip.trip_id}
                                                        textClassName="max-w-full truncate text-xs"
                                                        hintClassName="text-[9px]"
                                                    />
                                                </div>
                                            </TableCell>
                                            {isTripColumnVisible('owner') && (
                                                <TableCell className={`max-w-[240px] px-4 py-2.5 ${sortedCellClass('owner')}`}>
                                                    <Link
                                                        to={buildAdminUserSheetPath(trip.owner_id)}
                                                        onClick={() => trackEvent('admin__trips_owner--open_user')}
                                                        {...getAnalyticsDebugAttributes('admin__trips_owner--open_user')}
                                                        data-tooltip="Open owner in Users"
                                                        className="block truncate rounded-sm text-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                                    >
                                                        {trip.owner_email || trip.owner_id}
                                                    </Link>
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('lifecycle') && (
                                                <TableCell className={`px-4 py-2.5 ${sortedCellClass('lifecycle')}`}>
                                                    <AdminStatusBadge tone={getLifecycleTone(trip.status)}>
                                                        {getLifecycleLabel(trip.status)}
                                                    </AdminStatusBadge>
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('generation') && (
                                                <TableCell className={`px-4 py-2.5 ${sortedCellClass('generation')}`}>
                                                    <AdminStatusBadge tone={getGenerationTone(generationState)}>
                                                        {getGenerationStateLabel(generationState)}
                                                    </AdminStatusBadge>
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('source') && (
                                                <TableCell className={`px-4 py-2.5 text-sm text-foreground ${sortedCellClass('source')}`}>
                                                    <span data-tooltip={normalizedSource}>{formatSourceKindLabel(normalizedSource)}</span>
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('expires') && (
                                                <TableCell className={`px-4 py-2.5 text-sm text-foreground ${sortedCellClass('expires')}`}>
                                                    <RelativeTime value={trip.trip_expires_at} fallback="Never" />
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('updated') && (
                                                <TableCell className={`px-4 py-2.5 text-sm text-foreground ${sortedCellClass('updated')}`}>
                                                    <RelativeTime value={trip.updated_at} fallback="—" />
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('created') && (
                                                <TableCell className={`px-4 py-2.5 text-sm text-foreground ${sortedCellClass('created')}`}>
                                                    <RelativeTime value={trip.created_at} fallback="—" />
                                                </TableCell>
                                            )}
                                            {isTripColumnVisible('archived') && (
                                                <TableCell className={`px-4 py-2.5 text-sm text-foreground ${sortedCellClass('archived')}`}>
                                                    <RelativeTime value={trip.archived_at} fallback="—" />
                                                </TableCell>
                                            )}
                                            <TableCell className="px-4 py-2.5 text-end">
                                                <TripRowActionsMenu
                                                    trip={trip}
                                                    disabled={isSaving}
                                                    onOpenDetails={(candidate) => openTripDrawer(candidate.trip_id)}
                                                    onPreviewTrip={handleOpenTripPreview}
                                                    onDuplicateTrip={(candidate) => {
                                                        void handleDuplicateTrip(candidate);
                                                    }}
                                                    onTransferTrip={(candidate) => {
                                                        void handleTransferTrip(candidate);
                                                    }}
                                                    onDownloadTripJson={(candidate) => {
                                                        void handleDownloadTripJson(candidate);
                                                    }}
                                                    onSoftDeleteTrip={(candidate) => {
                                                        void handleSoftDeleteTrip(candidate);
                                                    }}
                                                    onHardDeleteTrip={(candidate) => {
                                                        void handleHardDeleteTrip(candidate);
                                                    }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {sortedVisibleTrips.length === 0 && !isLoading && (
                                    <TableRow>
                                        <TableCell className="whitespace-normal p-4" colSpan={tripsTableColumnCount}>
                                            {hasActiveTripFilters || searchValue.trim() ? (
                                                <AdminEmptyState
                                                    className="sticky start-0 max-w-[min(36rem,calc(100vw-5rem))]"
                                                    icon={<SuitcaseRolling />}
                                                    title="No trips match these filters"
                                                    description="Clear a filter or the search to see more trips."
                                                    action={hasActiveTripFilters ? (
                                                        <Button type="button" variant="outline" size="sm" onClick={resetTripFilters}>
                                                            <X size={14} />
                                                            Reset filters
                                                        </Button>
                                                    ) : undefined}
                                                />
                                            ) : (
                                                <AdminEmptyState
                                                    className="sticky start-0 max-w-[min(36rem,calc(100vw-5rem))]"
                                                    icon={<SuitcaseRolling />}
                                                    title="No trips in this date range"
                                                    description="Widen the date range to see trips updated earlier."
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {isLoading && pagedTrips.length === 0 && (
                                    <TableRow>
                                        <TableCell className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={tripsTableColumnCount}>
                                            <span role="status" className="inline-flex items-center gap-2 font-medium">
                                                <SpinnerGap size={16} className="animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
                                                Loading trips…
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <AdminPagination
                        page={page}
                        pageSize={TRIPS_PAGE_SIZE}
                        totalItems={sortedVisibleTrips.length}
                        onPageChange={setPage}
                        noun="trips"
                    />
                    {isSaving && (
                        <p className="text-xs text-muted-foreground" role="status">Saving changes…</p>
                    )}
                </AdminSurfaceCard>

                <AdminSelectionBar
                    count={selectedVisibleTrips.length}
                    noun="trip"
                    onClear={() => setSelectedTripIds(new Set())}
                >
                    {canSelectAllMatchingTrips && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={selectAllMatchingTrips}
                            {...getAnalyticsDebugAttributes('admin__trips_selection--select_all_matching')}
                        >
                            Select all {visibleTrips.length.toLocaleString()} matching
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleBulkSoftDeleteTrips()}
                        disabled={isSaving}
                        {...getAnalyticsDebugAttributes('admin__trips_bulk--archive')}
                    >
                        Archive
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleBulkHardDeleteTrips()}
                        disabled={isSaving}
                        {...getAnalyticsDebugAttributes('admin__trips_bulk--delete')}
                    >
                        <Trash />
                        Delete permanently
                    </Button>
                </AdminSelectionBar>
            </div>

            <AdminDetailSheet
                open={isTripDrawerOpen}
                onOpenChange={handleTripSheetOpenChange}
                title={selectedTrip ? (selectedTrip.title || 'Untitled trip') : 'Trip details'}
                subtitle={selectedTrip ? (
                    <CopyableUuid value={selectedTrip.trip_id} textClassName="max-w-[22rem] truncate text-sm" />
                ) : undefined}
                meta={selectedTrip ? (
                    <>
                        <AdminStatusBadge tone={getLifecycleTone(selectedTrip.status)}>
                            {getLifecycleLabel(selectedTrip.status)}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone={getGenerationTone(selectedTripGenerationState)}>
                            {`Generation ${getGenerationStateLabel(selectedTripGenerationState).toLowerCase()}`}
                        </AdminStatusBadge>
                    </>
                ) : undefined}
                headerActions={selectedTrip ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenTripPreview(selectedTrip)}>
                        Open trip
                        <ArrowSquareOut className="rtl:-scale-x-100" />
                    </Button>
                ) : undefined}
                footer={selectedTrip ? (
                    <>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleDuplicateTrip(selectedTrip)} disabled={isSaving}>
                            Duplicate…
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleTransferTrip(selectedTrip)} disabled={isSaving}>
                            Transfer owner…
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadTripJson(selectedTrip)} disabled={isSaving}>
                            Download JSON
                        </Button>
                        <div className="ms-auto flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => void handleSoftDeleteTrip(selectedTrip)} disabled={isSaving}>
                                {selectedTrip.status === 'archived' ? 'Restore trip' : 'Archive trip'}
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => void handleHardDeleteTrip(selectedTrip)} disabled={isSaving}>
                                <Trash />
                                Delete permanently
                            </Button>
                        </div>
                    </>
                ) : undefined}
            >
                {errorMessage && <AdminErrorAlert message={errorMessage} />}
                {!selectedTrip ? (
                    isLoading ? (
                        <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <SpinnerGap size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            Loading trip…
                        </p>
                    ) : (
                        <AdminEmptyState
                            icon={<SuitcaseRolling />}
                            title="Trip not found"
                            description="It may have been deleted, or the link points to another environment."
                        />
                    )
                ) : (
                    <>
                        <AdminSurfaceCard className="flex flex-col gap-4">
                            <AdminSectionHeader as="h3" title="Overview" />
                            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                <DetailField label="Owner" wide>
                                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="break-all">{selectedTrip.owner_email || 'No email on file'}</span>
                                        <Link
                                            to={buildAdminUserSheetPath(selectedTrip.owner_id)}
                                            onClick={() => trackEvent('admin__trips_sheet--open_owner')}
                                            {...getAnalyticsDebugAttributes('admin__trips_sheet--open_owner')}
                                            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-accent-200"
                                        >
                                            Open in Users
                                        </Link>
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                        <CopyableUuid value={selectedTrip.owner_id} textClassName="break-all text-xs" />
                                    </span>
                                </DetailField>
                                <DetailField label="Source">
                                    <span data-tooltip={(selectedTrip.source_kind || '').trim() || 'unknown'}>
                                        {formatSourceKindLabel(selectedTrip.source_kind)}
                                    </span>
                                </DetailField>
                                <DetailField label="Expires">
                                    <RelativeTime value={selectedTrip.trip_expires_at} fallback="Never" />
                                </DetailField>
                                <DetailField label="Created">
                                    <RelativeTime value={selectedTrip.created_at} fallback="n/a" />
                                </DetailField>
                                <DetailField label="Updated">
                                    <RelativeTime value={selectedTrip.updated_at} fallback="n/a" />
                                </DetailField>
                                {selectedTrip.archived_at && (
                                    <DetailField label="Archived">
                                        <RelativeTime value={selectedTrip.archived_at} fallback="n/a" />
                                    </DetailField>
                                )}
                            </dl>

                            {isLoadingFullTrip ? (
                                <p role="status" className="rounded-md bg-secondary px-3 py-4 text-center text-sm text-muted-foreground">
                                    Loading trip map and itinerary…
                                </p>
                            ) : selectedFullTrip && (previewCityStops.length > 0 || previewMapUrl) ? (
                                <div className="grid overflow-hidden rounded-md border border-border sm:grid-cols-2">
                                    <div className="h-48 overflow-y-auto border-b border-border p-3 sm:border-b-0 sm:border-e">
                                        {previewCityStops.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No city stops found.</p>
                                        ) : (
                                            <ol aria-label="Itinerary">
                                                {previewCityStops.map((stop, idx) => {
                                                    const isStart = idx === 0;
                                                    const isEnd = idx === previewCityStops.length - 1;
                                                    const pinClass = isStart && !isEnd ? 'text-indigo-500 dark:text-indigo-300' : isEnd && !isStart ? 'text-indigo-300 dark:text-indigo-400' : 'text-indigo-500 dark:text-indigo-300';
                                                    return (
                                                        <li key={stop.id} className="flex min-h-[31px] items-center gap-2.5 px-1">
                                                            <div className="relative flex w-4 shrink-0 items-center justify-center self-stretch" aria-hidden="true">
                                                                {previewCityStops.length > 1 && (
                                                                    <span
                                                                        className={`absolute start-1/2 w-0.5 -translate-x-1/2 bg-indigo-200 rtl:translate-x-1/2 dark:bg-indigo-400/40 ${
                                                                            isStart ? 'top-1/2 -bottom-px' : isEnd ? '-top-px bottom-1/2' : '-top-px -bottom-px'
                                                                        }`}
                                                                    />
                                                                )}
                                                                {isStart || isEnd ? (
                                                                    <MapPin weight="fill" size={13} className={`relative z-10 ${pinClass}`} />
                                                                ) : (
                                                                    <span className="relative z-10 size-1.5 rounded-full bg-indigo-400 dark:bg-indigo-300" />
                                                                )}
                                                            </div>
                                                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                                                <span className="break-words text-sm font-medium leading-5 text-foreground">{stop.title}</span>
                                                                <span className="text-xs leading-5 tabular-nums text-muted-foreground">
                                                                    {Math.max(1, Math.ceil(stop.duration))} nights
                                                                </span>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ol>
                                        )}
                                    </div>
                                    <div className="relative h-48 bg-secondary">
                                        {previewMapUrl ? (
                                            <img
                                                src={previewMapUrl}
                                                alt={`Map preview for ${selectedFullTrip.title}`}
                                                className="size-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                                                Map preview unavailable
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="rounded-md bg-secondary px-3 py-4 text-center text-sm text-muted-foreground">
                                    No itinerary preview for this trip.
                                </p>
                            )}
                        </AdminSurfaceCard>

                        <AdminSurfaceCard className="flex flex-col gap-4">
                            <AdminSectionHeader
                                as="h3"
                                title="Generation"
                                description="The latest AI attempt, and a retry when it failed."
                                actions={(
                                    <AdminStatusBadge tone={getGenerationTone(selectedTripGenerationState)}>
                                        {getGenerationStateLabel(selectedTripGenerationState)}
                                    </AdminStatusBadge>
                                )}
                            />
                            {isLoadingTripAttemptLogRows && (
                                <p role="status" className="text-sm text-muted-foreground">Loading attempt history…</p>
                            )}
                            {selectedTripLatestAttempt ? (
                                <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                    <DetailField label="Model">
                                        <span className="break-all">
                                            {[selectedTripLatestAttempt.provider, selectedTripLatestAttempt.model].filter(Boolean).join(' · ') || 'n/a'}
                                        </span>
                                    </DetailField>
                                    <DetailField label="Started">
                                        <RelativeTime value={selectedTripLatestAttempt.startedAt} fallback="n/a" />
                                    </DetailField>
                                    <DetailField label="Duration">
                                        <span className="tabular-nums">{formatDurationMs(selectedTripLatestAttempt.durationMs)}</span>
                                    </DetailField>
                                    <DetailField label="Retries">
                                        <span className="tabular-nums">
                                            {selectedTripRetryCount}
                                            {selectedTripDeadLetterJobCount > 0 && ` · ${selectedTripDeadLetterJobCount} dead-letter`}
                                        </span>
                                    </DetailField>
                                    <DetailField label="Failure kind">{selectedTripLatestAttempt.failureKind || 'n/a'}</DetailField>
                                    <DetailField label="Error code">{selectedTripLatestAttempt.errorCode || 'n/a'}</DetailField>
                                    <DetailField label="Error message" wide>{selectedTripLatestAttempt.errorMessage || 'n/a'}</DetailField>
                                </dl>
                            ) : !isLoadingTripAttemptLogRows && (
                                <p className="text-sm text-muted-foreground">No generation attempts captured yet.</p>
                            )}

                            <div className="flex flex-col gap-2 rounded-md bg-secondary p-3">
                                {ACTIVE_RETRY_MODEL_OPTIONS.length > 0 && (
                                    <div className="flex max-w-sm flex-col gap-1">
                                        <span id="trip-retry-model-label" className="text-xs font-medium text-muted-foreground">Retry with model</span>
                                        <Select value={drawerRetryModelId} onValueChange={setDrawerRetryModelId}>
                                            <SelectTrigger className="h-8 bg-card text-sm" aria-labelledby="trip-retry-model-label">
                                                {selectedDrawerRetryModelOption ? (
                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                        <AiProviderLogo provider={selectedDrawerRetryModelOption.provider} model={selectedDrawerRetryModelOption.model} size={14} />
                                                        <span className="truncate">{selectedDrawerRetryModelOption.providerLabel} · {selectedDrawerRetryModelOption.label}</span>
                                                    </span>
                                                ) : (
                                                    <SelectValue />
                                                )}
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groupedRetryModelOptions.map((group) => (
                                                    <SelectGroup key={`drawer-model-group-${group.providerLabel}`}>
                                                        <SelectLabel>{group.providerLabel}</SelectLabel>
                                                        {group.options.map((option) => (
                                                            <SelectItem key={option.id} value={option.id}>
                                                                <span className="inline-flex items-center gap-2">
                                                                    <AiProviderLogo provider={option.provider} model={option.model} size={14} />
                                                                    <span className="font-medium text-foreground">{option.label}</span>
                                                                </span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={selectedTripGenerationState === 'failed' ? 'default' : 'outline'}
                                        onClick={() => {
                                            void handleRetryTripGeneration();
                                        }}
                                        disabled={!canRetryGenerationInDrawer}
                                        aria-busy={isRetryingGeneration || undefined}
                                        aria-describedby={drawerRetryDisabledReason && !isRetryingGeneration ? 'trip-retry-disabled-reason' : undefined}
                                    >
                                        {isRetryingGeneration && <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />}
                                        {isRetryingGeneration ? 'Retrying generation…' : 'Retry generation'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleOpenBenchmarkFromDrawer}
                                        disabled={!selectedTripGenerationMeta?.inputSnapshot}
                                    >
                                        Open in AI benchmark
                                        <ArrowSquareOut className="rtl:-scale-x-100" />
                                    </Button>
                                </div>
                                {drawerRetryDisabledReason && !isRetryingGeneration && (
                                    <p id="trip-retry-disabled-reason" className="text-xs text-muted-foreground">{drawerRetryDisabledReason}</p>
                                )}
                            </div>

                            {selectedTripGenerationAttempts.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">Recent attempts</p>
                                    <ul className="divide-y divide-border rounded-md border border-border">
                                        {selectedTripGenerationAttempts.map((attempt) => (
                                            <li key={attempt.id} className="grid grid-cols-[5rem_1fr_auto_auto] items-center gap-2 px-2.5 py-1.5 text-xs">
                                                <span className="font-medium capitalize text-foreground">{attempt.state}</span>
                                                <span className="truncate text-muted-foreground">{attempt.model || attempt.providerModel || 'n/a'}</span>
                                                <RelativeTime value={attempt.startedAt} fallback="n/a" className="tabular-nums text-muted-foreground" />
                                                <span className="tabular-nums text-muted-foreground">{formatDurationMs(attempt.durationMs)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {isLoadingTripGenerationJobRows && (
                                <p role="status" className="text-sm text-muted-foreground">Loading queue jobs…</p>
                            )}
                            {selectedTripGenerationJobRows.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <p className="text-xs font-medium text-muted-foreground">Queue jobs</p>
                                    <ul className="divide-y divide-border rounded-md border border-border">
                                        {selectedTripGenerationJobRows.map((job) => (
                                            <li key={job.id} className="grid gap-1 px-2.5 py-1.5 text-xs sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center sm:gap-2">
                                                <AdminStatusBadge tone={getGenerationJobTone(job.state)} className="capitalize">
                                                    {job.state}
                                                </AdminStatusBadge>
                                                <span className="truncate text-muted-foreground">
                                                    {job.lastErrorCode || job.lastErrorMessage || job.attemptId}
                                                </span>
                                                <span className="shrink-0 tabular-nums text-muted-foreground" data-tooltip="Retries used / allowed">
                                                    {job.retryCount}/{job.maxRetries}
                                                </span>
                                                <RelativeTime value={job.createdAt} fallback="n/a" className="shrink-0 tabular-nums text-muted-foreground" />
                                                {(job.state === 'dead' || job.state === 'failed') ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            void handleRequeueGenerationJob(job);
                                                        }}
                                                        disabled={requeueingGenerationJobId === job.id}
                                                        aria-busy={requeueingGenerationJobId === job.id || undefined}
                                                    >
                                                        {requeueingGenerationJobId === job.id ? (
                                                            <>
                                                                <SpinnerGap size={12} className="animate-spin motion-reduce:animate-none" />
                                                                Requeueing…
                                                            </>
                                                        ) : (
                                                            'Requeue'
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <span className="hidden sm:block" aria-hidden="true" />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <details className="group rounded-md border border-border">
                                <summary className="cursor-pointer select-none rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                                    Technical details
                                </summary>
                                <div className="flex flex-col gap-4 border-t border-border p-3">
                                    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                        <DetailField label="Flow">{selectedTripLatestAttempt?.flow || 'n/a'}</DetailField>
                                        <DetailField label="Attempt source">{selectedTripLatestAttempt?.source || 'n/a'}</DetailField>
                                        <DetailField label="Provider model">
                                            <span className="break-all">{selectedTripLatestAttempt?.providerModel || 'n/a'}</span>
                                        </DetailField>
                                        <DetailField label="HTTP status">
                                            {typeof selectedTripLatestAttempt?.statusCode === 'number' ? selectedTripLatestAttempt.statusCode : 'n/a'}
                                        </DetailField>
                                        <DetailField label="Request ID" mono>{selectedTripLatestAttempt?.requestId || 'n/a'}</DetailField>
                                        <DetailField label="Execution mode">{selectedTripOrchestrationMode || 'n/a'}</DetailField>
                                        <DetailField label="Finished at">{formatRelativeWithAbsolute(selectedTripLatestAttempt?.finishedAt)}</DetailField>
                                        <DetailField label="Latest state transition">
                                            {formatRelativeWithAbsolute(selectedTripGenerationMeta?.lastFailedAt || selectedTripGenerationMeta?.lastSucceededAt)}
                                        </DetailField>
                                        <DetailField label="Retry requested at">{formatRelativeWithAbsolute(selectedTripGenerationMeta?.retryRequestedAt)}</DetailField>
                                        <DetailField label="Input snapshot">
                                            {selectedTripGenerationMeta?.inputSnapshot
                                                ? `${selectedTripGenerationMeta.inputSnapshot.flow} (${formatTimestamp(selectedTripGenerationMeta.inputSnapshot.createdAt, 'n/a')})`
                                                : 'Unavailable'}
                                        </DetailField>
                                        <DetailField label="Latest queue job">
                                            {selectedTripLatestGenerationJob
                                                ? `${selectedTripLatestGenerationJob.state} (${formatRelativeTimestamp(selectedTripLatestGenerationJob.createdAt, 'n/a')})`
                                                : 'n/a'}
                                        </DetailField>
                                        <DetailField label="Dead-letter jobs">{selectedTripDeadLetterJobCount}</DetailField>
                                        <DetailField label="Attempt metadata details" wide>{selectedTripLatestAttemptDetails || 'n/a'}</DetailField>
                                        {selectedTripLatestGenerationJob && (
                                            <>
                                                <DetailField label="Job started at">{formatRelativeWithAbsolute(selectedTripLatestGenerationJob.startedAt)}</DetailField>
                                                <DetailField label="Job finished at">{formatRelativeWithAbsolute(selectedTripLatestGenerationJob.finishedAt)}</DetailField>
                                                <DetailField label="Job last error code">{selectedTripLatestGenerationJob.lastErrorCode || 'n/a'}</DetailField>
                                                <DetailField label="Job last error message" wide>{selectedTripLatestGenerationJob.lastErrorMessage || 'n/a'}</DetailField>
                                            </>
                                        )}
                                    </dl>
                                    {selectedTripLatestAttemptMetadata && (
                                        <JsonBlock label="Attempt metadata JSON" value={selectedTripLatestAttemptMetadata} />
                                    )}
                                    {selectedTripLatestGenerationJobPayload && (
                                        <JsonBlock label="Latest queue job payload JSON" value={selectedTripLatestGenerationJobPayload} />
                                    )}
                                    {selectedTripRequestPayload && (
                                        <JsonBlock label="Request payload JSON" value={selectedTripRequestPayload} />
                                    )}
                                    {selectedTripInputSnapshot && (
                                        <JsonBlock label="Input snapshot JSON" value={selectedTripInputSnapshot} />
                                    )}
                                </div>
                            </details>
                        </AdminSurfaceCard>

                        <AdminSurfaceCard className="flex flex-col gap-4">
                            <AdminSectionHeader
                                as="h3"
                                title="Status and expiry"
                                description="Changes apply when you save."
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <span id="trip-lifecycle-status-label" className="text-xs font-medium text-muted-foreground">Status</span>
                                    <Select
                                        value={drawerLifecycleDraft}
                                        onValueChange={(value) => {
                                            setDrawerLifecycleDraft(value as TripStatus);
                                        }}
                                    >
                                        <SelectTrigger className="h-9 text-sm" aria-labelledby="trip-lifecycle-status-label">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="expired">Expired</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <label htmlFor="trip-lifecycle-expiration" className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">Expires at</span>
                                    <Input
                                        id="trip-lifecycle-expiration"
                                        type="datetime-local"
                                        value={drawerExpirationDraft}
                                        onChange={(event) => {
                                            setDrawerExpirationDraft(event.target.value);
                                        }}
                                        className="h-9 tabular-nums"
                                    />
                                </label>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {hasDrawerLifecycleChanges && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setDrawerLifecycleDraft(selectedTrip.status);
                                            setDrawerExpirationDraft(toDateTimeInputValue(selectedTrip.trip_expires_at));
                                        }}
                                        disabled={isSaving}
                                    >
                                        Discard
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        void handleSaveDrawerLifecycle();
                                    }}
                                    disabled={isSaving || !hasDrawerLifecycleChanges}
                                >
                                    Save changes
                                </Button>
                            </div>
                        </AdminSurfaceCard>

                        <TripOgPreviewPanel key={selectedTrip.trip_id} tripId={selectedTrip.trip_id} />
                    </>
                )}
            </AdminDetailSheet>
        </AdminShell>
    );
};
