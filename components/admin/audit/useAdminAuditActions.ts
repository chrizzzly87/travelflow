import { useState } from 'react';
import { adminExportAuditReplay, adminGetTripVersionSnapshots } from '../../../services/adminService';
import { downloadAdminForensicsReplayBundle } from '../../../services/adminForensicsService';
import { buildDecisionConfirmDialog } from '../../../services/appDialogPresets';
import { trackEvent } from '../../../services/analyticsService';
import { useAppDialog } from '../../AppDialogProvider';
import { showAppToast } from '../../ui/appToast';
import {
    AUDIT_SOURCE_MAX_ROWS,
    asRecord,
    asString,
    canUndoTimelineEntry,
    getAuditExportBlocker,
    getTargetLabel,
    getTimelineActionLabel,
    getTimelineActorEmail,
    getTimelineEntryKey,
    hasSnapshotData,
    mergeTripSnapshotWithViewSettings,
    toAuditRecord,
    toForensicsReplayFileName,
    type AuditFilterState,
    type AuditTimelineEntry,
    type AuditTimelineIndex,
} from './adminAuditModel';
import { executeAuditUndo } from './adminAuditUndo';
import { AuditUserFacingError, toAuditErrorMessage } from './useAdminAuditData';

export interface AuditFullDiffState {
    isOpen: boolean;
    isLoading: boolean;
    errorMessage: string | null;
    title: string;
    description?: string;
    beforeLabel: string;
    afterLabel: string;
    beforeValue: unknown;
    afterValue: unknown;
}

const CLOSED_DIFF: AuditFullDiffState = {
    isOpen: false,
    isLoading: false,
    errorMessage: null,
    title: 'Full change diff',
    description: undefined,
    beforeLabel: 'Before snapshot',
    afterLabel: 'After snapshot',
    beforeValue: {},
    afterValue: {},
};

const pluralize = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * The screen's side effects: replay export, undo, copy and the full diff modal.
 * Each keeps its own busy flag so the table and sheets can show it.
 */
