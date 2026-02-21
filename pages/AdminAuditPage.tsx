import React, { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, CopySimple, SpinnerGap, X } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import { adminListAuditLogs, type AdminAuditRecord } from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';

const AUDIT_CACHE_KEY = 'admin.audit.cache.v1';

const ACTION_FILTER_LABELS: Record<string, string> = {
    'admin.user.hard_delete': 'Hard-deleted user',
    'admin.user.invite': 'Invited user',
    'admin.user.create_direct': 'Created user',
    'admin.user.update_profile': 'Updated user',
    'admin.user.update_tier': 'Updated user tier',
    'admin.user.update_overrides': 'Updated user overrides',
    'admin.trip.hard_delete': 'Hard-deleted trip',
    'admin.trip.update': 'Updated trip',
    'admin.trip.override_commit': 'Overrode trip content',
    'admin.tier.update_entitlements': 'Updated tier entitlements',
    'admin.tier.reapply': 'Reapplied tier to users',
};

const TARGET_LABELS: Record<string, string> = {
    user: 'User',
    trip: 'Trip',
    tier: 'Tier',
    unknown: 'Unknown',
};

const NOISY_DIFF_KEYS = new Set([
    'updated_at',
    'created_at',
    'role_updated_at',
    'role_updated_by',
]);

interface AuditDiffEntry {
    key: string;
    beforeValue: unknown;
    afterValue: unknown;
}

const parseQueryMultiValue = (value: string | null): string[] => {
    if (!value) return [];
    return Array.from(new Set(
        value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
    ));
};

const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

const toComparableValue = (value: unknown): string => JSON.stringify(value ?? null);

const formatFieldLabel = (value: string): string => (
    value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
);

const formatAuditValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '—';
        const asDate = Date.parse(trimmed);
        if (Number.isFinite(asDate) && /^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
            return new Date(asDate).toLocaleString();
        }
        return trimmed;
    }
    return JSON.stringify(value);
};

const getStatusChange = (entries: AuditDiffEntry[], key: string): { from: string; to: string } | null => {
    const entry = entries.find((candidate) => candidate.key === key);
    if (!entry) return null;
    const from = typeof entry.beforeValue === 'string' ? entry.beforeValue.trim().toLowerCase() : '';
    const to = typeof entry.afterValue === 'string' ? entry.afterValue.trim().toLowerCase() : '';
    if (!from && !to) return null;
    return { from, to };
};

const getActionFilterLabel = (action: string): string => ACTION_FILTER_LABELS[action] || action;

const getTargetLabel = (targetType: string): string => TARGET_LABELS[targetType] || targetType;

const isHardDeleteAction = (action: string): boolean => action.includes('hard_delete');

