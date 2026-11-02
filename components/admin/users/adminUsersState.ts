import type { AdminDateRange } from '../adminShellUtils';
import {
    EMPTY_USER_TABLE_FILTERS,
    USER_QUEUE_FILTERS,
    parseAdminUsersDateRange,
    parsePositivePage,
    parseUserSortDirection,
    parseUserSortKey,
    parseUserTableFilters,
    parseUserVisibleColumns,
    sanitizeUserVisibleColumns,
    toggleUserSort,
    type UserDetailTab,
    type UserQueueId,
    type UserSortDirection,
    type UserSortKey,
    type UserTableFilterKey,
    type UserTableFilters,
    type UserVisibleColumnId,
} from '../adminUsersModel';

/**
 * The user sheet: which account it shows, whether it is open, its tab and the
 * page of each of its lists. Closing clears the account.
 */
export interface AdminUsersDetailState {
    userId: string | null;
    open: boolean;
    tab: UserDetailTab;
    tripsPage: number;
    changeLogPage: number;
}

export interface AdminUsersState {
    search: string;
    dateRange: AdminDateRange;
    filters: UserTableFilters;
    isMoreFiltersOpen: boolean;
    visibleColumns: UserVisibleColumnId[];
    sortKey: UserSortKey;
    sortDirection: UserSortDirection;
    /** As requested; the screen clamps it to the filtered row count when rendering. */
    page: number;
    /** Selected ids. Only rows the filters still show, and that can be deleted, count. */
    selectedUserIds: string[];
    detail: AdminUsersDetailState;
    isCreateDialogOpen: boolean;
}

export type AdminUsersAction =
    | { type: 'setSearch'; value: string }
    | { type: 'setDateRange'; value: AdminDateRange }
    | { type: 'setFilter'; key: UserTableFilterKey; values: string[] }
    | { type: 'resetFilters' }
    | { type: 'applyQueue'; queueId: UserQueueId; wasApplied: boolean }
    | { type: 'openMoreFilters' }
    | { type: 'setVisibleColumns'; values: string[] }
    | { type: 'restoreVisibleColumns'; columns: UserVisibleColumnId[] }
    | { type: 'toggleSort'; key: UserSortKey }
    | { type: 'setPage'; page: number }
    | { type: 'setUserSelected'; userId: string; selected: boolean }
    | { type: 'setUsersSelected'; userIds: string[]; selected: boolean }
    | { type: 'replaceSelection'; userIds: string[] }
    | { type: 'clearSelection' }
    | { type: 'openUser'; userId: string }
    | { type: 'reopenDetail' }
    | { type: 'closeDetail' }
    | { type: 'setDetailTab'; tab: UserDetailTab }
    | { type: 'setDetailTripsPage'; page: number }
    | { type: 'setDetailChangeLogPage'; page: number }
    | { type: 'setCreateDialogOpen'; open: boolean };

export const createInitialAdminUsersState = (params: Pick<URLSearchParams, 'get'>): AdminUsersState => ({
    search: params.get('q') || '',
    dateRange: parseAdminUsersDateRange(params.get('range')),
    filters: parseUserTableFilters(params),
    isMoreFiltersOpen: false,
    visibleColumns: parseUserVisibleColumns(params.get('cols')),
    sortKey: parseUserSortKey(params.get('sort')),
    sortDirection: parseUserSortDirection(params.get('dir')),
    page: parsePositivePage(params.get('page')),
    selectedUserIds: [],
    detail: { userId: null, open: false, tab: 'overview', tripsPage: 1, changeLogPage: 1 },
    isCreateDialogOpen: false,
});

const withDetail = (state: AdminUsersState, patch: Partial<AdminUsersDetailState>): AdminUsersState => (
    { ...state, detail: { ...state.detail, ...patch } }
);

export const adminUsersReducer = (state: AdminUsersState, action: AdminUsersAction): AdminUsersState => {
    switch (action.type) {
        case 'setSearch':
            return { ...state, search: action.value, page: 1 };
        case 'setDateRange':
            return { ...state, dateRange: action.value, page: 1 };
        case 'setFilter': {
            const filters = { ...state.filters, [action.key]: action.values } as UserTableFilters;
            return { ...state, filters, page: 1 };
        }
        case 'resetFilters':
            return { ...state, filters: { ...EMPTY_USER_TABLE_FILTERS }, page: 1 };
        case 'applyQueue': {
            // Clicking the applied queue clears it; any other queue replaces every filter.
            if (action.wasApplied) return { ...state, filters: { ...EMPTY_USER_TABLE_FILTERS }, page: 1 };
            const queue = USER_QUEUE_FILTERS[action.queueId];
            return {
                ...state,
                filters: {
                    ...EMPTY_USER_TABLE_FILTERS,
                    activation: queue.activation,
                    subscription: queue.subscription,
                    trips: queue.trips,
                },
                page: 1,
            };
        }
        case 'openMoreFilters':
            return state.isMoreFiltersOpen ? state : { ...state, isMoreFiltersOpen: true };
        case 'setVisibleColumns':
            return { ...state, visibleColumns: sanitizeUserVisibleColumns(action.values) };
        case 'restoreVisibleColumns':
            return { ...state, visibleColumns: action.columns };
        case 'toggleSort':
            return { ...state, ...toggleUserSort(state, action.key) };
        case 'setPage':
            return { ...state, page: action.page };
        case 'setUserSelected': {
            const has = state.selectedUserIds.includes(action.userId);
            if (action.selected === has) return state;
            return {
                ...state,
                selectedUserIds: action.selected
                    ? [...state.selectedUserIds, action.userId]
                    : state.selectedUserIds.filter((id) => id !== action.userId),
            };
        }
        case 'setUsersSelected': {
            const next = new Set(state.selectedUserIds);
            action.userIds.forEach((id) => (action.selected ? next.add(id) : next.delete(id)));
            return { ...state, selectedUserIds: Array.from(next) };
        }
        case 'replaceSelection':
            return { ...state, selectedUserIds: [...action.userIds] };
        case 'clearSelection':
            return state.selectedUserIds.length === 0 ? state : { ...state, selectedUserIds: [] };
        case 'openUser':
            // Always lands on the overview with both lists back on their first page.
            return {
                ...state,
                detail: { userId: action.userId, open: true, tab: 'overview', tripsPage: 1, changeLogPage: 1 },
            };
        case 'reopenDetail':
            return withDetail(state, { open: true });
        case 'closeDetail':
            return withDetail(state, { open: false, userId: null });
        case 'setDetailTab':
            return withDetail(state, { tab: action.tab });
        case 'setDetailTripsPage':
            return withDetail(state, { tripsPage: action.page });
        case 'setDetailChangeLogPage':
            return withDetail(state, { changeLogPage: action.page });
        case 'setCreateDialogOpen':
            return state.isCreateDialogOpen === action.open ? state : { ...state, isCreateDialogOpen: action.open };
        default:
            return state;
    }
};
