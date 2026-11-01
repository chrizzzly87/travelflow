import { useEffect, useState } from 'react';
import type { AdminAuditRecord } from '../../../services/adminService';
import { toAuditErrorMessage } from './useAdminAuditData';

interface LiveRecordResult<T> {
    log: AdminAuditRecord;
    record: T | null;
    error: string | null;
}

/**
 * Loads the live record behind an audit row while a sheet shows it. The result
 * is tagged with the log it was loaded for, so switching rows never shows the
 * previous record: anything not loaded for the current log reads as loading.
 */
// Pass a module-level `load` and `messages`: they are effect dependencies.
export const useAuditLiveRecord = <T>(
    log: AdminAuditRecord | null,
    load: (targetId: string) => Promise<T | null>,
    messages: { notFound: string; failed: string },
) => {
    const [result, setResult] = useState<LiveRecordResult<T> | null>(null);
    const targetId = log?.target_id || null;

    useEffect(() => {
        if (!log || !targetId) return;
        let active = true;
        void load(targetId)
            .then((record) => {
                if (active) setResult({ log, record, error: record ? null : messages.notFound });
            })
            .catch((error) => {
                if (active) setResult({ log, record: null, error: toAuditErrorMessage(error, messages.failed) });
            });
        return () => {
            active = false;
        };
    }, [load, log, messages.failed, messages.notFound, targetId]);

    const isCurrent = Boolean(log && result?.log === log);
    return {
        record: isCurrent ? result?.record ?? null : null,
        error: isCurrent ? result?.error ?? null : null,
        isLoading: Boolean(targetId) && !isCurrent,
        /** Replace the record or error after an action on it (e.g. a restore). */
        update: (patch: { record?: T | null; error?: string | null }) => {
            if (!log) return;
            setResult((current) => ({
                log,
                record: 'record' in patch ? patch.record ?? null : (current?.log === log ? current.record : null),
                error: 'error' in patch ? patch.error ?? null : (current?.log === log ? current.error : null),
            }));
        },
    };
};
