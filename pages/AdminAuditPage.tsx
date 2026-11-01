import React from 'react';
import { DownloadSimple, SpinnerGap } from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminSelectionBar } from '../components/admin/AdminSelectionBar';
import { AdminJsonDiffModal } from '../components/admin/AdminJsonDiffModal';
import { Button } from '../components/ui/button';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import type { AdminAuditRecord } from '../services/adminService';
import {
    formatAuditRelativeTime,
    getActionFilterLabel,
    getActionGroupLabel,
    getTargetLabel,
    normalizeActionFilters,
} from '../components/admin/audit/adminAuditModel';
import { describeAuditEntry, type AuditEntryDetails } from '../components/admin/audit/adminAuditPresentation';
import { AuditFilterBar } from '../components/admin/audit/AuditFilterBar';
import { AuditTimelineTable, type AuditRowHandlers } from '../components/admin/audit/AuditTimelineTable';
import { AuditEntrySheet } from '../components/admin/audit/AuditEntrySheet';
import { AuditUserSheet } from '../components/admin/audit/AuditUserSheet';
import { AuditTripSheet } from '../components/admin/audit/AuditTripSheet';
import { AuditWarningAlert } from '../components/admin/audit/AuditDetailParts';
import { useAdminAuditData } from '../components/admin/audit/useAdminAuditData';
import { useAdminAuditState } from '../components/admin/audit/useAdminAuditState';
import { useAdminAuditActions } from '../components/admin/audit/useAdminAuditActions';

export const __ADMIN_AUDIT_TESTING__ = {
    getActionGroupLabel,
    getActionFilterLabel,
    getTargetLabel,
    normalizeActionFilters,
    formatAuditRelativeTime,
};

const ExportReplayContent: React.FC<{ isExporting: boolean }> = ({ isExporting }) => (
    <>
        {isExporting ? <SpinnerGap className="animate-spin" /> : <DownloadSimple />}
        Export replay
    </>
);

export const AdminAuditPage: React.FC = () => {
    const data = useAdminAuditData();
    const audit = useAdminAuditState(data.timelineEntries);
    const actions = useAdminAuditActions({
        filters: audit.filters,
        visibleCount: audit.visibleEntries.length,
        timelineIndex: data.timelineIndex,
        setErrorMessage: data.setErrorMessage,
        reload: data.loadLogs,
    });
    const { state, actions: stateActions } = audit;

    const openTarget = (log: AdminAuditRecord) => {
        data.setErrorMessage(null);
        stateActions.openTarget(log);
    };

    const handlers: AuditRowHandlers = {
        openEntry: (entryKey) => {
            trackEvent('admin__audit--open_entry');
            stateActions.openEntry(entryKey);
        },
        openActor: (actorUserId, details: AuditEntryDetails) => {
            trackEvent('admin__audit--open_actor');
            stateActions.openUser(actorUserId, details.log, details.actorEmail);
        },
        openTarget: (details: AuditEntryDetails) => {
            trackEvent('admin__audit--open_target', { target_type: details.log.target_type });
            openTarget(details.log);
        },
    };

    const selectedEntryDetails = audit.selectedEntry ? describeAuditEntry(audit.selectedEntry, data.timelineIndex) : null;
    const userSheetLog = state.panel.kind === 'user' ? state.panel.log : null;
    const tripSheetLog = state.panel.kind === 'trip' ? state.panel.log : null;
    const visibleCount = audit.visibleEntries.length;

    return (
        <AdminShell
            title="Audit log"
            description="Admin actions and user account and trip changes in one timeline, for incident replay and support tracing."
            searchValue={state.search}
            onSearchValueChange={stateActions.setSearch}
            showDateRange={false}
            actions={(
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={actions.exportFiltered}
                        disabled={data.isLoading || actions.isExportingReplay || visibleCount === 0}
                        aria-busy={actions.isExportingReplay || undefined}
                        data-tooltip="Download every entry that matches the filters as a replay bundle"
                        {...getAnalyticsDebugAttributes('admin__audit--export_replay')}
                    >
                        <ExportReplayContent isExporting={actions.isExportingReplay} />
                    </Button>
                    <AdminReloadButton onClick={() => void data.loadLogs()} isLoading={data.isLoading} label="Reload" />
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                {data.errorMessage && <AdminErrorAlert message={data.errorMessage} />}
                {data.dataSourceNotice && <AuditWarningAlert message={data.dataSourceNotice} />}

                <AuditFilterBar audit={audit} />

                <AuditTimelineTable
                    audit={audit}
                    actions={actions}
                    timelineIndex={data.timelineIndex}
                    isLoading={data.isLoading}
                    handlers={handlers}
                />

                <AdminSelectionBar
                    count={audit.selectedEntryKeys.length}
                    noun="entry"
                    pluralNoun="entries"
                    onClear={stateActions.clearSelection}
                >
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => actions.exportSelected(audit.selectedEntryKeys)}
                        disabled={actions.isExportingReplay}
                        aria-busy={actions.isExportingReplay || undefined}
                        {...getAnalyticsDebugAttributes('admin__audit--export_selected')}
                    >
                        <ExportReplayContent isExporting={actions.isExportingReplay} />
                    </Button>
                </AdminSelectionBar>
            </div>

            <AuditEntrySheet
                entry={audit.selectedEntry}
                details={selectedEntryDetails}
                onClose={stateActions.closeEntry}
                actions={actions}
                handlers={handlers}
            />

            <AdminJsonDiffModal
                isOpen={actions.fullDiff.isOpen}
                onClose={actions.closeFullDiff}
                title={actions.fullDiff.title}
                description={actions.fullDiff.description}
                beforeLabel={actions.fullDiff.beforeLabel}
                afterLabel={actions.fullDiff.afterLabel}
                beforeValue={actions.fullDiff.beforeValue}
                afterValue={actions.fullDiff.afterValue}
                isLoading={actions.fullDiff.isLoading}
                errorMessage={actions.fullDiff.errorMessage}
            />

            <AuditUserSheet
                log={userSheetLog}
                onClose={stateActions.closeUser}
                onRestored={data.loadLogs}
                clearPageError={() => data.setErrorMessage(null)}
            />

            <AuditTripSheet log={tripSheetLog} onClose={stateActions.closeTrip} onOpenOwner={openTarget} />
        </AdminShell>
    );
};
