import React from 'react';
import { CopySimple, DownloadSimple, Warning } from '@phosphor-icons/react';
import { AdminDetailSheet } from '../AdminDetailSheet';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { CopyableUuid } from '../CopyableUuid';
import { Alert, AlertDescription } from '../../ui/alert';
import { Button } from '../../ui/button';
import { getAnalyticsDebugAttributes } from '../../../services/analyticsService';
import { buildDiffEntryRenderKey, buildSecondaryFacetRenderKey } from '../../../services/adminUserChangeLog';
import { formatAuditRelativeTime, getUndoActionLabel, type AuditTimelineEntry } from './adminAuditModel';
import {
    formatAuditActorName,
    formatAuditValue,
    formatFieldLabel,
    getTargetPillClass,
    type AuditEntryDetails,
} from './adminAuditPresentation';
import { AuditDetailRow, AuditPill } from './AuditDetailParts';
import type { AuditRowHandlers } from './AuditTimelineTable';
import type { AdminAuditActionsApi } from './useAdminAuditActions';

const UNDO_BUTTON_CLASS = 'border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-400/30 dark:text-amber-200 dark:hover:bg-amber-400/12 dark:hover:text-amber-100';

const EntrySheetFooter: React.FC<{
    entry: AuditTimelineEntry;
    details: AuditEntryDetails;
    actions: AdminAuditActionsApi;
}> = ({ entry, details, actions }) => {
    const isUndoing = actions.revertingEntryKey === details.entryKey;
    return (
        <>
            {details.canShowFullDiff && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => actions.showFullDiff(entry)}
                    {...getAnalyticsDebugAttributes('admin__audit--show_diff')}
                >
                    Show full diff
                </Button>
            )}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => actions.exportEntry(entry)}
                disabled={actions.isExportingReplay}
                aria-busy={actions.isExportingReplay || undefined}
                {...getAnalyticsDebugAttributes('admin__audit--export_entry')}
            >
                <DownloadSimple />
                Export entry
            </Button>
            {details.canUndo && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => actions.requestUndo(entry)}
                    disabled={Boolean(actions.revertingEntryKey)}
                    aria-busy={isUndoing || undefined}
                    className={`ms-auto ${UNDO_BUTTON_CLASS}`}
                    {...getAnalyticsDebugAttributes('admin__audit--undo')}
                >
                    {isUndoing ? 'Undoing…' : getUndoActionLabel(entry)}
                </Button>
            )}
        </>
    );
};

const EntryEventSection: React.FC<{
    details: AuditEntryDetails;
    actions: AdminAuditActionsApi;
    handlers: AuditRowHandlers;
}> = ({ details, actions, handlers }) => {
    const { log, actorUserId, actorEmail } = details;
    return (
        <section className="flex flex-col gap-2">
            <AdminSectionHeader as="h3" title="Event" />
            <dl className="divide-y divide-border">
                <AuditDetailRow label="When">
                    <span className="tabular-nums">{formatAuditValue(log.created_at)}</span>
                    <span className="text-muted-foreground"> · {formatAuditRelativeTime(log.created_at)}</span>
                </AuditDetailRow>
                <AuditDetailRow label="Actor">
                    {actorUserId ? (
                        <div className="flex flex-col gap-0.5">
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto w-fit p-0 text-sm"
                                onClick={() => handlers.openActor(actorUserId, details)}
                            >
                                {actorEmail || 'Unknown actor'}
                            </Button>
                            <CopyableUuid value={actorUserId} textClassName="break-all text-xs" />
                        </div>
                    ) : (
                        <span>{formatAuditActorName(actorEmail)}</span>
                    )}
                </AuditDetailRow>
                <AuditDetailRow label="Action code">
                    <span className="inline-flex max-w-full items-center gap-1">
                        <code className="truncate font-mono text-xs">{log.action}</code>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void actions.copyActionCode(log.action)}
                            aria-label="Copy action code"
                            data-tooltip="Copy action code"
                        >
                            <CopySimple />
                        </Button>
                    </span>
                </AuditDetailRow>
                <AuditDetailRow label="Target">
                    <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1">
                            {details.targetLabel}
                            {details.targetCanOpenDrawer && (
                                <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-sm"
                                    onClick={() => handlers.openTarget(details)}
                                >
                                    Open details
                                </Button>
                            )}
                        </span>
                        {log.target_id && <CopyableUuid value={log.target_id} textClassName="break-all text-xs" />}
                    </div>
                </AuditDetailRow>
                <AuditDetailRow label="Event id">
                    <CopyableUuid value={log.id} textClassName="break-all text-xs" />
                </AuditDetailRow>
                {details.secondaryFacets.length > 0 && (
                    <AuditDetailRow label="Also changed">
                        <span className="flex flex-wrap gap-1">
                            {details.secondaryFacets.map((facet, facetIndex) => (
                                <AuditPill
                                    key={`sheet-${buildSecondaryFacetRenderKey(facet, facetIndex)}`}
                                    className={facet.className}
                                    size="xs"
                                    tooltip={facet.code}
                                >
                                    {facet.label}
                                </AuditPill>
                            ))}
                        </span>
                    </AuditDetailRow>
                )}
            </dl>
        </section>
    );
};

