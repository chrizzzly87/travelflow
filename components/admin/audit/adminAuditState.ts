import type { AdminAuditRecord } from '../../../services/adminService';
import {
    AUDIT_COLUMN_WIDTH_DEFAULTS,
    AUDIT_COLUMN_WIDTH_MIN,
    DEFAULT_AUDIT_SORT,
    DEFAULT_AUDIT_TIME_PRESET,
    DEFAULT_VISIBLE_COLUMNS,
    buildUserSheetLog,
    canOpenTargetDrawer,
    normalizeActionFilters,
    parseAuditSort,
    parseAuditTimePreset,
    parseAuditVisibleColumns,
    parseNonNegativeOffset,
    parseQueryMultiValue,
    sanitizeActorFilters,
    sanitizeAuditVisibleColumns,
    toggleAuditSort,
    type AuditFilterState,
    type AuditResizableColumnId,
    type AuditSort,
    type AuditSortColumn,
    type AuditTimePreset,
    type AuditVisibleColumnId,
} from './adminAuditModel';

/**
 * At most one panel is open at a time: the entry sheet, the user sheet or the
 * trip sheet. Opening one closes the others, so the union states that directly.
 */
export type AuditPanel =
    | { kind: 'none' }
    | { kind: 'entry'; entryKey: string }
    | { kind: 'user'; log: AdminAuditRecord }
    | { kind: 'trip'; log: AdminAuditRecord };

export interface AdminAuditState extends AuditFilterState {
    visibleColumns: AuditVisibleColumnId[];
    columnWidths: Record<AuditResizableColumnId, number>;
    sort: AuditSort;
    /** As requested; the screen clamps it to the filtered row count when rendering. */
    offset: number;
    selectedEntryKeys: string[];
    panel: AuditPanel;
    isCustomRangeDialogOpen: boolean;
}

interface CustomRange {
    startDate: string;
    endDate: string;
}

export type AdminAuditAction =
    | { type: 'setSearch'; value: string }
    | { type: 'setTimePreset'; value: AuditTimePreset; defaultRange: CustomRange }
    | { type: 'setCustomRange'; startDate: string; endDate: string }
    | { type: 'setCustomRangeDialogOpen'; open: boolean }
    | { type: 'setActionFilters'; values: string[]; allValues: string[] }
    | { type: 'setTargetFilters'; values: string[] }
    | { type: 'setActorFilters'; values: string[] }
    | { type: 'setVisibleColumns'; values: string[] }
    | { type: 'setColumnWidth'; columnId: AuditResizableColumnId; width: number }
    | { type: 'toggleSort'; column: AuditSortColumn }
    | { type: 'setOffset'; offset: number }
    | { type: 'toggleRow'; entryKey: string }
    | { type: 'setPageSelected'; entryKeys: string[]; selected: boolean }
    | { type: 'clearSelection' }
    | { type: 'resetFilters'; defaultRange: CustomRange }
    | { type: 'openEntry'; entryKey: string }
    | { type: 'openUser'; userId: string; sourceLog?: AdminAuditRecord | null; actorEmail?: string | null; nowMs: number }
    | { type: 'openTarget'; log: AdminAuditRecord; nowMs: number }
    /** Closes `kind` only if it is still the open panel: a late close from a sheet being replaced is ignored. */
    | { type: 'closePanel'; kind: Exclude<AuditPanel['kind'], 'none'> };

export const createInitialAdminAuditState = (
    params: Pick<URLSearchParams, 'get'>,
    defaultRange: CustomRange,
): AdminAuditState => ({
    search: params.get('q') || '',
    timePreset: parseAuditTimePreset(params.get('range')),
    customStartDate: params.get('start') || defaultRange.startDate,
    customEndDate: params.get('end') || defaultRange.endDate,
    actionFilters: parseQueryMultiValue(params.get('action')),
    targetFilters: parseQueryMultiValue(params.get('target')),
    actorFilters: sanitizeActorFilters(parseQueryMultiValue(params.get('actor'))),
    visibleColumns: parseAuditVisibleColumns(params.get('cols')),
    columnWidths: { ...AUDIT_COLUMN_WIDTH_DEFAULTS },
    sort: params.get('sort') ? parseAuditSort(params.get('sort'), params.get('dir')) : DEFAULT_AUDIT_SORT,
    offset: parseNonNegativeOffset(params.get('offset')),
    selectedEntryKeys: [],
    panel: { kind: 'none' },
    isCustomRangeDialogOpen: false,
});

