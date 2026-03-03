import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowSquareOut, DotsThreeVertical, MapPin, SpinnerGap, Trash, X } from '@phosphor-icons/react';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
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
import { getTripCityStops, buildMiniMapUrl } from '../components/TripManager';
import type { ITrip, TripGenerationAttemptSummary, TripGenerationState } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { Drawer, DrawerContent } from '../components/ui/drawer';
import { Checkbox } from '../components/ui/checkbox';
import { useAppDialog } from '../components/AppDialogProvider';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { generateTripId } from '../utils';
import { getTripGenerationState, getLatestTripGenerationAttempt } from '../services/tripGenerationDiagnosticsService';
import { retryTripGenerationWithDefaultModel } from '../services/tripGenerationRetryService';

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

const TRIPS_CACHE_KEY = 'admin.trips.cache.v1';
const TRIP_STATUS_VALUES: readonly TripStatus[] = ['active', 'archived', 'expired'];
const TRIP_GENERATION_STATE_VALUES: readonly TripGenerationState[] = ['failed', 'running', 'queued', 'succeeded'];
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const parseQueryMultiValue = <T extends string>(
    value: string | null,
    allowedValues: readonly T[]
): T[] => {
    if (!value) return [];
    const allowSet = new Set<string>(allowedValues);
    const unique = new Set<string>();
    value
        .split(',')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .forEach((chunk) => {
            if (allowSet.has(chunk)) unique.add(chunk);
        });
    return allowedValues.filter((candidate) => unique.has(candidate));
};

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

const formatAccountStatusLabel = (status: string | null | undefined): string => {
    const normalized = (status || 'active').toLowerCase();
    if (normalized === 'disabled') return 'Suspended';
    if (normalized === 'deleted') return 'Deleted';
    return 'Active';
};