const EntryChangesSection: React.FC<{ details: AuditEntryDetails }> = ({ details }) => {
    const { diffEntries, ownedTripsBeforeDelete } = details;
    return (
        <section className="flex flex-col gap-2">
            <AdminSectionHeader
                as="h3"
                title="Changes"
                description={diffEntries.length > 0
                    ? `${diffEntries.length} changed field${diffEntries.length === 1 ? '' : 's'}`
                    : 'No field changes were recorded for this event.'}
            />
            {ownedTripsBeforeDelete !== null && (
                <Alert variant="destructive">
                    <Warning weight="fill" />
                    <AlertDescription>
                        <p>
                            {ownedTripsBeforeDelete} owned trip{ownedTripsBeforeDelete === 1 ? ' was' : 's were'} deleted with this account.
                        </p>
                    </AlertDescription>
                </Alert>
            )}
            {diffEntries.map((entry, entryIndex) => (
                <article key={`sheet-${buildDiffEntryRenderKey(entry, entryIndex)}`} className="rounded-md border border-border px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">{formatFieldLabel(entry.key)}</p>
                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        <div className="min-w-0 rounded-sm border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/12 dark:text-rose-200">
                            <span className="font-medium">Before: </span>
                            <span className="break-all">{details.formatValue(entry, entry.beforeValue)}</span>
                        </div>
                        <div className="min-w-0 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-200">
                            <span className="font-medium">After: </span>
                            <span className="break-all">{details.formatValue(entry, entry.afterValue)}</span>
                        </div>
                    </div>
                </article>
            ))}
        </section>
    );
};

/** One audit entry in depth: event facts, every changed field, export and undo. */
export const AuditEntrySheet: React.FC<{
    entry: AuditTimelineEntry | null;
    details: AuditEntryDetails | null;
    onClose: () => void;
    actions: AdminAuditActionsApi;
    handlers: AuditRowHandlers;
}> = ({ entry, details, onClose, actions, handlers }) => (
    <AdminDetailSheet
        open={Boolean(entry && details)}
        onOpenChange={(open) => {
            if (!open) onClose();
        }}
        title={details?.actionPresentation.label ?? 'Audit entry'}
        subtitle={details ? formatAuditValue(details.log.created_at) : undefined}
        meta={details && (
            <>
                <AdminStatusBadge tone="neutral" dot={false}>{details.originLabel}</AdminStatusBadge>
                <AuditPill className={getTargetPillClass(details.log.target_type)}>{details.targetLabel}</AuditPill>
            </>
        )}
        footer={entry && details && <EntrySheetFooter entry={entry} details={details} actions={actions} />}
    >
        {entry && details && (
            <>
                <EntryEventSection details={details} actions={actions} handlers={handlers} />
                <EntryChangesSection details={details} />
            </>
        )}
    </AdminDetailSheet>
);
