import React, { useRef } from 'react';
import { ArrowSquareOut, DotsThreeVertical, SpinnerGap } from '@phosphor-icons/react';
import { AdminSortHeaderButton } from '../AdminDataTable';
import {
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    ADMIN_TABLE_SORTED_HEADER_CLASS,
} from '../AdminDataTableUtils';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminPagination } from '../AdminPagination';
import { AdminSurfaceCard } from '../AdminSurfaceCard';
import { CopyableUuid } from '../CopyableUuid';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { cn } from '../../../lib/utils';
import { getAnalyticsDebugAttributes } from '../../../services/analyticsService';
import { buildDiffEntryRenderKey, buildSecondaryFacetRenderKey } from '../../../services/adminUserChangeLog';
import {
    AUDIT_COLUMN_LABELS,
    AUDIT_DIFF_SUMMARY_LIMIT,
    AUDIT_PAGE_SIZE,
    AUDIT_SORT_COLUMNS,
    RESIZABLE_AUDIT_COLUMN_IDS,
    formatAuditRelativeTime,
    getUndoActionLabel,
    type AuditResizableColumnId,
    type AuditSortColumn,
    type AuditTimelineEntry,
    type AuditTimelineIndex,
} from './adminAuditModel';
import {
    describeAuditEntry,
    formatAuditActorName,
    formatAuditDiffLine,
    formatAuditValue,
    getTargetPillClass,
    type AuditEntryDetails,
} from './adminAuditPresentation';
import { AuditPill } from './AuditDetailParts';
import type { AdminAuditStateApi } from './useAdminAuditState';
import type { AdminAuditActionsApi } from './useAdminAuditActions';

/** Row-level navigation the page wires to the panels. */
export interface AuditRowHandlers {
    openEntry: (entryKey: string) => void;
    openActor: (actorUserId: string, details: AuditEntryDetails) => void;
    openTarget: (details: AuditEntryDetails) => void;
}

const isSortColumn = (columnId: AuditResizableColumnId): columnId is AuditSortColumn => (
    AUDIT_SORT_COLUMNS.includes(columnId as AuditSortColumn)
);

// Cells wrap and align to the top: rows carry two-line summaries and facet pills.
const CELL_CLASS = 'whitespace-normal align-top';

const AuditColumnResizeHandle: React.FC<{
    columnId: AuditResizableColumnId;
    onResizeStart: (columnId: AuditResizableColumnId, clientX: number) => void;
}> = ({ columnId, onResizeStart }) => (
    // Mouse-only affordance: the column picker and Reset cover keyboard users.
    <span
        aria-hidden="true"
        onMouseDown={(event) => {
            event.preventDefault();
            onResizeStart(columnId, event.clientX);
        }}
        data-tooltip={`Drag to resize ${AUDIT_COLUMN_LABELS[columnId].toLowerCase()}`}
        className="absolute inset-y-0 end-0 w-2 cursor-col-resize transition-colors hover:bg-border"
    />
);