const getLifecyclePillClassName = (status: TripStatus): string => {
    if (status === 'archived') return 'border-slate-300 bg-slate-100 text-slate-700';
    if (status === 'expired') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const getGenerationPillClassName = (state: TripGenerationState): string => {
    if (state === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (state === 'running' || state === 'queued') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const getGenerationStateLabel = (state: TripGenerationState): string => {
    if (state === 'failed') return 'Failed';
    if (state === 'running') return 'Running';
    if (state === 'queued') return 'Queued';
    return 'Succeeded';
};

const resolveTripGenerationState = (trip: AdminTripRecord): TripGenerationState => {
    const state = trip.generation_state;
    if (state === 'failed' || state === 'running' || state === 'queued' || state === 'succeeded') return state;
    return 'succeeded';
};

const formatExpirationMeta = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Not set';
    const parsed = Date.parse(expiresAt);
    if (!Number.isFinite(parsed)) return 'Invalid timestamp';
    return new Date(parsed).toLocaleString();
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
    onPreviewTrip: (trip: AdminTripRecord) => void;
    onDuplicateTrip: (trip: AdminTripRecord) => void;
    onTransferTrip: (trip: AdminTripRecord) => void;
    onDownloadTripJson: (trip: AdminTripRecord) => void;
    onSoftDeleteTrip: (trip: AdminTripRecord) => void;
    onHardDeleteTrip: (trip: AdminTripRecord) => void;
}> = ({
    trip,
    disabled,
    onPreviewTrip,
    onDuplicateTrip,
    onTransferTrip,
    onDownloadTripJson,
    onSoftDeleteTrip,
    onHardDeleteTrip,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isArchived = trip.status === 'archived';

    useEffect(() => {
        if (!isOpen) return;
        const onPointer = (event: PointerEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
        };
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onEscape);
        };
    }, [isOpen]);

    const runAction = (callback: (trip: AdminTripRecord) => void) => {
        setIsOpen(false);
        callback(trip);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                disabled={disabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Open trip actions"
            >
                <DotsThreeVertical size={16} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[180px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                    <button
                        type="button"
                        onClick={() => runAction(onPreviewTrip)}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Preview trip
                    </button>
                    <button
                        type="button"
                        onClick={() => runAction(onDuplicateTrip)}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Duplicate trip
                    </button>
                    <button
                        type="button"
                        onClick={() => runAction(onTransferTrip)}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Transfer owner
                    </button>
                    <button
                        type="button"
                        onClick={() => runAction(onDownloadTripJson)}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Download JSON
                    </button>
                    <div className="my-1 h-px bg-slate-100" />
                    <button
                        type="button"
                        onClick={() => runAction(onSoftDeleteTrip)}
                        className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                            isArchived ? 'text-emerald-800 hover:bg-emerald-50' : 'text-amber-800 hover:bg-amber-50'
                        }`}
                    >
                        {isArchived ? 'Restore trip' : 'Soft-delete trip'}
                    </button>
                    <button
                        type="button"
                        onClick={() => runAction(onHardDeleteTrip)}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-rose-800 hover:bg-rose-50"
                    >
                        Hard delete trip
                    </button>
                </div>
            )}
        </div>
    );
};

export const AdminTripsPage: React.FC = () => {
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
    const navigate = useNavigate();
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
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
    const [selectedOwnerProfile, setSelectedOwnerProfile] = useState<AdminUserRecord | null>(null);
    const [isOwnerDrawerOpen, setIsOwnerDrawerOpen] = useState(false);
    const [selectedTripDrawerId, setSelectedTripDrawerId] = useState<string | null>(null);
    const [isTripDrawerOpen, setIsTripDrawerOpen] = useState(false);
    const [selectedFullTrip, setSelectedFullTrip] = useState<ITrip | null>(null);
    const [isRetryingGeneration, setIsRetryingGeneration] = useState(false);
    const [isLoadingFullTrip, setIsLoadingFullTrip] = useState(false);
    const [isLoadingOwnerProfile, setIsLoadingOwnerProfile] = useState(false);
    const handledDeepLinkedOwnerIdRef = useRef<string | null>(null);
    const handledDeepLinkedTripIdRef = useRef<string | null>(null);
    const deepLinkedOwnerId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const userId = searchParams.get('user');
        if (drawer !== 'user' || !userId) return null;
        return userId;
    }, [searchParams]);
    const deepLinkedTripId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const tripId = searchParams.get('trip');
        if (drawer !== 'trip' || !tripId) return null;
        return tripId;
    }, [searchParams]);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (statusFilters.length > 0 && statusFilters.length < TRIP_STATUS_VALUES.length) {
            next.set('status', statusFilters.join(','));
        }
        if (generationStateFilters.length > 0 && generationStateFilters.length < TRIP_GENERATION_STATE_VALUES.length) {
            next.set('generation', generationStateFilters.join(','));
        }
        if (dateRange !== '30d') next.set('range', dateRange);
        const drawerTripId = selectedTripDrawerId || deepLinkedTripId;
        const drawerOwnerId = selectedOwnerId || deepLinkedOwnerId;
        if ((isTripDrawerOpen || deepLinkedTripId) && drawerTripId) {
            next.set('trip', drawerTripId);
            next.set('drawer', 'trip');
        } else if ((isOwnerDrawerOpen || deepLinkedOwnerId) && drawerOwnerId) {
            next.set('user', drawerOwnerId);
            next.set('drawer', 'user');
        }
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        dateRange,
        deepLinkedOwnerId,
        deepLinkedTripId,
        generationStateFilters,
        isOwnerDrawerOpen,
        isTripDrawerOpen,
        searchParams,
        searchValue,
        selectedOwnerId,
        selectedTripDrawerId,
        setSearchParams,
        statusFilters,
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
            const reason = error instanceof Error ? error.message : 'Could not load trips.';
            setErrorMessage(reason);
            const cachedRows = readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setTrips(cachedRows);
                setDataSourceNotice(`Live admin trips failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser. Reason: ${reason}`);
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


    const previewCityStops = useMemo(() => {
        if (!selectedFullTrip) return [];
        return getTripCityStops(selectedFullTrip);
    }, [selectedFullTrip]);

    const previewMapUrl = useMemo(() => {
        if (!selectedFullTrip) return null;
        return buildMiniMapUrl(selectedFullTrip, 'en');
    }, [selectedFullTrip]);

    const selectedTripGenerationState = useMemo<TripGenerationState>(() => {
        if (selectedFullTrip) {
            return getTripGenerationState(selectedFullTrip);
        }
        if (selectedTripForDrawer) {
            return resolveTripGenerationState(selectedTripForDrawer);
        }
        return 'succeeded';
    }, [selectedFullTrip, selectedTripForDrawer]);

    const selectedTripGenerationAttempts = useMemo<TripGenerationAttemptSummary[]>(() => {
        if (!selectedFullTrip?.aiMeta?.generation?.attempts || !Array.isArray(selectedFullTrip.aiMeta.generation.attempts)) {
            return [];
        }
        return [...selectedFullTrip.aiMeta.generation.attempts]
            .filter((entry): entry is TripGenerationAttemptSummary => Boolean(entry))
            .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
            .slice(0, 8);
    }, [selectedFullTrip]);

    const selectedTripLatestAttempt = useMemo<TripGenerationAttemptSummary | null>(() => {
        if (selectedFullTrip) {
            return getLatestTripGenerationAttempt(selectedFullTrip);
        }
        return null;
    }, [selectedFullTrip]);

    const canRetryGenerationInDrawer = Boolean(
        selectedTripForDrawer
        && selectedFullTrip
        && selectedFullTrip.aiMeta?.generation?.inputSnapshot
        && selectedTripGenerationState !== 'running'
        && selectedTripGenerationState !== 'queued'
        && !isRetryingGeneration
    );


    const visibleTrips = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return trips.filter((trip) => {
            if (!isIsoDateInRange(trip.updated_at || trip.created_at, dateRange)) return false;
            if (statusFilters.length > 0 && !statusFilters.includes(trip.status)) return false;
            if (generationStateFilters.length > 0 && !generationStateFilters.includes(resolveTripGenerationState(trip))) return false;
            if (!token) return true;
            return (
                (trip.title || '').toLowerCase().includes(token)
                || trip.trip_id.toLowerCase().includes(token)
                || (trip.owner_email || '').toLowerCase().includes(token)
                || trip.owner_id.toLowerCase().includes(token)
            );
        });
    }, [dateRange, generationStateFilters, searchValue, statusFilters, trips]);

    const tripsInDateRange = useMemo(
        () => trips.filter((trip) => isIsoDateInRange(trip.updated_at || trip.created_at, dateRange)),
        [dateRange, trips]
    );

    const summary = useMemo(() => ({
        total: visibleTrips.length,
        active: visibleTrips.filter((trip) => trip.status === 'active').length,
        expired: visibleTrips.filter((trip) => trip.status === 'expired').length,
        archived: visibleTrips.filter((trip) => trip.status === 'archived').length,
        failedGeneration: visibleTrips.filter((trip) => resolveTripGenerationState(trip) === 'failed').length,
    }), [visibleTrips]);
    const selectedVisibleTrips = useMemo(
        () => visibleTrips.filter((trip) => selectedTripIds.has(trip.trip_id)),
        [selectedTripIds, visibleTrips]
    );
    const areAllVisibleTripsSelected = visibleTrips.length > 0 && visibleTrips.every((trip) => selectedTripIds.has(trip.trip_id));
    const isVisibleTripSelectionPartial = selectedVisibleTrips.length > 0 && !areAllVisibleTripsSelected;

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

    const updateTripStatus = async (
        trip: AdminTripRecord,
        patch: {
            status?: 'active' | 'archived' | 'expired';
            tripExpiresAt?: string | null;
        }
    ) => {
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, patch);
            setMessage('Trip updated.');
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not update trip.');
        } finally {
            setIsSaving(false);
        }
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
        setMessage(null);

        try {
            const result = await retryTripGenerationWithDefaultModel(selectedFullTrip, {
                source: 'admin_trip_drawer',
                contextSource: 'admin_trip_drawer',
                onTripUpdate: async (nextTrip) => {
                    setSelectedFullTrip(nextTrip);
                    const committed = await dbAdminOverrideTripCommit(nextTrip, nextTrip.defaultView ?? undefined, 'Data: Admin retried generation');
                    if (!committed) {
                        throw new Error('Could not persist retried trip via admin override.');
                    }
                },
            });

            if (result.state === 'succeeded') {
                setMessage('Trip generation retry completed.');
            } else {
                setMessage('Trip generation retry failed. Diagnostics have been updated.');
            }
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not retry generation.');
        } finally {
            setIsRetryingGeneration(false);
            setIsSaving(false);
        }
    };

    const resolveTransferTargetUser = async (rawInput: string): Promise<AdminUserRecord> => {
        const normalizedInput = rawInput.trim();
        if (!normalizedInput) {
            throw new Error('Enter a target user email or UUID.');
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
                throw new Error('Multiple users found for that email. Enter a UUID instead.');
            }
            if (exactMatches.length === 1) {
                return exactMatches[0];
            }
        }

        const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
        const idMatches = rows.filter((candidate) => candidate.user_id.toLowerCase() === normalizedLower);
        if (idMatches.length > 1) {
            throw new Error('Multiple users matched that UUID. Enter a more specific value.');
        }
        if (idMatches.length === 1) {
            return idMatches[0];
        }

        throw new Error('Target user not found. Enter an existing user email or UUID.');
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
        setMessage(null);
        try {
            const targetUser = await resolveTransferTargetUser(transferTargetInput);
            if (targetUser.user_id === trip.owner_id) {
                throw new Error('Target owner is already the current owner.');
            }
            const targetStatus = (targetUser.account_status || 'active').toLowerCase();
            if (targetStatus !== 'active') {
                throw new Error('Target user must be an active account.');
            }

            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Confirm transfer',
                message: `Transfer this trip to ${getUserReferenceText(targetUser)}?`,
                confirmLabel: 'Transfer',
            }));
            if (!confirmed) return;

            await adminUpdateTrip(trip.trip_id, { ownerId: targetUser.user_id });
            setMessage(`Trip owner transferred to ${getUserReferenceText(targetUser)}.`);
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not transfer trip owner.');
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
        setMessage(null);
        try {
            const targetInput = transferTargetInput.trim();
            const targetUser = targetInput ? await resolveTransferTargetUser(targetInput) : null;
            if (targetUser) {
                const targetStatus = (targetUser.account_status || 'active').toLowerCase();
                if (targetStatus !== 'active') {
                    throw new Error('Target user must be an active account.');
                }
            }

            const result = await dbGetTrip(trip.trip_id);
            if (!result?.trip) {
                throw new Error('Could not load source trip data for duplication.');
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
                throw new Error('Could not save duplicated trip.');
            }

            if (targetUser && targetUser.user_id !== trip.owner_id) {
                await adminUpdateTrip(upsertedTripId, { ownerId: targetUser.user_id });
                setMessage(`Trip duplicated and transferred to ${getUserReferenceText(targetUser)}.`);
            } else {
                setMessage('Trip duplicated.');
            }

            await loadTrips();
            openTripDrawer(upsertedTripId);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not duplicate trip.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadTripJson = async (trip: AdminTripRecord) => {
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const result = await dbGetTrip(trip.trip_id);
            if (!result?.trip) {
                throw new Error('Could not load trip JSON.');
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
            setMessage('Trip JSON downloaded.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not download trip JSON.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSoftDeleteTrip = async (trip: AdminTripRecord) => {
        const nextStatus: TripStatus = trip.status === 'archived' ? 'active' : 'archived';
        if (nextStatus === 'archived') {
            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Soft delete trip',
                message: `Archive ${trip.title || trip.trip_id}?`,
                confirmLabel: 'Archive',
            }));
            if (!confirmed) return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, { status: nextStatus });
            setMessage(nextStatus === 'archived' ? 'Trip archived.' : 'Trip restored.');
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not update trip status.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleHardDeleteTrip = async (trip: AdminTripRecord) => {
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete trip',
            message: `Hard-delete ${trip.title || trip.trip_id}? This cannot be undone.`,
            confirmLabel: 'Hard delete',
        }));
        if (!confirmed) return;

        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminHardDeleteTrip(trip.trip_id);
            setMessage('Trip permanently deleted.');
            if (selectedTripDrawerId === trip.trip_id) {
                setIsTripDrawerOpen(false);
                setSelectedTripDrawerId(null);
            }
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not hard-delete trip.');
        } finally {
            setIsSaving(false);
        }
    };

    const resetTripFilters = () => {
        setStatusFilters([]);
        setGenerationStateFilters([]);
    };

    const openOwnerDrawer = (ownerId: string) => {
        setSelectedTripDrawerId(null);
        setIsTripDrawerOpen(false);
        setSelectedOwnerId(ownerId);
        setIsOwnerDrawerOpen(true);
    };

    const openTripDrawer = (tripId: string) => {
        setSelectedOwnerId(null);
        setSelectedOwnerProfile(null);
        setIsOwnerDrawerOpen(false);
        setSelectedTripDrawerId(tripId);
        setIsTripDrawerOpen(true);
    };

    const toggleTripSelection = (tripId: string, checked: boolean) => {
        setSelectedTripIds((current) => {
            const next = new Set(current);
            if (checked) next.add(tripId);
            else next.delete(tripId);
            return next;
        });
    };

    const toggleSelectAllVisibleTrips = (checked: boolean) => {
        setSelectedTripIds((current) => {
            const next = new Set(current);
            if (!checked) {
                visibleTrips.forEach((trip) => next.delete(trip.trip_id));
                return next;
            }
            visibleTrips.forEach((trip) => next.add(trip.trip_id));
            return next;
        });
    };

    const handleBulkSoftDeleteTrips = async () => {
        if (selectedVisibleTrips.length === 0) return;
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Soft delete selected trips',
            message: `Archive ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? '' : 's'}?`,
            confirmLabel: 'Archive',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await Promise.all(selectedVisibleTrips.map((trip) => adminUpdateTrip(trip.trip_id, { status: 'archived' })));
            setMessage(`${selectedVisibleTrips.length} trip${selectedVisibleTrips.length === 1 ? '' : 's'} archived.`);
            setSelectedTripIds(new Set());
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not archive selected trips.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkHardDeleteTrips = async () => {
        if (selectedVisibleTrips.length === 0) return;
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete selected trips',
            message: `Hard-delete ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? '' : 's'}? This cannot be undone.`,
            confirmLabel: 'Hard delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const results = await Promise.allSettled(selectedVisibleTrips.map((trip) => adminHardDeleteTrip(trip.trip_id)));
            const failed = results.filter((result) => result.status === 'rejected').length;
            const deleted = results.length - failed;
            if (deleted > 0) {
                setMessage(
                    failed > 0
                        ? `${deleted} trip${deleted === 1 ? '' : 's'} permanently deleted. ${failed} failed.`
                        : `${deleted} trip${deleted === 1 ? '' : 's'} permanently deleted.`
                );
            }
            if (failed > 0 && deleted === 0) {
                throw new Error('Could not hard-delete selected trips.');
            }
            setSelectedTripIds(new Set());
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not hard-delete selected trips.');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!deepLinkedOwnerId) {
            handledDeepLinkedOwnerIdRef.current = null;
            return;
        }
        if (handledDeepLinkedOwnerIdRef.current !== deepLinkedOwnerId) {
            setSelectedTripDrawerId(null);
            setIsTripDrawerOpen(false);
            setSelectedOwnerId(deepLinkedOwnerId);
            setIsOwnerDrawerOpen(true);
            handledDeepLinkedOwnerIdRef.current = deepLinkedOwnerId;
        }
    }, [deepLinkedOwnerId]);

    useEffect(() => {
        if (!deepLinkedTripId) {
            handledDeepLinkedTripIdRef.current = null;
            return;
        }
        if (handledDeepLinkedTripIdRef.current !== deepLinkedTripId) {
            setSelectedOwnerId(null);
            setSelectedOwnerProfile(null);
            setIsOwnerDrawerOpen(false);
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
                setErrorMessage(error instanceof Error ? error.message : 'Could not load linked trip.');
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
        if (!isOwnerDrawerOpen || !selectedOwnerId) return;
        let active = true;
        setIsLoadingOwnerProfile(true);
        void adminGetUserProfile(selectedOwnerId)
            .then((profile) => {
                if (!active) return;
                setSelectedOwnerProfile(profile);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : 'Could not load owner profile.');
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingOwnerProfile(false);
            });
        return () => {
            active = false;
        };
    }, [isOwnerDrawerOpen, selectedOwnerId]);

    return (
        <AdminShell
            title="Trip Lifecycle Controls"
            description="Inspect lifecycle, generation diagnostics, ownership, and expiration metadata."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadTrips()}
                    isLoading={isLoading}
                    label="Reload"
                />
            )}
        >
            {errorMessage && (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {errorMessage}
                </section>
            )}
            {dataSourceNotice && (
                <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {dataSourceNotice}
                </section>
            )}
            {message && (
                <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {message}
                </section>
            )}

            <section className="grid gap-3 md:grid-cols-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                    <p className="mt-2 text-2xl font-black text-slate-900"><AdminCountUpNumber value={summary.total} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700"><AdminCountUpNumber value={summary.active} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expired</p>
                    <p className="mt-2 text-2xl font-black text-amber-700"><AdminCountUpNumber value={summary.expired} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Archived</p>
                    <p className="mt-2 text-2xl font-black text-slate-700"><AdminCountUpNumber value={summary.archived} /></p>
                </article>
                <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Failed generation</p>
                    <p className="mt-2 text-2xl font-black text-rose-700"><AdminCountUpNumber value={summary.failedGeneration} /></p>
                </article>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Trips</h2>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <AdminFilterMenu
                            label="Status"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={(next) => setStatusFilters(next as TripStatus[])}
                        />
                        <AdminFilterMenu
                            label="Generation"
                            options={generationFilterOptions}
                            selectedValues={generationStateFilters}
                            onSelectedValuesChange={(next) => setGenerationStateFilters(next as TripGenerationState[])}
                        />
                        <button
                            type="button"
                            onClick={resetTripFilters}
                            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            <X size={14} />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">{selectedVisibleTrips.length} selected</span>
                    <button
                        type="button"
                        onClick={() => void handleBulkSoftDeleteTrips()}
                        disabled={isSaving || selectedVisibleTrips.length === 0}
                        className="inline-flex h-8 items-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Soft-delete selected
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleBulkHardDeleteTrips()}
                        disabled={isSaving || selectedVisibleTrips.length === 0}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash size={12} />
                        Hard delete selected
                    </button>
                    {selectedVisibleTrips.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedTripIds(new Set())}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-12 px-4 py-3">
                                    <Checkbox
                                        checked={areAllVisibleTripsSelected ? true : (isVisibleTripSelectionPartial ? 'indeterminate' : false)}
                                        onCheckedChange={(checked) => toggleSelectAllVisibleTrips(Boolean(checked))}
                                        aria-label="Select all visible trips"
                                    />
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Trip</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Owner</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Lifecycle</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Generation</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Expires</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Last update</TableHead>
                                <TableHead className="px-4 py-3 text-right font-semibold text-slate-700">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleTrips.map((trip) => (
                                <TableRow
                                    key={trip.trip_id}
                                    data-state={selectedTripIds.has(trip.trip_id) ? "selected" : undefined}
                                >
                                    <TableCell className="px-4 py-3">
                                        <Checkbox
                                            checked={selectedTripIds.has(trip.trip_id)}
                                            onCheckedChange={(checked) => toggleTripSelection(trip.trip_id, Boolean(checked))}
                                            aria-label={`Select trip ${trip.title || trip.trip_id}`}
                                        />
                                    </TableCell>
                                    <TableCell className="px-4 py-3 max-w-[280px]">
                                        <button
                                            type="button"
                                            onClick={() => openTripDrawer(trip.trip_id)}
                                            title="Open trip details drawer"
                                            className="inline-flex cursor-pointer xl:max-w-full items-center gap-1.5 truncate text-left text-sm font-semibold text-slate-800 hover:text-accent-700 hover:underline"
                                        >
                                            <span className="truncate">{trip.title || trip.trip_id}</span>
                                        </button>
                                        <div className="text-xs text-slate-500 mt-1">
                                            <CopyableUuid
                                                value={trip.trip_id}
                                                textClassName="max-w-full truncate text-xs"
                                                hintClassName="text-[9px]"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-xs text-slate-600 max-w-[240px]">
                                        <button
                                            type="button"
                                            onClick={() => openOwnerDrawer(trip.owner_id)}
                                            title="Open owner details"
                                            className="group cursor-pointer xl:max-w-full text-left"
                                        >
                                            <span className="block truncate text-sm font-medium text-slate-700 group-hover:text-accent-700 group-hover:underline">
                                                {trip.owner_email || trip.owner_id}
                                            </span>
                                            <span className="block text-[11px] text-slate-500 mt-0.5">
                                                <CopyableUuid
                                                    value={trip.owner_id}
                                                    focusable={false}
                                                    textClassName="max-w-full truncate text-[11px]"
                                                    hintClassName="text-[9px]"
                                                />
                                            </span>
                                        </button>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getLifecyclePillClassName(trip.status)}`}>
                                            {trip.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getGenerationPillClassName(resolveTripGenerationState(trip))}`}>
                                            {getGenerationStateLabel(resolveTripGenerationState(trip))}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="text-xs text-slate-600">
                                            {formatExpirationMeta(trip.trip_expires_at)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-slate-500">
                                        {new Date(trip.updated_at).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right">
                                        <TripRowActionsMenu
                                            trip={trip}
                                            disabled={isSaving}
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
                            ))}
                            {visibleTrips.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell className="px-4 py-8 text-center text-sm text-slate-500" colSpan={8}>
                                        No trips match the current filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoading && (
                                <TableRow>
                                    <TableCell className="px-4 py-8 text-center text-sm text-slate-500" colSpan={8}>
                                        <span className="inline-flex items-center gap-2 font-medium">
                                            <SpinnerGap size={16} className="animate-spin text-slate-400" />
                                            Loading trips...
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {isSaving && (
                    <p className="mt-2 text-xs text-slate-500">Saving changes...</p>
                )}
            </section>

            <Drawer
                open={isTripDrawerOpen}
                onOpenChange={(open) => {
                    setIsTripDrawerOpen(open);
                    if (!open) {
                        setSelectedTripDrawerId(null);
                        if (searchParams.has('trip') || searchParams.get('drawer') === 'trip') {
                            const next = new URLSearchParams(searchParams);
                            next.delete('trip');
                            next.delete('drawer');
                            setSearchParams(next, { replace: true });
                        }
                    }
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,560px)] p-0"
                    accessibleTitle={selectedTripForDrawer ? (selectedTripForDrawer.title || selectedTripForDrawer.trip_id) : 'Trip details'}
                    accessibleDescription="Inspect selected trip metadata and jump to related owner details."
                >
                    <div className="flex h-full flex-col">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-black text-slate-900">Trip details</h2>
                            <p className="truncate text-sm text-slate-600">
                                {selectedTripForDrawer ? (selectedTripForDrawer.title || selectedTripForDrawer.trip_id) : 'No trip selected'}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {!selectedTripForDrawer ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    No trip found for the selected audit target.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trip Information</h3>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Trip ID</span>
                                                <CopyableUuid value={selectedTripForDrawer.trip_id} textClassName="break-all text-sm font-medium text-slate-800" />
                                            </div>
                                            <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Owner ID</span>
                                                <div className="flex flex-col gap-2">
                                                    <CopyableUuid value={selectedTripForDrawer.owner_id} textClassName="break-all text-sm font-medium text-slate-800" />
                                                    <span className="text-xs text-slate-600">{selectedTripForDrawer.owner_email || 'No owner email'}</span>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openOwnerDrawer(selectedTripForDrawer.owner_id)}
                                                            className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                        >
                                                            View owner
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                void handleTransferTrip(selectedTripForDrawer);
                                                            }}
                                                            disabled={isSaving}
                                                            className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Transfer owner
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Lifecycle</span>
                                                <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getLifecyclePillClassName(selectedTripForDrawer.status)}`}>
                                                    {selectedTripForDrawer.status}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Generation</span>
                                                <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getGenerationPillClassName(selectedTripGenerationState)}`}>
                                                    {getGenerationStateLabel(selectedTripGenerationState)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Source</span>
                                                <span className="text-sm font-medium text-slate-800">{selectedTripForDrawer.source_kind || 'n/a'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Created At</span>
                                                <span className="text-sm font-medium text-slate-800">{new Date(selectedTripForDrawer.created_at).toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Updated At</span>
                                                <span className="text-sm font-medium text-slate-800">{new Date(selectedTripForDrawer.updated_at).toLocaleString()}</span>
                                            </div>
                                            <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Expires At</span>
                                                <span className="text-sm font-medium text-slate-800">{formatExpirationMeta(selectedTripForDrawer.trip_expires_at)}</span>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Lifecycle Controls</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-slate-500">Lifecycle status</span>
                                                <Select
                                                    value={selectedTripForDrawer.status}
                                                    onValueChange={(value) => {
                                                        void updateTripStatus(selectedTripForDrawer, { status: value as TripStatus });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-9 text-sm font-medium">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Active</SelectItem>
                                                        <SelectItem value="expired">Expired</SelectItem>
                                                        <SelectItem value="archived">Archived</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </label>
                                            <label className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-slate-500">Expiration timestamp</span>
                                                <input
                                                    key={`${selectedTripForDrawer.trip_id}-${selectedTripForDrawer.updated_at}`}
                                                    type="datetime-local"
                                                    defaultValue={toDateTimeInputValue(selectedTripForDrawer.trip_expires_at)}
                                                    onBlur={(event) => {
                                                        void updateTripStatus(selectedTripForDrawer, {
                                                            tripExpiresAt: fromDateTimeInputValue(event.target.value),
                                                        });
                                                    }}
                                                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm shadow-black/5"
                                                />
                                            </label>
                                        </div>
                                    </section>
                                    
                                    {isLoadingFullTrip ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                                            Loading trip map and itinerary...
                                        </div>
                                    ) : selectedFullTrip && (previewCityStops.length > 0 || previewMapUrl) ? (
                                        <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                            <div className="grid grid-cols-2">
                                                <div className="border-r border-gray-100 p-3.5">
                                                    <div className="space-y-0 h-48 overflow-y-auto">
                                                        {previewCityStops.length === 0 ? (
                                                            <div className="text-[11px] text-gray-400">No city stops found</div>
                                                        ) : (
                                                            previewCityStops.map((stop, idx) => {
                                                                const isStart = idx === 0;
                                                                const isEnd = idx === previewCityStops.length - 1;
                                                                const pinClass = isStart && !isEnd ? 'text-indigo-500' : isEnd && !isStart ? 'text-indigo-300' : 'text-indigo-500';
                                                                return (
                                                                    <div key={stop.id} className="flex min-h-[31px] items-center gap-2.5 px-2">
                                                                        <div className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
                                                                            {previewCityStops.length > 1 && (
                                                                                <span
                                                                                    className={`absolute left-1/2 w-0.5 -translate-x-1/2 bg-indigo-200 ${
                                                                                        isStart ? 'top-1/2 -bottom-px' : isEnd ? '-top-px bottom-1/2' : '-top-px -bottom-px'
                                                                                    }`}
                                                                                />
                                                                            )}
                                                                            {isStart || isEnd ? (
                                                                                <MapPin weight="fill" size={13} className={`relative z-10 ${pinClass}`} />
                                                                            ) : (
                                                                                <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                                                            <span className="break-words text-[15px] font-medium leading-5 text-gray-700">{stop.title}</span>
                                                                            <span className="text-[12px] font-medium leading-5 text-indigo-500/75">
                                                                                {Math.max(1, Math.ceil(stop.duration))} nights
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-2">
                                                    <div className="relative h-48 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                                                        {previewMapUrl ? (
                                                            <img
                                                                src={previewMapUrl}
                                                                alt={`Map preview for ${selectedFullTrip.title}`}
                                                                className="h-full w-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-[11px] text-gray-500">
                                                                Map preview unavailable
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                                            Trip preview is unavailable for this record.
                                        </div>
                                    )}

                                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Generation Diagnostics</h3>
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getGenerationPillClassName(selectedTripGenerationState)}`}>
                                                {getGenerationStateLabel(selectedTripGenerationState)}
                                            </span>
                                        </div>
                                        {selectedTripLatestAttempt ? (
                                            <dl className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Provider</dt>
                                                    <dd className="mt-1 text-sm font-medium text-slate-800">{selectedTripLatestAttempt.provider || 'n/a'}</dd>
                                                </div>
                                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Model</dt>
                                                    <dd className="mt-1 break-all text-sm font-medium text-slate-800">{selectedTripLatestAttempt.model || 'n/a'}</dd>
                                                </div>
                                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Request ID</dt>
                                                    <dd className="mt-1 break-all font-mono text-xs text-slate-700">{selectedTripLatestAttempt.requestId || 'n/a'}</dd>
                                                </div>
                                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Duration</dt>
                                                    <dd className="mt-1 text-sm font-medium text-slate-800">
                                                        {typeof selectedTripLatestAttempt.durationMs === 'number'
                                                            ? `${Math.max(0, Math.round(selectedTripLatestAttempt.durationMs))} ms`
                                                            : 'n/a'}
                                                    </dd>
                                                </div>
                                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Failure kind</dt>
                                                    <dd className="mt-1 text-sm font-medium text-slate-800">{selectedTripLatestAttempt.failureKind || 'n/a'}</dd>
                                                </div>
                                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Error code</dt>
                                                    <dd className="mt-1 text-sm font-medium text-slate-800">{selectedTripLatestAttempt.errorCode || 'n/a'}</dd>
                                                </div>
                                                <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                    <dt className="text-xs font-semibold text-slate-500">Error message</dt>
                                                    <dd className="mt-1 break-words text-sm font-medium text-slate-800">{selectedTripLatestAttempt.errorMessage || 'n/a'}</dd>
                                                </div>
                                            </dl>
                                        ) : (
                                            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                                No generation attempts captured yet.
                                            </div>
                                        )}
                                        {selectedTripGenerationAttempts.length > 0 && (
                                            <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent attempts</p>
                                                {selectedTripGenerationAttempts.map((attempt) => (
                                                    <div key={attempt.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-white px-2 py-1 text-[11px]">
                                                        <span className="font-semibold text-slate-700">{attempt.state}</span>
                                                        <span className="truncate text-slate-600">{attempt.model || 'n/a'}</span>
                                                        <span className="shrink-0 text-slate-500">
                                                            {typeof attempt.durationMs === 'number' ? `${Math.max(0, Math.round(attempt.durationMs))} ms` : 'n/a'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleRetryTripGeneration();
                                                }}
                                                disabled={!canRetryGenerationInDrawer}
                                                className="inline-flex items-center rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isRetryingGeneration ? 'Retrying with default model...' : 'Retry generation with default model'}
                                            </button>
                                        </div>
                                    </section>

                                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trip Actions</h3>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTripPreview(selectedTripForDrawer)}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                                            >
                                                Preview trip
                                                <ArrowSquareOut size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleDownloadTripJson(selectedTripForDrawer);
                                                }}
                                                disabled={isSaving}
                                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Download JSON
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleDuplicateTrip(selectedTripForDrawer);
                                                }}
                                                disabled={isSaving}
                                                className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Duplicate trip
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleTransferTrip(selectedTripForDrawer);
                                                }}
                                                disabled={isSaving}
                                                className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Transfer owner
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleSoftDeleteTrip(selectedTripForDrawer);
                                                }}
                                                disabled={isSaving}
                                                className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                                    selectedTripForDrawer.status === 'archived'
                                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                                        : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                                }`}
                                            >
                                                {selectedTripForDrawer.status === 'archived' ? 'Restore trip' : 'Soft-delete trip'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleHardDeleteTrip(selectedTripForDrawer);
                                                }}
                                                disabled={isSaving}
                                                className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Hard delete
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer
                open={isOwnerDrawerOpen}
                onOpenChange={(open) => {
                    setIsOwnerDrawerOpen(open);
                    if (!open) {
                        setSelectedOwnerId(null);
                        setSelectedOwnerProfile(null);
                        if (searchParams.has('user') || searchParams.get('drawer') === 'user') {
                            const next = new URLSearchParams(searchParams);
                            next.delete('user');
                            next.delete('drawer');
                            setSearchParams(next, { replace: true });
                        }
                    }
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,560px)] p-0"
                    accessibleTitle="Owner details"
                    accessibleDescription="View selected trip owner identity and account context."
                >
                    <div className="flex h-full flex-col">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-black text-slate-900">Owner details</h2>
                            <p className="truncate text-sm text-slate-600">
                                {selectedOwnerId
                                    ? <CopyableUuid value={selectedOwnerId} textClassName="max-w-[360px] truncate text-sm" />
                                    : 'No owner selected'}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingOwnerProfile ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Loading owner profile...
                                </div>
                            ) : selectedOwnerProfile ? (
                                <div className="space-y-4">
                                    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Identity Context</h3>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">User ID</span>
                                                <CopyableUuid value={selectedOwnerProfile.user_id} textClassName="break-all text-sm font-medium text-slate-800" />
                                            </div>
                                            <div className="col-span-full flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Email Address</span>
                                                <span className="break-all text-sm font-medium text-slate-800">{selectedOwnerProfile.email || '—'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Display Name</span>
                                                <span className="text-sm font-medium text-slate-800">{getUserDisplayName(selectedOwnerProfile) || '—'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Role</span>
                                                <span className="text-sm font-medium text-slate-800">{selectedOwnerProfile.system_role === 'admin' ? 'Admin' : 'User'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Tier</span>
                                                <span className="text-sm font-medium text-slate-800">{selectedOwnerProfile.tier_key || '—'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <span className="text-xs font-semibold text-slate-500">Status</span>
                                                <span className="text-sm font-medium text-slate-800">{formatAccountStatusLabel(selectedOwnerProfile.account_status)}</span>
                                            </div>
                                        </div>
                                    </section>
                                    
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/admin/users?user=${encodeURIComponent(selectedOwnerProfile.user_id)}&drawer=user`)}
                                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                        >
                                            View Full Profile
                                            <ArrowSquareOut size={16} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    No owner profile found.
                                </div>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </AdminShell>
    );
};
