import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowsClockwise, SpinnerGap } from '@phosphor-icons/react';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import type { PlanTierKey } from '../types';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
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
            <textarea
                value={draft}
                onChange={(e) => onChange(e.target.value)}
                className="mt-3 min-h-[220px] w-full rounded-lg border border-red-300 bg-red-50 text-red-900 px-3 py-2 font-mono text-xs"
            />
        );
    }

    const limits = [
        { key: 'maxActiveTrips', label: 'Max Active Trips' },
        { key: 'maxTotalTrips', label: 'Max Total Trips' },
        { key: 'tripExpirationDays', label: 'Trip Expiration (Days)' },
    ];
    
    const permissions = [
        { key: 'canShare', label: 'Can Share Trips' },
        { key: 'canCreateEditableShares', label: 'Can Appoint Co-Editors' },
        { key: 'canViewProTrips', label: 'Can View Premium Content' },
        { key: 'canCreateProTrips', label: 'Can Create Premium Trips' },
    ];

    return (
        <div className="mt-3 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3">
                {limits.map((l) => (
                    <div key={l.key} className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold uppercase text-slate-500">{l.label}</label>
                        <input
                            type="number"
                            value={parsed[l.key] === null ? '' : parsed[l.key] ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value);
                                updateField(l.key, val);
                            }}
                            placeholder="Unlimited"
                            className="h-8 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-accent-400 focus:ring-1 focus:ring-accent-400"
                        />
                    </div>
                ))}
            </div>
            
            <div className="h-px w-full bg-slate-200" />
            
            <div className="grid grid-cols-2 gap-3">
                {permissions.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={Boolean(parsed[p.key])}
                            onChange={(e) => updateField(p.key, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-600"
                        />
                        <span className="text-xs font-medium text-slate-700">{p.label}</span>
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
            setMessage(`Saved entitlement template for ${tierKey}.`);
            await refreshTierSnapshot(tierKey);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `Could not save ${tierKey}.`);
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
                `Reapply completed for ${tierKey}: ${result.affected_users} users and ${result.affected_trips} trips updated.`
            );
            await refreshTierSnapshot(tierKey);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : `Could not reapply ${tierKey}.`);
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

    return (
        <AdminShell
            title="Tier and Entitlement Control"
            description="Edit plan templates, then reapply entitlement and trip lifecycle changes to existing customers."
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
            {errorMessage && (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {errorMessage}
                </section>
            )}
            {message && (
                <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {message}
                </section>
            )}

            <section className="grid gap-3 md:grid-cols-3">
                {visibleTierKeys.map((tierKey) => (
                    <article key={`count-${tierKey}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tierKey}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{PLAN_CATALOG[tierKey].publicName}</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">
                            <AdminCountUpNumber value={tierCounts[tierKey]} />
                        </p>
                        <p className="text-xs text-slate-500">Users in selected date range</p>
                    </article>
                ))}
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-3">
                {visibleTierKeys.map((tierKey) => (
                    <article key={`tier-${tierKey}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tierKey}</p>
                                <h2 className="text-base font-black text-slate-900">{PLAN_CATALOG[tierKey].publicName}</h2>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                                ${PLAN_CATALOG[tierKey].monthlyPriceUsd}/mo
                            </span>
                        </div>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                            {isLoadingPreview === tierKey ? (
                                <span className="inline-flex items-center gap-1">
                                    <SpinnerGap size={12} className="animate-spin" />
                                    Loading reapply preview...
                                </span>
                            ) : (
                                <span>
                                    Preview: {tierPreview[tierKey]?.affected_users ?? 0} users, {tierPreview[tierKey]?.affected_trips ?? 0} trips
                                    {' '}({tierPreview[tierKey]?.active_trips ?? 0} active / {tierPreview[tierKey]?.expired_trips ?? 0} expired / {tierPreview[tierKey]?.archived_trips ?? 0} archived),
                                    {' '}overrides on {tierPreview[tierKey]?.users_with_overrides ?? 0} users.
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
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => void saveTier(tierKey)}
                                disabled={isSaving !== null || isReapplying !== null}
                                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {isSaving === tierKey ? (
                                    <span className="inline-flex items-center gap-1">
                                        <SpinnerGap size={13} className="animate-spin" />
                                        Saving...
                                    </span>
                                ) : (
                                    'Save template'
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => void reapplyTier(tierKey)}
                                disabled={isSaving !== null || isReapplying !== null}
                                className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-900 hover:bg-accent-100 disabled:opacity-50"
                            >
                                {isReapplying === tierKey ? (
                                    <span className="inline-flex items-center gap-1">
                                        <SpinnerGap size={13} className="animate-spin" />
                                        Reapplying...
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        <ArrowsClockwise size={13} />
                                        Reapply to customers
                                    </span>
                                )}
                            </button>
                        </div>
                    </article>
                ))}
            </section>
            {visibleTierKeys.length === 0 && (
                <section className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    No tiers match the current search filter.
                </section>
            )}
        </AdminShell>
    );
};