const buildAuditDiffEntries = (log: AdminAuditRecord): AuditDiffEntry[] => {
    const before = asRecord(log.before_data);
    const after = asRecord(log.after_data);
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
        .filter((key) => !NOISY_DIFF_KEYS.has(key))
        .filter((key) => toComparableValue(before[key]) !== toComparableValue(after[key]))
        .map((key) => ({
            key,
            beforeValue: before[key],
            afterValue: after[key],
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
};

const resolveAuditActionPresentation = (
    log: AdminAuditRecord,
    diffEntries: AuditDiffEntry[]
): { label: string; className: string } => {
    const raw = log.action;
    if (raw === 'admin.user.hard_delete') {
        return { label: 'Hard-deleted user', className: 'border-rose-300 bg-rose-50 text-rose-800' };
    }
    if (raw === 'admin.trip.hard_delete') {
        return { label: 'Hard-deleted trip', className: 'border-rose-300 bg-rose-50 text-rose-800' };
    }
    if (raw === 'admin.user.invite') {
        return { label: 'Invited user', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }
    if (raw === 'admin.user.create_direct') {
        return { label: 'Created user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
    }
    if (raw === 'admin.user.update_profile') {
        const accountStatusChange = getStatusChange(diffEntries, 'account_status');
        if (accountStatusChange?.to === 'deleted') {
            return { label: 'Soft-deleted user', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (accountStatusChange?.from === 'deleted' && accountStatusChange?.to === 'active') {
            return { label: 'Restored user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
        }
        if (accountStatusChange?.to === 'disabled') {
            return { label: 'Suspended user', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (accountStatusChange?.from === 'disabled' && accountStatusChange?.to === 'active') {
            return { label: 'Reactivated user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
        }
        if (diffEntries.some((entry) => entry.key === 'system_role')) {
            return { label: 'Updated user role', className: 'border-indigo-300 bg-indigo-50 text-indigo-800' };
        }
        if (diffEntries.some((entry) => entry.key === 'tier_key')) {
            return { label: 'Updated user tier', className: 'border-sky-300 bg-sky-50 text-sky-800' };
        }
        return { label: 'Updated user', className: 'border-slate-300 bg-slate-100 text-slate-800' };
    }
    if (raw === 'admin.user.update_tier') {
        return { label: 'Updated user tier', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }
    if (raw === 'admin.user.update_overrides') {
        return { label: 'Updated overrides', className: 'border-indigo-300 bg-indigo-50 text-indigo-800' };
    }
    if (raw === 'admin.trip.update') {
        if (diffEntries.some((entry) => entry.key === 'owner_id')) {
            return { label: 'Transferred trip owner', className: 'border-violet-300 bg-violet-50 text-violet-800' };
        }
        const tripStatusChange = getStatusChange(diffEntries, 'status');
        if (tripStatusChange?.to === 'archived') {
            return { label: 'Archived trip', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (tripStatusChange?.from === 'archived' && tripStatusChange?.to === 'active') {
            return { label: 'Restored trip', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
        }
        if (tripStatusChange?.to === 'expired') {
            return { label: 'Expired trip', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (diffEntries.some((entry) => entry.key === 'trip_expires_at')) {
            return { label: 'Updated trip expiry', className: 'border-sky-300 bg-sky-50 text-sky-800' };
        }
        return { label: 'Updated trip', className: 'border-slate-300 bg-slate-100 text-slate-800' };
    }
    if (raw === 'admin.trip.override_commit') {
        return { label: 'Overrode trip content', className: 'border-violet-300 bg-violet-50 text-violet-800' };
    }
    if (raw === 'admin.tier.update_entitlements') {
        return { label: 'Updated tier entitlements', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }
    if (raw === 'admin.tier.reapply') {
        return { label: 'Reapplied tier', className: 'border-slate-300 bg-slate-100 text-slate-800' };
    }
    return { label: getActionFilterLabel(raw), className: 'border-slate-300 bg-slate-100 text-slate-800' };
};

const getTargetPillClass = (targetType: string): string => {
    if (targetType === 'user') return 'border-indigo-300 bg-indigo-50 text-indigo-800';
    if (targetType === 'trip') return 'border-sky-300 bg-sky-50 text-sky-800';
    if (targetType === 'tier') return 'border-violet-300 bg-violet-50 text-violet-800';
    return 'border-slate-300 bg-slate-100 text-slate-700';
};

const resolveTargetHref = (log: AdminAuditRecord): string | null => {
    if (!log.target_id || isHardDeleteAction(log.action)) return null;
    if (log.target_type === 'user') {
        return `/admin/users?drawer=user&user=${encodeURIComponent(log.target_id)}`;
    }
    if (log.target_type === 'trip') {
        return `/admin/trips?q=${encodeURIComponent(log.target_id)}`;
    }
    if (log.target_type === 'tier') {
        return '/admin/tiers';
    }
    return null;
};

export const AdminAuditPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [logs, setLogs] = useState<AdminAuditRecord[]>(() => readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []));
    const [isLoading, setIsLoading] = useState(() => logs.length === 0);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [actionFilters, setActionFilters] = useState<string[]>(() => parseQueryMultiValue(searchParams.get('action')));
    const [targetFilters, setTargetFilters] = useState<string[]>(() => parseQueryMultiValue(searchParams.get('target')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (actionFilters.length > 0) next.set('action', actionFilters.join(','));
        if (targetFilters.length > 0) next.set('target', targetFilters.join(','));
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [actionFilters, dateRange, searchParams, searchValue, setSearchParams, targetFilters]);

    const loadLogs = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const rows = await adminListAuditLogs({
                limit: 400,
            });
            setLogs(rows);
            writeAdminCache(AUDIT_CACHE_KEY, rows);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load audit logs.');
            setLogs((current) => (current.length > 0 ? current : []));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const visibleLogs = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return logs.filter((log) => {
            if (!isIsoDateInRange(log.created_at, dateRange)) return false;
            if (actionFilters.length > 0 && !actionFilters.includes(log.action)) return false;
            if (targetFilters.length > 0 && !targetFilters.includes(log.target_type)) return false;
            if (!token) return true;
            return (
                (log.action || '').toLowerCase().includes(token)
                || getActionFilterLabel(log.action).toLowerCase().includes(token)
                || (log.target_type || '').toLowerCase().includes(token)
                || getTargetLabel(log.target_type).toLowerCase().includes(token)
                || (log.target_id || '').toLowerCase().includes(token)
                || (log.actor_email || '').toLowerCase().includes(token)
            );
        });
    }, [actionFilters, dateRange, logs, searchValue, targetFilters]);

    const logsInDateRange = useMemo(
        () => logs.filter((log) => isIsoDateInRange(log.created_at, dateRange)),
        [dateRange, logs]
    );

    const actionFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInDateRange.forEach((log) => {
            const nextValue = (counts.get(log.action) || 0) + 1;
            counts.set(log.action, nextValue);
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => ({ value, label: getActionFilterLabel(value), count }));
    }, [logsInDateRange]);

    const targetFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInDateRange.forEach((log) => {
            const nextValue = (counts.get(log.target_type) || 0) + 1;
            counts.set(log.target_type, nextValue);
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => ({ value, label: getTargetLabel(value), count }));
    }, [logsInDateRange]);

    const copyToClipboard = async (value: string, token: string) => {
        if (!value.trim() || typeof navigator === 'undefined' || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedToken(token);
            window.setTimeout(() => {
                setCopiedToken((current) => (current === token ? null : current));
            }, 1400);
        } catch {
            // best effort only
        }
    };

    return (
        <AdminShell
            title="Admin Audit Log"
            description="Immutable timeline of administrative actions for incident replay and root-cause tracing."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadLogs()}
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

            <section className="mb-3 flex flex-wrap items-center gap-2">
                <AdminFilterMenu
                    label="Action"
                    options={actionFilterOptions}
                    selectedValues={actionFilters}
                    onSelectedValuesChange={setActionFilters}
                />
                <AdminFilterMenu
                    label="Target"
                    options={targetFilterOptions}
                    selectedValues={targetFilters}
                    onSelectedValuesChange={setTargetFilters}
                />
                <button
                    type="button"
                    onClick={() => {
                        setActionFilters([]);
                        setTargetFilters([]);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <X size={14} />
                    Reset
                </button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-3 py-2">When</th>
                                <th className="px-3 py-2">Actor</th>
                                <th className="px-3 py-2">Action</th>
                                <th className="px-3 py-2">Target</th>
                                <th className="px-3 py-2">Diff & details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleLogs.map((log) => {
                                const diffEntries = buildAuditDiffEntries(log);
                                const actionPresentation = resolveAuditActionPresentation(log, diffEntries);
                                const targetHref = resolveTargetHref(log);
                                const targetLabel = getTargetLabel(log.target_type);
                                const visibleDiffEntries = diffEntries.slice(0, 5);
                                const hiddenDiffCount = Math.max(diffEntries.length - visibleDiffEntries.length, 0);

                                return (
                                    <tr key={log.id} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                                        <td className="px-3 py-2 text-xs text-slate-600">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-xs text-slate-700">{log.actor_email || log.actor_user_id || 'unknown'}</td>
                                        <td className="px-3 py-2 text-xs">
                                            <span
                                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionPresentation.className}`}
                                                title={log.action}
                                            >
                                                {actionPresentation.label}
                                            </span>
                                            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                                <span className="max-w-[220px] truncate font-mono" title={log.action}>
                                                    {log.action}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => void copyToClipboard(log.action, `action-${log.id}`)}
                                                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-100"
                                                    title="Copy raw action code"
                                                >
                                                    <CopySimple size={11} />
                                                    Copy
                                                </button>
                                                {copiedToken === `action-${log.id}` && <span className="text-emerald-700">Copied</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600">
                                            {targetHref ? (
                                                <a
                                                    href={targetHref}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-accent-300 hover:text-accent-700"
                                                    title={`Open ${targetLabel.toLowerCase()} details`}
                                                >
                                                    <span className={`rounded-full border px-1.5 py-0.5 ${getTargetPillClass(log.target_type)}`}>
                                                        {targetLabel}
                                                    </span>
                                                    <ArrowSquareOut size={11} />
                                                </a>
                                            ) : (
                                                <span
                                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTargetPillClass(log.target_type)}`}
                                                    title={`Raw target type: ${log.target_type}`}
                                                >
                                                    {targetLabel}
                                                </span>
                                            )}
                                            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                                <span className="max-w-[220px] truncate font-mono" title={log.target_id || 'n/a'}>
                                                    {log.target_id || 'n/a'}
                                                </span>
                                                {log.target_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyToClipboard(log.target_id || '', `target-${log.id}`)}
                                                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-100"
                                                        title="Copy target id"
                                                    >
                                                        <CopySimple size={11} />
                                                        Copy
                                                    </button>
                                                )}
                                                {copiedToken === `target-${log.id}` && <span className="text-emerald-700">Copied</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {visibleDiffEntries.length > 0 ? (
                                                <div className="max-w-[420px] space-y-2">
                                                    {visibleDiffEntries.map((entry) => (
                                                        <article key={`${log.id}-${entry.key}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                {formatFieldLabel(entry.key)}
                                                            </p>
                                                            <div className="mt-1 grid gap-1 lg:grid-cols-2">
                                                                <div className="rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-[11px] text-rose-900">
                                                                    <span className="font-semibold">Before: </span>
                                                                    <span className="break-all">{formatAuditValue(entry.beforeValue)}</span>
                                                                </div>
                                                                <div className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[11px] text-emerald-900">
                                                                    <span className="font-semibold">After: </span>
                                                                    <span className="break-all">{formatAuditValue(entry.afterValue)}</span>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    ))}
                                                    {hiddenDiffCount > 0 && (
                                                        <p className="text-[11px] font-semibold text-slate-500">
                                                            +{hiddenDiffCount} more changed field{hiddenDiffCount === 1 ? '' : 's'}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">No field diff recorded.</p>
                                            )}
                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                <details className="mt-2 max-w-[420px] rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
                                                    <summary className="cursor-pointer font-semibold text-slate-700">
                                                        Metadata
                                                    </summary>
                                                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
                                                        {JSON.stringify(log.metadata, null, 2)}
                                                    </pre>
                                                </details>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {visibleLogs.length === 0 && !isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                                        No audit entries found for the current filters.
                                    </td>
                                </tr>
                            )}
                            {isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                                        <span className="inline-flex items-center gap-2">
                                            <SpinnerGap size={14} className="animate-spin" />
                                            Loading audit logs...
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminShell>
    );
};