const openUserPanel = (
    state: AdminAuditState,
    userId: string,
    options: { sourceLog?: AdminAuditRecord | null; actorEmail?: string | null },
    nowMs: number,
): AdminAuditState => {
    const log = buildUserSheetLog(userId, options, nowMs);
    return log ? { ...state, panel: { kind: 'user', log } } : state;
};

export const adminAuditReducer = (state: AdminAuditState, action: AdminAuditAction): AdminAuditState => {
    switch (action.type) {
        case 'setSearch':
            return { ...state, search: action.value, offset: 0 };
        case 'setTimePreset':
            return {
                ...state,
                timePreset: action.value,
                ...(action.value === 'custom'
                    ? {}
                    : { customStartDate: action.defaultRange.startDate, customEndDate: action.defaultRange.endDate }),
                offset: 0,
            };
        case 'setCustomRange':
            return { ...state, customStartDate: action.startDate, customEndDate: action.endDate, offset: 0 };
        case 'setCustomRangeDialogOpen':
            return { ...state, isCustomRangeDialogOpen: action.open };
        case 'setActionFilters':
            return { ...state, actionFilters: normalizeActionFilters(action.values, action.allValues), offset: 0 };
        case 'setTargetFilters':
            return { ...state, targetFilters: action.values, offset: 0 };
        case 'setActorFilters':
            return { ...state, actorFilters: sanitizeActorFilters(action.values), offset: 0 };
        case 'setVisibleColumns':
            return { ...state, visibleColumns: sanitizeAuditVisibleColumns(action.values) };
        case 'setColumnWidth': {
            const width = Math.max(AUDIT_COLUMN_WIDTH_MIN[action.columnId], Math.round(action.width));
            if (state.columnWidths[action.columnId] === width) return state;
            return { ...state, columnWidths: { ...state.columnWidths, [action.columnId]: width } };
        }
        case 'toggleSort':
            return { ...state, sort: toggleAuditSort(state.sort, action.column), offset: 0 };
        case 'setOffset':
            return { ...state, offset: Math.max(0, Math.floor(action.offset)) };
        case 'toggleRow':
            return {
                ...state,
                selectedEntryKeys: state.selectedEntryKeys.includes(action.entryKey)
                    ? state.selectedEntryKeys.filter((key) => key !== action.entryKey)
                    : [...state.selectedEntryKeys, action.entryKey],
            };
        case 'setPageSelected': {
            const next = new Set(state.selectedEntryKeys);
            action.entryKeys.forEach((key) => (action.selected ? next.add(key) : next.delete(key)));
            return { ...state, selectedEntryKeys: Array.from(next) };
        }
        case 'clearSelection':
            return state.selectedEntryKeys.length === 0 ? state : { ...state, selectedEntryKeys: [] };
        case 'resetFilters':
            return {
                ...state,
                actionFilters: [],
                targetFilters: [],
                actorFilters: [],
                timePreset: DEFAULT_AUDIT_TIME_PRESET,
                customStartDate: action.defaultRange.startDate,
                customEndDate: action.defaultRange.endDate,
                visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
                selectedEntryKeys: [],
                columnWidths: { ...AUDIT_COLUMN_WIDTH_DEFAULTS },
                offset: 0,
            };
        case 'openEntry':
            return { ...state, panel: { kind: 'entry', entryKey: action.entryKey } };
        case 'openUser':
            return openUserPanel(state, action.userId, action, action.nowMs);
        case 'openTarget': {
            const { log } = action;
            if (!canOpenTargetDrawer(log) || !log.target_id) return state;
            if (log.target_type === 'user') {
                return openUserPanel(state, log.target_id, { sourceLog: log, actorEmail: log.actor_email }, action.nowMs);
            }
            return { ...state, panel: { kind: 'trip', log } };
        }
        case 'closePanel':
            return state.panel.kind === action.kind ? { ...state, panel: { kind: 'none' } } : state;
        default:
            return state;
    }
};