const AuditRowActionsMenu: React.FC<{
    entry: AuditTimelineEntry;
    details: AuditEntryDetails;
    handlers: AuditRowHandlers;
    actions: AdminAuditActionsApi;
}> = ({ entry, details, handlers, actions }) => {
    const { actionPresentation, actorUserId, entryKey } = details;
    const isUndoing = actions.revertingEntryKey === entryKey;
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${actionPresentation.label} entry`}
                    aria-busy={isUndoing || undefined}
                    data-tooltip="Entry actions"
                >
                    {isUndoing ? <SpinnerGap className="animate-spin" /> : <DotsThreeVertical weight="bold" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem onSelect={() => handlers.openEntry(entryKey)}>View details</DropdownMenuItem>
                {details.canShowFullDiff && (
                    <DropdownMenuItem onSelect={() => actions.showFullDiff(entry)}>Show full diff</DropdownMenuItem>
                )}
                {details.targetCanOpenDrawer && (
                    <DropdownMenuItem onSelect={() => handlers.openTarget(details)}>
                        Open {details.targetLabel.toLowerCase()}
                    </DropdownMenuItem>
                )}
                {actorUserId && (
                    <DropdownMenuItem onSelect={() => handlers.openActor(actorUserId, details)}>Open actor</DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => void actions.copyActionCode(details.log.action)}>
                    Copy action code
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.exportEntry(entry)} disabled={actions.isExportingReplay}>
                    Export entry
                </DropdownMenuItem>
                {details.canUndo && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() => actions.requestUndo(entry)}
                            disabled={Boolean(actions.revertingEntryKey)}
                        >
                            {getUndoActionLabel(entry)}…
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const AuditTimelineRow: React.FC<{
    entry: AuditTimelineEntry;
    details: AuditEntryDetails;
    isSelected: boolean;
    isColumnVisible: (columnId: string) => boolean;
    sortedCellClass: (columnId: AuditResizableColumnId) => string;
    onToggle: (entryKey: string) => void;
    handlers: AuditRowHandlers;
    actions: AdminAuditActionsApi;
}> = ({ entry, details, isSelected, isColumnVisible, sortedCellClass, onToggle, handlers, actions }) => {
    const { log, diffEntries, actionPresentation, actorEmail, actorUserId, entryKey } = details;
    const summaryEntries = diffEntries.slice(0, AUDIT_DIFF_SUMMARY_LIMIT);
    const hiddenDiffCount = Math.max(diffEntries.length - summaryEntries.length, 0);

    return (
        <TableRow data-state={isSelected ? 'selected' : undefined} className={ADMIN_TABLE_ROW_SURFACE_CLASS}>
            <TableCell className={cn(CELL_CLASS, 'py-2.5 ps-3 pe-1')}>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(entryKey)}
                    aria-label={`Select ${actionPresentation.label} entry`}
                />
            </TableCell>
            {isColumnVisible('when') && (
                <TableCell className={cn(CELL_CLASS, 'px-3 py-2.5 text-xs text-muted-foreground', sortedCellClass('when'))}>
                    <time dateTime={log.created_at} data-tooltip={formatAuditValue(log.created_at)} className="tabular-nums">
                        {formatAuditRelativeTime(log.created_at)}
                    </time>
                </TableCell>
            )}
            {isColumnVisible('actor') && (
                <TableCell className={cn(CELL_CLASS, 'max-w-0 px-3 py-2.5', sortedCellClass('actor'))}>
                    {actorUserId ? (
                        <Button
                            type="button"
                            variant="link"
                            onClick={() => handlers.openActor(actorUserId, details)}
                            className="block h-auto max-w-full truncate p-0 text-start text-sm font-medium text-foreground"
                            data-tooltip="Open actor details"
                            {...getAnalyticsDebugAttributes('admin__audit--open_actor')}
                        >
                            {actorEmail || 'Unknown actor'}
                        </Button>
                    ) : (
                        <span className="block truncate text-sm text-muted-foreground">{formatAuditActorName(actorEmail)}</span>
                    )}
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{details.originLabel}</span>
                </TableCell>
            )}
            {isColumnVisible('action') && (
                <TableCell className={cn(CELL_CLASS, 'px-3 py-2.5', sortedCellClass('action'))}>
                    <AuditPill className={actionPresentation.className} tooltip={log.action} truncate>
                        {actionPresentation.label}
                    </AuditPill>
                    {details.secondaryFacets.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                            {details.secondaryFacets.map((facet, facetIndex) => (
                                <AuditPill
                                    key={`${entryKey}-${buildSecondaryFacetRenderKey(facet, facetIndex)}`}
                                    className={facet.className}
                                    size="xs"
                                    tooltip={facet.code}
                                >
                                    {facet.label}
                                </AuditPill>
                            ))}
                        </div>
                    )}
                </TableCell>
            )}
            {isColumnVisible('target') && (
                <TableCell className={cn(CELL_CLASS, 'px-3 py-2.5', sortedCellClass('target'))}>
                    <div className="flex items-center gap-1">
                        <AuditPill className={getTargetPillClass(log.target_type)} tooltip={`Target type: ${log.target_type}`}>
                            {details.targetLabel}
                        </AuditPill>
                        {details.targetCanOpenDrawer && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handlers.openTarget(details)}
                                aria-label={`Open ${details.targetLabel.toLowerCase()} details`}
                                data-tooltip={`Open ${details.targetLabel.toLowerCase()} details`}
                                {...getAnalyticsDebugAttributes('admin__audit--open_target')}
                            >
                                <ArrowSquareOut className="rtl:-scale-x-100" />
                            </Button>
                        )}
                    </div>
                    <div className="mt-1 min-w-0 text-[11px] text-muted-foreground">
                        {log.target_id
                            ? <CopyableUuid value={log.target_id} textClassName="max-w-[140px] truncate text-[11px]" hintClassName="text-[9px]" />
                            : <span>No target id</span>}
                    </div>
                </TableCell>
            )}
            {isColumnVisible('diff') && (
                <TableCell className={cn(CELL_CLASS, 'px-2 py-1.5')}>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handlers.openEntry(entryKey)}
                        className="h-auto w-full flex-col items-stretch gap-0.5 whitespace-normal px-2 py-1 text-start text-xs font-normal"
                        aria-label={`Open details for ${actionPresentation.label}`}
                        {...getAnalyticsDebugAttributes('admin__audit--open_entry')}
                    >
                        {summaryEntries.length > 0 ? (
                            summaryEntries.map((diffEntry, diffIndex) => (
                                <span key={`${entryKey}-${buildDiffEntryRenderKey(diffEntry, diffIndex)}`} className="block truncate text-foreground">
                                    {formatAuditDiffLine(details, diffEntry)}
                                </span>
                            ))
                        ) : (
                            <span className="block text-muted-foreground">No field changes recorded</span>
                        )}
                        {hiddenDiffCount > 0 && (
                            <span className="block text-muted-foreground tabular-nums">
                                +{hiddenDiffCount} more field{hiddenDiffCount === 1 ? '' : 's'}
                            </span>
                        )}
                        {details.ownedTripsBeforeDelete !== null && (
                            <span className="block font-medium text-red-700 dark:text-red-300 tabular-nums">
                                {details.ownedTripsBeforeDelete} owned trip{details.ownedTripsBeforeDelete === 1 ? '' : 's'} deleted
                            </span>
                        )}
                    </Button>
                </TableCell>
            )}
            {isColumnVisible('rowActions') && (
                <TableCell className={cn(CELL_CLASS, 'px-2 py-2 text-end')}>
                    <AuditRowActionsMenu entry={entry} details={details} handlers={handlers} actions={actions} />
                </TableCell>
            )}
        </TableRow>
    );
};

/** The audit timeline on the shared admin table: sortable, resizable, selectable. */
export const AuditTimelineTable: React.FC<{
    audit: AdminAuditStateApi;
    actions: AdminAuditActionsApi;
    timelineIndex: AuditTimelineIndex;
    isLoading: boolean;
    handlers: AuditRowHandlers;
}> = ({ audit, actions, timelineIndex, isLoading, handlers }) => {
    const { state, actions: stateActions } = audit;
    const resizeStartRef = useRef<{ columnId: AuditResizableColumnId; startX: number; startWidth: number } | null>(null);
    const visibleColumnSet = new Set<string>(state.visibleColumns);
    const isColumnVisible = (columnId: string) => visibleColumnSet.has(columnId);
    const tableColumnCount = 1 + state.visibleColumns.length;
    const isSorted = (columnId: AuditResizableColumnId) => state.sort.column === columnId;
    const sortedCellClass = (columnId: AuditResizableColumnId) => (isSorted(columnId) ? ADMIN_TABLE_SORTED_CELL_CLASS : '');

    const beginColumnResize = (columnId: AuditResizableColumnId, clientX: number) => {
        resizeStartRef.current = { columnId, startX: clientX, startWidth: state.columnWidths[columnId] };
        const onPointerMove = (event: MouseEvent) => {
            const start = resizeStartRef.current;
            if (!start) return;
            stateActions.setColumnWidth(start.columnId, start.startWidth + event.clientX - start.startX);
        };
        const onPointerUp = () => {
            resizeStartRef.current = null;
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('mouseup', onPointerUp);
        };
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
    };

    return (
        <AdminSurfaceCard className="flex flex-col gap-3 p-0">
            <Table className="min-w-full table-fixed border-collapse text-start">
                <colgroup>
                    <col style={{ width: 40 }} />
                    {RESIZABLE_AUDIT_COLUMN_IDS.map((columnId) => (
                        isColumnVisible(columnId) && <col key={columnId} style={{ width: `${state.columnWidths[columnId]}px` }} />
                    ))}
                    {isColumnVisible('rowActions') && <col style={{ width: 48 }} />}
                </colgroup>
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="ps-3 pe-1">
                            <Checkbox
                                checked={audit.pageSelectionState}
                                onCheckedChange={(checked) => stateActions.setPageSelected(Boolean(checked))}
                                aria-label="Select all rows on this page"
                                disabled={audit.pagedEntries.length === 0}
                            />
                        </TableHead>
                        {RESIZABLE_AUDIT_COLUMN_IDS.map((columnId) => {
                            if (!isColumnVisible(columnId)) return null;
                            const sortable = isSortColumn(columnId);
                            const active = sortable && isSorted(columnId);
                            return (
                                <TableHead
                                    key={columnId}
                                    aria-sort={active ? (state.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                                    className={cn('relative px-3', active && ADMIN_TABLE_SORTED_HEADER_CLASS)}
                                >
                                    {sortable ? (
                                        <AdminSortHeaderButton
                                            label={AUDIT_COLUMN_LABELS[columnId]}
                                            isActive={active}
                                            direction={state.sort.direction}
                                            onClick={() => stateActions.toggleSort(columnId)}
                                            className="pe-2"
                                        />
                                    ) : AUDIT_COLUMN_LABELS[columnId]}
                                    <AuditColumnResizeHandle columnId={columnId} onResizeStart={beginColumnResize} />
                                </TableHead>
                            );
                        })}
                        {isColumnVisible('rowActions') && (
                            <TableHead className="text-end">
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {audit.pagedEntries.map((entry) => {
                        const details = describeAuditEntry(entry, timelineIndex);
                        return (
                            <AuditTimelineRow
                                key={details.entryKey}
                                entry={entry}
                                details={details}
                                isSelected={audit.selectedKeySet.has(details.entryKey)}
                                isColumnVisible={isColumnVisible}
                                sortedCellClass={sortedCellClass}
                                onToggle={stateActions.toggleRow}
                                handlers={handlers}
                                actions={actions}
                            />
                        );
                    })}
                    {audit.visibleEntries.length === 0 && !isLoading && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell className="p-4 whitespace-normal" colSpan={tableColumnCount}>
                                <AdminEmptyState
                                    title="No audit entries match these filters."
                                    description="Widen the time range or reset the filters to see more entries."
                                />
                            </TableCell>
                        </TableRow>
                    )}
                    {isLoading && (
                        <TableRow className="hover:bg-transparent">
                            <TableCell className="px-3 py-6 text-sm text-muted-foreground" colSpan={tableColumnCount}>
                                <span className="inline-flex items-center gap-2" role="status">
                                    <SpinnerGap size={14} className="animate-spin" />
                                    Loading change logs…
                                </span>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <AdminPagination
                page={Math.floor(audit.offset / AUDIT_PAGE_SIZE) + 1}
                pageSize={AUDIT_PAGE_SIZE}
                totalItems={audit.visibleEntries.length}
                onPageChange={(page) => stateActions.setOffset((page - 1) * AUDIT_PAGE_SIZE)}
                noun="entries"
                className="px-4 pb-3"
            />
        </AdminSurfaceCard>
    );
};
