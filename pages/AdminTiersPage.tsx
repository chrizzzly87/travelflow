import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowsClockwise, CheckCircle, SpinnerGap, Stack } from '@phosphor-icons/react';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import type { PlanTierKey } from '../types';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import {
    adminListUsers,
    adminPreviewTierReapply,
    adminReapplyTierToUsers,
    adminUpdatePlanEntitlements,
    type AdminTierReapplyPreview,
} from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Textarea } from '../components/ui/textarea';

type DraftMap = Record<PlanTierKey, string>;
type PreviewMap = Record<PlanTierKey, AdminTierReapplyPreview | null>;

const TIERS_COUNT_CACHE_KEY = 'admin.tiers.counts.v1';
const TIERS_PREVIEW_CACHE_KEY = 'admin.tiers.preview.v1';

const buildInitialTierCounts = (): Record<PlanTierKey, number> => ({
    tier_free: 0,
    tier_mid: 0,
    tier_premium: 0,
});

const buildInitialTierPreview = (): PreviewMap => ({
    tier_free: null,
    tier_mid: null,
    tier_premium: null,
});

const buildInitialDrafts = (): DraftMap => ({
    tier_free: JSON.stringify(PLAN_CATALOG.tier_free.entitlements, null, 2),
    tier_mid: JSON.stringify(PLAN_CATALOG.tier_mid.entitlements, null, 2),
    tier_premium: JSON.stringify(PLAN_CATALOG.tier_premium.entitlements, null, 2),
});