export const useAdminAuditActions = (params: {
    filters: AuditFilterState;
    visibleCount: number;
    timelineIndex: AuditTimelineIndex;
    setErrorMessage: (message: string | null) => void;
    reload: () => Promise<void>;
}) => {
    const { filters, visibleCount, timelineIndex, setErrorMessage, reload } = params;
    const { confirm: confirmDialog } = useAppDialog();
    const [isExportingReplay, setIsExportingReplay] = useState(false);
    const [revertingEntryKey, setRevertingEntryKey] = useState<string | null>(null);
    const [fullDiff, setFullDiff] = useState<AuditFullDiffState>(CLOSED_DIFF);

    const exportReplayBundle = async (selectedEventIds: string[] = []) => {
        const blocker = getAuditExportBlocker(selectedEventIds.length, visibleCount);
        if (blocker) {
            setErrorMessage(blocker);
            return;
        }
        setIsExportingReplay(true);
        setErrorMessage(null);
        try {
            const isCustom = filters.timePreset === 'custom';
            const { bundle, exportAuditId } = await adminExportAuditReplay({
                search: filters.search.trim() || null,
                dateRange: filters.timePreset,
                customStartDate: isCustom ? filters.customStartDate : null,
                customEndDate: isCustom ? filters.customEndDate : null,
                actionFilters: filters.actionFilters,
                targetFilters: filters.targetFilters,
                actorFilters: filters.actorFilters,
                selectedEventIds: selectedEventIds.length > 0 ? selectedEventIds : null,
                sourceLimit: AUDIT_SOURCE_MAX_ROWS,
            });
            const downloaded = downloadAdminForensicsReplayBundle(bundle, toForensicsReplayFileName(bundle.generated_at));
            if (!downloaded) {
                throw new AuditUserFacingError('Replay export is only available in browser context.');
            }
            showAppToast({
                tone: 'success',
                title: 'Replay export ready',
                description:
                    `Exported ${pluralize(bundle.totals.event_count, 'event')} `
                    + `across ${pluralize(bundle.totals.correlation_count, 'trace')}`
                    + `${exportAuditId ? ` (audit id ${exportAuditId})` : ''}.`,
            });
        } catch (error) {
            setErrorMessage(toAuditErrorMessage(error, 'Could not export the replay bundle.'));
        } finally {
            setIsExportingReplay(false);
        }
    };

    const exportFiltered = () => {
        trackEvent('admin__audit--export_replay', { count: visibleCount });
        void exportReplayBundle();
    };

    const exportSelected = (selectedEntryKeys: string[]) => {
        if (selectedEntryKeys.length === 0) {
            setErrorMessage('Select at least one row to export.');
            return;
        }
        trackEvent('admin__audit--export_selected', { count: selectedEntryKeys.length });
        void exportReplayBundle(selectedEntryKeys);
    };

    const exportEntry = (entry: AuditTimelineEntry) => {
        trackEvent('admin__audit--export_entry');
        void exportReplayBundle([getTimelineEntryKey(entry)]);
    };

    const undoEntry = async (entry: AuditTimelineEntry) => {
        if (!canUndoTimelineEntry(entry)) return;
        const confirmed = await confirmDialog(buildDecisionConfirmDialog({
            title: 'Undo this change?',
            message: 'This creates a new admin action that reverts the selected row. Continue?',
            confirmLabel: 'Undo change',
        }));
        if (!confirmed) return;

        setRevertingEntryKey(getTimelineEntryKey(entry));
        setErrorMessage(null);
        try {
            await executeAuditUndo(entry, timelineIndex);
            showAppToast({
                tone: 'success',
                title: 'Undo completed',
                description: 'A new admin audit entry was written for this revert operation.',
            });
            await reload();
        } catch (error) {
            setErrorMessage(toAuditErrorMessage(error, 'Could not undo this change.'));
        } finally {
            setRevertingEntryKey(null);
        }
    };

    const requestUndo = (entry: AuditTimelineEntry) => {
        trackEvent('admin__audit--undo', { action: entry.log.action });
        void undoEntry(entry);
    };

    const copyActionCode = async (actionCode: string) => {
        trackEvent('admin__audit--copy_action_code');
        if (!actionCode.trim() || typeof navigator === 'undefined' || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(actionCode);
            showAppToast({ tone: 'success', title: 'Action code copied', description: actionCode });
        } catch {
            showAppToast({ tone: 'warning', title: 'Could not copy', description: 'Your browser blocked clipboard access.' });
        }
    };

    const openFullDiff = async (entry: AuditTimelineEntry) => {
        const log = toAuditRecord(entry);
        const metadata = asRecord(log.metadata);
        const actorEmail = getTimelineActorEmail(entry);
        const targetLabel = getTargetLabel(log.target_type);
        const versionId = asString(metadata.version_id);
        const needsTripSnapshots = log.target_type === 'trip' && Boolean(log.target_id) && Boolean(versionId);

        setFullDiff({
            isOpen: true,
            isLoading: needsTripSnapshots,
            errorMessage: null,
            title: `${getTimelineActionLabel(entry)} · ${targetLabel}`,
            description: [
                log.action,
                actorEmail ? `Actor: ${actorEmail}` : null,
                log.target_id ? `${targetLabel} id: ${log.target_id}` : null,
                versionId ? `Version: ${versionId}` : null,
            ].filter(Boolean).join(' · '),
            beforeLabel: 'Before snapshot',
            afterLabel: 'After snapshot',
            beforeValue: hasSnapshotData(log.before_data) ? asRecord(log.before_data) : {},
            afterValue: hasSnapshotData(log.after_data) ? asRecord(log.after_data) : {},
        });
        if (!needsTripSnapshots || !log.target_id || !versionId) return;

        try {
            const versionSnapshots = await adminGetTripVersionSnapshots({
                tripId: log.target_id,
                afterVersionId: versionId,
                beforeVersionId: asString(metadata.previous_version_id),
            });
            setFullDiff((current) => (versionSnapshots
                ? {
                    ...current,
                    isLoading: false,
                    beforeValue: mergeTripSnapshotWithViewSettings(versionSnapshots.before_snapshot, versionSnapshots.before_view_settings),
                    afterValue: mergeTripSnapshotWithViewSettings(versionSnapshots.after_snapshot, versionSnapshots.after_view_settings),
                    beforeLabel: versionSnapshots.before_label || 'Before version',
                    afterLabel: versionSnapshots.after_label || 'After version',
                }
                : {
                    ...current,
                    isLoading: false,
                    errorMessage: 'Trip snapshots were not found for this event. Showing event snapshots when available.',
                }));
        } catch (error) {
            setFullDiff((current) => ({
                ...current,
                isLoading: false,
                errorMessage: toAuditErrorMessage(error, 'Could not load trip snapshots. Showing event snapshots when available.'),
            }));
        }
    };

    const showFullDiff = (entry: AuditTimelineEntry) => {
        trackEvent('admin__audit--show_diff');
        void openFullDiff(entry);
    };

    const closeFullDiff = () => {
        setFullDiff((current) => ({ ...current, isOpen: false, isLoading: false, errorMessage: null }));
    };

    return {
        isExportingReplay,
        revertingEntryKey,
        fullDiff,
        exportFiltered,
        exportSelected,
        exportEntry,
        requestUndo,
        copyActionCode,
        showFullDiff,
        closeFullDiff,
    };
};

export type AdminAuditActionsApi = ReturnType<typeof useAdminAuditActions>;
