import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    adminGetUserChangeLog,
    adminListAuditLogs,
    adminListUserChangeLogs,
    type AdminAuditRecord,
    type AdminUserChangeRecord,
} from '../../../services/adminService';
import { AdminUserFacingError, toAdminErrorMessage } from '../../../services/adminErrorMessages';
import { readAdminCache, writeAdminCache } from '../adminLocalCache';
import {
    AUDIT_CACHE_KEY,
    AUDIT_SOURCE_MAX_ROWS,
    USER_CHANGE_CACHE_KEY,
    findMissingUndoSourceIds,
    indexAuditTimeline,
    mergeAuditTimeline,
} from './adminAuditModel';

// Errors this screen throws itself carry an authored sentence that is safe to show.
// Anything else (RPC, network, Supabase) is logged and replaced with a fallback, so a
// raw exception never reaches the admin UI.
export const AuditUserFacingError = AdminUserFacingError;

export const toAuditErrorMessage = (error: unknown, fallback: string): string => (
    toAdminErrorMessage(error, fallback, 'admin-audit')
);

interface AuditSources {
    logs: AdminAuditRecord[];
    userChangeLogs: AdminUserChangeRecord[];
    isLoading: boolean;
    errorMessage: string | null;
    dataSourceNotice: string | null;
}

const cachedRowsNotice = (source: string, count: number): string => (
    `Live ${source} failed. Showing ${count} cached row${count === 1 ? '' : 's'} from this browser.`
);

/**
 * Loads admin audit rows and user change rows side by side. Either source may
 * fall back to this browser's cache; only a source with no cache is an error.
 */
export const useAdminAuditData = () => {
    const [sources, setSources] = useState<AuditSources>(() => {
        const logs = readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []);
        const userChangeLogs = readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, []);
        return {
            logs,
            userChangeLogs,
            isLoading: logs.length === 0 && userChangeLogs.length === 0,
            errorMessage: null,
            dataSourceNotice: null,
        };
    });
    const [lookupUserChangeLogs, setLookupUserChangeLogs] = useState<AdminUserChangeRecord[]>([]);
    const requestedUndoSourceIdsRef = useRef<Set<string>>(new Set());

    const setErrorMessage = useCallback((errorMessage: string | null) => {
        setSources((current) => (current.errorMessage === errorMessage ? current : { ...current, errorMessage }));
    }, []);

    const loadLogs = useCallback(async () => {
        setSources((current) => ({ ...current, isLoading: true, errorMessage: null, dataSourceNotice: null }));
        setLookupUserChangeLogs([]);
        requestedUndoSourceIdsRef.current.clear();
        const notices: string[] = [];
        const hardFailures: string[] = [];

        const [adminResult, userResult] = await Promise.allSettled([
            adminListAuditLogs({ limit: AUDIT_SOURCE_MAX_ROWS }),
            adminListUserChangeLogs({ limit: AUDIT_SOURCE_MAX_ROWS }),
        ]);

        let logs: AdminAuditRecord[];
        if (adminResult.status === 'fulfilled') {
            logs = adminResult.value;
            writeAdminCache(AUDIT_CACHE_KEY, logs);
        } else {
            logs = readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []);
            if (logs.length > 0) notices.push(cachedRowsNotice('admin audit logs', logs.length));
            else hardFailures.push(toAuditErrorMessage(adminResult.reason, 'Could not load admin audit logs.'));
        }

        let userChangeLogs: AdminUserChangeRecord[];
        if (userResult.status === 'fulfilled') {
            userChangeLogs = userResult.value;
            writeAdminCache(USER_CHANGE_CACHE_KEY, userChangeLogs);
        } else {
            userChangeLogs = readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, []);
            if (userChangeLogs.length > 0) notices.push(cachedRowsNotice('user change logs', userChangeLogs.length));
            else hardFailures.push(toAuditErrorMessage(userResult.reason, 'Could not load user change logs.'));
        }

        setSources({
            logs,
            userChangeLogs,
            isLoading: false,
            errorMessage: hardFailures.length > 0 ? Array.from(new Set(hardFailures)).join(' ') : null,
            dataSourceNotice: notices.length > 0 ? notices.join(' ') : null,
        });
    }, []);

    useEffect(() => {
        void loadLogs();
    }, [loadLogs]);

    const timelineEntries = useMemo(
        () => mergeAuditTimeline(sources.logs, sources.userChangeLogs, lookupUserChangeLogs),
        [lookupUserChangeLogs, sources.logs, sources.userChangeLogs],
    );
    const timelineIndex = useMemo(() => indexAuditTimeline(timelineEntries), [timelineEntries]);

    // An undo row's diff comes from the event it reverted. When that event is
    // older than the loaded window, fetch it once so the row can still explain itself.
    useEffect(() => {
        const missingSourceIds = findMissingUndoSourceIds(timelineEntries, timelineIndex, requestedUndoSourceIdsRef.current);
        if (missingSourceIds.length === 0) return;
        missingSourceIds.forEach((id) => requestedUndoSourceIdsRef.current.add(id));

        let active = true;
        void Promise.all(missingSourceIds.map(async (eventId) => {
            try {
                return await adminGetUserChangeLog(eventId);
            } catch {
                return null;
            }
        })).then((rows) => {
            if (!active) return;
            const nextRows = rows.filter((row): row is AdminUserChangeRecord => Boolean(row));
            if (nextRows.length === 0) return;
            setLookupUserChangeLogs((current) => {
                const byId = new Map(current.map((row) => [row.id, row]));
                nextRows.forEach((row) => byId.set(row.id, row));
                return Array.from(byId.values());
            });
        });
        return () => {
            active = false;
        };
    }, [timelineEntries, timelineIndex]);

    return {
        timelineEntries,
        timelineIndex,
        isLoading: sources.isLoading,
        errorMessage: sources.errorMessage,
        dataSourceNotice: sources.dataSourceNotice,
        setErrorMessage,
        loadLogs,
    };
};
