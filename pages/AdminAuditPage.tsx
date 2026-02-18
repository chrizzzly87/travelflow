import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SpinnerGap, X } from '@phosphor-icons/react';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import { adminListAuditLogs, type AdminAuditRecord } from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';

const AUDIT_CACHE_KEY = 'admin.audit.cache.v1';

const parseQueryMultiValue = (value: string | null): string[] => {
    if (!value) return [];
    return Array.from(new Set(
        value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
    ));
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
                || (log.target_type || '').toLowerCase().includes(token)
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
            .map(([value, count]) => ({ value, label: value, count }));
    }, [logsInDateRange]);

    const targetFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInDateRange.forEach((log) => {
            const nextValue = (counts.get(log.target_type) || 0) + 1;
            counts.set(log.target_type, nextValue);
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => ({ value, label: value, count }));
    }, [logsInDateRange]);

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
                                <th className="px-3 py-2">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleLogs.map((log) => (
                                <tr key={log.id} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                                    <td className="px-3 py-2 text-xs text-slate-600">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-xs text-slate-700">{log.actor_email || log.actor_user_id || 'unknown'}</td>
                                    <td className="px-3 py-2 text-xs font-semibold text-slate-800">{log.action}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                        <div>{log.target_type}</div>
                                        <div className="break-all text-[11px] text-slate-500">{log.target_id || 'n/a'}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <pre className="max-w-[360px] overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
                                            {JSON.stringify(log.metadata || {}, null, 2)}
                                        </pre>
                                    </td>
                                </tr>
                            ))}
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