const EntitlementCard: React.FC<{
    draft: string;
    onChange: (nextStr: string) => void;
}> = ({ draft, onChange }) => {
    let parsed: Record<string, any> = {};
    let isError = false;
    try {
        parsed = JSON.parse(draft) || {};
    } catch {
        isError = true;
    }

    const updateField = (field: string, value: any) => {
        const next = { ...parsed, [field]: value };
        onChange(JSON.stringify(next, null, 2));
    };

    if (isError) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-xs text-red-700 dark:text-red-300">
                    The limits JSON is not valid. Fix it here to get the form back.
                </p>
                <Textarea
                    aria-label="Tier limits JSON editor"
                    aria-invalid="true"
                    value={draft}
                    onChange={(e) => onChange(e.target.value)}
                    className="min-h-[220px] font-mono text-xs"
                />
            </div>
        );
    }

    const limits = [
        { key: 'maxActiveTrips', label: 'Max active trips' },
        { key: 'maxTotalTrips', label: 'Max total trips' },
        { key: 'tripExpirationDays', label: 'Trip expiration (days)' },
    ];

    const permissions = [
        { key: 'canShare', label: 'Can share trips' },
        { key: 'canCreateEditableShares', label: 'Can appoint co-editors' },
        { key: 'canViewProTrips', label: 'Can view premium content' },
        { key: 'canCreateProTrips', label: 'Can create premium trips' },
    ];

    return (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/40 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {limits.map((l) => (
                    <label key={l.key} className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">{l.label}</span>
                        <Input
                            type="number"
                            aria-label={l.label}
                            value={parsed[l.key] === null ? '' : parsed[l.key] ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value);
                                updateField(l.key, val);
                            }}
                            placeholder="Unlimited"
                            className="h-8 tabular-nums"
                        />
                    </label>
                ))}
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {permissions.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            aria-label={p.label}
                            checked={Boolean(parsed[p.key])}
                            onCheckedChange={(checked) => updateField(p.key, checked === true)}
                        />
                        <span className="text-sm text-foreground">{p.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

export const AdminTiersPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [tierDrafts, setTierDrafts] = useState<DraftMap>(buildInitialDrafts);
    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<PlanTierKey | null>(null);
    const [isReapplying, setIsReapplying] = useState<PlanTierKey | null>(null);
    const [isReloading, setIsReloading] = useState(false);
    const [tierCounts, setTierCounts] = useState<Record<PlanTierKey, number>>(
        () => readAdminCache<Record<PlanTierKey, number>>(TIERS_COUNT_CACHE_KEY, buildInitialTierCounts())
    );
    const [tierPreview, setTierPreview] = useState<PreviewMap>(
        () => readAdminCache<PreviewMap>(TIERS_PREVIEW_CACHE_KEY, buildInitialTierPreview())
    );
    const [isLoadingPreview, setIsLoadingPreview] = useState<PlanTierKey | null>(null);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [dateRange, searchParams, searchValue, setSearchParams]);

    const refreshTierSnapshot = async (tierKey: PlanTierKey) => {
        setIsLoadingPreview(tierKey);
        try {
            const preview = await adminPreviewTierReapply(tierKey);
            setTierPreview((current) => {
                const next = { ...current, [tierKey]: preview };
                writeAdminCache(TIERS_PREVIEW_CACHE_KEY, next);
                return next;
            });
        } finally {
            setIsLoadingPreview((current) => (current === tierKey ? null : current));
        }
    };

    const loadTierCounts = async () => {
        try {
            const users = await adminListUsers({ limit: 500 });
            const rangeUsers = users.filter((user) => isIsoDateInRange(user.created_at, dateRange));
            const nextCounts: Record<PlanTierKey, number> = {
                tier_free: rangeUsers.filter((user) => user.tier_key === 'tier_free').length,
                tier_mid: rangeUsers.filter((user) => user.tier_key === 'tier_mid').length,
                tier_premium: rangeUsers.filter((user) => user.tier_key === 'tier_premium').length,
            };
            setTierCounts(nextCounts);
            writeAdminCache(TIERS_COUNT_CACHE_KEY, nextCounts);
        } catch {
            // non-blocking count card
        }
    };

    const refreshAllTierSnapshots = async () => {
        for (const tierKey of PLAN_ORDER) {
            // Sequential loading keeps DB pressure low and preserves predictable UI updates.
            // eslint-disable-next-line no-await-in-loop
            await refreshTierSnapshot(tierKey);
        }
    };

    const refreshAllTierData = async () => {
        setIsReloading(true);
        try {
            await Promise.all([
                loadTierCounts(),
                refreshAllTierSnapshots(),
            ]);
        } finally {
            setIsReloading(false);
        }
    };

    useEffect(() => {
        void refreshAllTierData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

    const saveTier = async (tierKey: PlanTierKey) => {
        setMessage(null);
        setErrorMessage(null);
        setIsSaving(tierKey);
        try {
            const parsed = JSON.parse(tierDrafts[tierKey]);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Tier entitlement payload must be a JSON object.');
            }
            await adminUpdatePlanEntitlements(tierKey, parsed as Record<string, unknown>);
            setMessage(`Saved the ${PLAN_CATALOG[tierKey].publicName} template.`);
            await refreshTierSnapshot(tierKey);
        } catch (error) {
            setErrorMessage(
                error instanceof SyntaxError || (error instanceof Error && error.message.startsWith('Tier entitlement payload'))
                    ? `The ${PLAN_CATALOG[tierKey].publicName} limits are not a valid JSON object. Fix them and save again.`
                    : `Could not save the ${PLAN_CATALOG[tierKey].publicName} template. Try again in a moment.`
            );
        } finally {
            setIsSaving(null);
        }
    };

    const reapplyTier = async (tierKey: PlanTierKey) => {
        setMessage(null);
        setErrorMessage(null);
        setIsReapplying(tierKey);
        try {
            const result = await adminReapplyTierToUsers(tierKey);
            setMessage(
                `Reapplied ${PLAN_CATALOG[tierKey].publicName}: ${result.affected_users} users and ${result.affected_trips} trips updated.`
            );
            await refreshTierSnapshot(tierKey);
        } catch (error) {
            setErrorMessage(`Could not reapply ${PLAN_CATALOG[tierKey].publicName} to existing customers. Try again in a moment.`);
        } finally {
            setIsReapplying(null);
        }
    };

    const visibleTierKeys = PLAN_ORDER.filter((tierKey) => {
        const token = searchValue.trim().toLowerCase();
        if (!token) return true;
        return (
            tierKey.toLowerCase().includes(token)
            || PLAN_CATALOG[tierKey].publicName.toLowerCase().includes(token)
        );
    });

    const isBusy = isSaving !== null || isReapplying !== null;

    return (
        <AdminShell
            title="Tiers"
            description="Edit plan templates, then reapply entitlements and trip lifecycle changes to existing customers."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton
                    onClick={() => {
                        void refreshAllTierData();
                    }}
                    isLoading={isReloading}
                    label="Reload"
                />
            )}
        >
            <div className="flex flex-col gap-6">
                {(errorMessage || message) && (
                    <div className="flex flex-col gap-3">
                        {errorMessage && <AdminErrorAlert message={errorMessage} />}
                        {message && (
                            <Alert variant="success">
                                <CheckCircle weight="fill" />
                                <AlertDescription>{message}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                {visibleTierKeys.length > 0 && (
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Users per tier">
                        {visibleTierKeys.map((tierKey) => (
                            <AdminStatCard
                                key={`count-${tierKey}`}
                                label={PLAN_CATALOG[tierKey].publicName}
                                value={<AdminCountUpNumber value={tierCounts[tierKey]} />}
                                hint={<>Users in the selected date range · <span className="font-mono">{tierKey}</span></>}
                            />
                        ))}
                    </section>
                )}

                {visibleTierKeys.length > 0 && (
                    <section className="grid gap-4 xl:grid-cols-3">
                        {visibleTierKeys.map((tierKey) => {
                            const preview = tierPreview[tierKey];
                            return (
                                <AdminSurfaceCard key={`tier-${tierKey}`} className="flex flex-col gap-4">
                                    <AdminSectionHeader
                                        title={PLAN_CATALOG[tierKey].publicName}
                                        description={<span className="font-mono text-xs">{tierKey}</span>}
                                        actions={(
                                            <AdminStatusBadge tone="neutral" dot={false} className="tabular-nums">
                                                ${PLAN_CATALOG[tierKey].monthlyPriceUsd}/mo
                                            </AdminStatusBadge>
                                        )}
                                    />
                                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
                                        {isLoadingPreview === tierKey ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <SpinnerGap size={12} className="animate-spin" aria-hidden="true" />
                                                Loading reapply preview…
                                            </span>
                                        ) : (
                                            <span className="tabular-nums">
                                                Reapply would touch {preview?.affected_users ?? 0} users and {preview?.affected_trips ?? 0} trips
                                                {' '}({preview?.active_trips ?? 0} active, {preview?.expired_trips ?? 0} expired, {preview?.archived_trips ?? 0} archived);
                                                {' '}{preview?.users_with_overrides ?? 0} users have overrides.
                                            </span>
                                        )}
                                    </div>
                                    <EntitlementCard
                                        draft={tierDrafts[tierKey]}
                                        onChange={(nextStr) => {
                                            setTierDrafts((current) => ({
                                                ...current,
                                                [tierKey]: nextStr,
                                            }));
                                        }}
                                    />
                                    <div className="mt-auto flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => void saveTier(tierKey)}
                                            disabled={isBusy}
                                        >
                                            {isSaving === tierKey ? (
                                                <>
                                                    <SpinnerGap className="animate-spin" aria-hidden="true" />
                                                    Saving…
                                                </>
                                            ) : (
                                                'Save template'
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void reapplyTier(tierKey)}
                                            disabled={isBusy}
                                        >
                                            {isReapplying === tierKey ? (
                                                <SpinnerGap className="animate-spin" aria-hidden="true" />
                                            ) : (
                                                <ArrowsClockwise aria-hidden="true" />
                                            )}
                                            {isReapplying === tierKey ? 'Reapplying…' : 'Reapply to customers'}
                                        </Button>
                                    </div>
                                </AdminSurfaceCard>
                            );
                        })}
                    </section>
                )}

                {visibleTierKeys.length === 0 && (
                    <AdminEmptyState
                        icon={<Stack />}
                        title="No tiers match this search"
                        description="Clear the search field to see every plan tier."
                    />
                )}
            </div>
        </AdminShell>
    );
};
