import React, { useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, SpinnerGap } from '@phosphor-icons/react';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import { adminListAuditLogs, type AdminAuditRecord } from '../services/adminService';

export const AdminAuditPage: React.FC = () => {
    const [logs, setLogs] = useState<AdminAuditRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchValue, setSearchValue] = useState('');
    const [dateRange, setDateRange] = useState<AdminDateRange>('30d');
    const [actionFilter, setActionFilter] = useState('');
    const [targetFilter, setTargetFilter] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadLogs = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const rows = await adminListAuditLogs({
                limit: 400,
                action: actionFilter || undefined,
                targetType: targetFilter || undefined,
            });
            setLogs(rows);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load audit logs.');
            setLogs([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionFilter, targetFilter]);

    const visibleLogs = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return logs.filter((log) => {
            if (!isIsoDateInRange(log.created_at, dateRange)) return false;
            if (!token) return true;
            return (
                (log.action || '').toLowerCase().includes(token)
                || (log.target_type || '').toLowerCase().includes(token)
                || (log.target_id || '').toLowerCase().includes(token)
                || (log.actor_email || '').toLowerCase().includes(token)
            );
        });
    }, [dateRange, logs, searchValue]);

    return (
        <AdminShell
            title="Admin Audit Log"
            description="Immutable timeline of administrative actions for incident replay and root-cause tracing."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <button
                    type="button"
                    onClick={() => void loadLogs()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                >
                    <ArrowClockwise size={14} />
                    Refresh
                </button>
            )}
        >
            {errorMessage && (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {errorMessage}
                </section>
            )}

            <section className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    value={actionFilter}
                    onChange={(event) => setActionFilter(event.target.value)}
                    placeholder="Filter action"
                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <input
                    value={targetFilter}
                    onChange={(event) => setTargetFilter(event.target.value)}
                    placeholder="Filter target type"
                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                />
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
                                <tr key={log.id} className="border-b border-slate-100 align-top">
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
