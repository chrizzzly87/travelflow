import { useEffect, useMemo, useReducer } from 'react';
import { useSearchParams } from '@/app/navigation';
import type { AdminAuditRecord } from '../../../services/adminService';
import {
    AUDIT_PAGE_SIZE,
    buildActionFilterOptions,
    buildActorFilterOptions,
    buildAuditSearchParams,
    buildTargetFilterOptions,
    clampAuditOffset,
    filterAuditTimeline,
    getAuditPageSelectionState,
    getDefaultCustomRange,
    getTimelineEntryKey,
    hasActiveAuditFilters,
    isIsoDateInAuditRange,
    sortAuditTimeline,
    type AuditResizableColumnId,
    type AuditSortColumn,
    type AuditTimePreset,
    type AuditTimelineEntry,
} from './adminAuditModel';
import {
    adminAuditReducer,
    createInitialAdminAuditState,
} from './adminAuditState';

/**
 * Filter, sort, paging, selection and panel state for the Audit log screen.
 * Everything that follows from it (visible rows, page, filter options) is
 * derived on render; the only effect mirrors the state into the URL.
 */
export const useAdminAuditState = (timelineEntries: AuditTimelineEntry[]) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [state, dispatch] = useReducer(
        adminAuditReducer,
        searchParams,
        (params) => createInitialAdminAuditState(params, getDefaultCustomRange()),
    );

    const filters = useMemo(() => ({
        search: state.search,
        timePreset: state.timePreset,
        customStartDate: state.customStartDate,
        customEndDate: state.customEndDate,
        actionFilters: state.actionFilters,
        targetFilters: state.targetFilters,
        actorFilters: state.actorFilters,
    }), [
        state.actionFilters,
        state.actorFilters,
        state.customEndDate,
        state.customStartDate,
        state.search,
        state.targetFilters,
        state.timePreset,
    ]);

    const visibleEntries = useMemo(
        () => sortAuditTimeline(filterAuditTimeline(timelineEntries, filters), state.sort),
        [filters, state.sort, timelineEntries],
    );
    const entriesInTimeRange = useMemo(
        () => timelineEntries.filter((entry) => isIsoDateInAuditRange(
            entry.log.created_at,
            filters.timePreset,
            filters.customStartDate,
            filters.customEndDate,
        )),
        [filters.customEndDate, filters.customStartDate, filters.timePreset, timelineEntries],
    );
    const actionFilterOptions = useMemo(() => buildActionFilterOptions(entriesInTimeRange), [entriesInTimeRange]);
    const targetFilterOptions = useMemo(() => buildTargetFilterOptions(entriesInTimeRange), [entriesInTimeRange]);
    const actorFilterOptions = useMemo(() => buildActorFilterOptions(entriesInTimeRange), [entriesInTimeRange]);

    const offset = clampAuditOffset(state.offset, visibleEntries.length);
    const pagedEntries = useMemo(
        () => visibleEntries.slice(offset, offset + AUDIT_PAGE_SIZE),
        [offset, visibleEntries],
    );

    // Selection only counts rows the filters still show, so a narrowed filter can
    // never export rows the admin can no longer see.
    const visibleKeySet = useMemo(
        () => new Set(visibleEntries.map((entry) => getTimelineEntryKey(entry))),
        [visibleEntries],
    );
    const selectedEntryKeys = useMemo(
        () => state.selectedEntryKeys.filter((key) => visibleKeySet.has(key)),
        [state.selectedEntryKeys, visibleKeySet],
    );
    const selectedKeySet = useMemo(() => new Set(selectedEntryKeys), [selectedEntryKeys]);
    const pageEntryKeys = useMemo(() => pagedEntries.map((entry) => getTimelineEntryKey(entry)), [pagedEntries]);
    const pageSelectionState = getAuditPageSelectionState(pageEntryKeys, selectedKeySet);

    const { panel } = state;
    const selectedEntry = panel.kind === 'entry'
        ? timelineEntries.find((entry) => getTimelineEntryKey(entry) === panel.entryKey) ?? null
        : null;

    // The URL is an external store owned by the router: mirror state into it.
    useEffect(() => {
        const next = buildAuditSearchParams({ ...filters, visibleColumns: state.visibleColumns, sort: state.sort, offset });
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [filters, offset, searchParams, setSearchParams, state.sort, state.visibleColumns]);

    const actions = useMemo(() => ({
        setSearch: (value: string) => dispatch({ type: 'setSearch', value }),
        setTimePreset: (value: AuditTimePreset) => dispatch({ type: 'setTimePreset', value, defaultRange: getDefaultCustomRange() }),
        setCustomRange: (startDate: string, endDate: string) => dispatch({ type: 'setCustomRange', startDate, endDate }),
        setCustomRangeDialogOpen: (open: boolean) => dispatch({ type: 'setCustomRangeDialogOpen', open }),
        setTargetFilters: (values: string[]) => dispatch({ type: 'setTargetFilters', values }),
        setActorFilters: (values: string[]) => dispatch({ type: 'setActorFilters', values }),
        setVisibleColumns: (values: string[]) => dispatch({ type: 'setVisibleColumns', values }),
        setColumnWidth: (columnId: AuditResizableColumnId, width: number) => dispatch({ type: 'setColumnWidth', columnId, width }),
        toggleSort: (column: AuditSortColumn) => dispatch({ type: 'toggleSort', column }),
        setOffset: (nextOffset: number) => dispatch({ type: 'setOffset', offset: nextOffset }),
        toggleRow: (entryKey: string) => dispatch({ type: 'toggleRow', entryKey }),
        clearSelection: () => dispatch({ type: 'clearSelection' }),
        resetFilters: () => dispatch({ type: 'resetFilters', defaultRange: getDefaultCustomRange() }),
        openEntry: (entryKey: string) => dispatch({ type: 'openEntry', entryKey }),
        openUser: (userId: string, sourceLog: AdminAuditRecord | null, actorEmail: string | null) => (
            dispatch({ type: 'openUser', userId, sourceLog, actorEmail, nowMs: Date.now() })
        ),
        openTarget: (log: AdminAuditRecord) => dispatch({ type: 'openTarget', log, nowMs: Date.now() }),
        closeEntry: () => dispatch({ type: 'closePanel', kind: 'entry' }),
        closeUser: () => dispatch({ type: 'closePanel', kind: 'user' }),
        closeTrip: () => dispatch({ type: 'closePanel', kind: 'trip' }),
    }), []);

    const setActionFilters = (values: string[]) => dispatch({
        type: 'setActionFilters',
        values,
        allValues: actionFilterOptions.map((option) => option.value),
    });
    const setPageSelected = (selected: boolean) => dispatch({ type: 'setPageSelected', entryKeys: pageEntryKeys, selected });

    return {
        state,
        filters,
        offset,
        visibleEntries,
        pagedEntries,
        selectedEntryKeys,
        selectedKeySet,
        pageSelectionState,
        selectedEntry,
        actionFilterOptions,
        targetFilterOptions,
        actorFilterOptions,
        hasActiveFilters: hasActiveAuditFilters(state),
        actions: { ...actions, setActionFilters, setPageSelected },
    };
};

export type AdminAuditStateApi = ReturnType<typeof useAdminAuditState>;
