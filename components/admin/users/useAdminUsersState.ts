import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useSearchParams } from '@/app/navigation';
import type { AdminUserRecord } from '../../../services/adminService';
import type { AdminDateRange } from '../adminShellUtils';
import { readAdminCache, writeAdminCache } from '../adminLocalCache';
import {
    USERS_PAGE_SIZE,
    buildUsersColumnsCacheKey,
    buildUsersFilterOptions,
    buildUsersSearchParams,
    clampPage,
    countUserLoginFilters,
    countUserQueues,
    filterAdminUsers,
    filterUsersByDateRange,
    getDeepLinkedUserId,
    hasActiveMoreUserFilters,
    hasActiveUserFilters,
    isUserHardDeleteEligible,
    resolveAppliedUserQueueForFilters,
    restoreCachedUserVisibleColumns,
    slicePage,
    sortAdminUsers,
    type UserDetailTab,
    type UserQueueId,
    type UserSortKey,
    type UserTableFilterKey,
} from '../adminUsersModel';
import { adminUsersReducer, createInitialAdminUsersState } from './adminUsersState';

interface UseAdminUsersStateOptions {
    /** The signed-in admin; their column choice is stored per account. */
    adminUserId: string | null | undefined;
    currentTermsVersion: string | null;
}

/**
 * Filter, sort, paging, selection and sheet/dialog state for the Users screen.
 * Everything that follows from it (visible rows, page, counts, filter options)
 * is derived on render. Effects only mirror state into the URL and browser
 * storage, and open the sheet a deep link asks for.
 */
export const useAdminUsersState = (users: AdminUserRecord[], options: UseAdminUsersStateOptions) => {
    const { adminUserId, currentTermsVersion } = options;
    const [searchParams, setSearchParams] = useSearchParams();
    const [state, dispatch] = useReducer(adminUsersReducer, searchParams, createInitialAdminUsersState);
    const deepLinkedUserId = getDeepLinkedUserId(searchParams);

    // Restores the admin's column choice from browser storage (an external store keyed by the signed-in admin).
    const usersColumnsCacheKey = buildUsersColumnsCacheKey(adminUserId);
    const loadedColumnsCacheKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (loadedColumnsCacheKeyRef.current === usersColumnsCacheKey) return;
        loadedColumnsCacheKeyRef.current = usersColumnsCacheKey;
        if (searchParams.get('cols')) return;
        const cachedColumns = readAdminCache<string[] | null>(usersColumnsCacheKey, null);
        if (!cachedColumns) return;
        dispatch({ type: 'restoreVisibleColumns', columns: restoreCachedUserVisibleColumns(cachedColumns) });
    }, [searchParams, usersColumnsCacheKey]);

    useEffect(() => {
        writeAdminCache(usersColumnsCacheKey, state.visibleColumns);
    }, [usersColumnsCacheKey, state.visibleColumns]);

    // A deep link (`?user=<id>&drawer=user`) opens that account's sheet once per id.
    useEffect(() => {
        if (deepLinkedUserId) dispatch({ type: 'openUser', userId: deepLinkedUserId });
    }, [deepLinkedUserId]);

    const usersInDateRange = useMemo(
        () => filterUsersByDateRange(users, state.dateRange),
        [state.dateRange, users]
    );
    const filteredUsers = useMemo(
        () => sortAdminUsers(
            filterAdminUsers(usersInDateRange, state.filters, state.search, currentTermsVersion),
            state.sortKey,
            state.sortDirection,
            currentTermsVersion
        ),
        [currentTermsVersion, state.filters, state.search, state.sortDirection, state.sortKey, usersInDateRange]
    );
    const queueCounts = useMemo(() => countUserQueues(usersInDateRange), [usersInDateRange]);
    const filterOptions = useMemo(
        () => buildUsersFilterOptions(usersInDateRange, currentTermsVersion),
        [currentTermsVersion, usersInDateRange]
    );
    const loginFilterCounts = useMemo(() => countUserLoginFilters(usersInDateRange), [usersInDateRange]);
    const appliedQueue = resolveAppliedUserQueueForFilters(state.filters);

    const currentPage = clampPage(state.page, filteredUsers.length, USERS_PAGE_SIZE);
    const pagedUsers = useMemo(
        () => slicePage(filteredUsers, currentPage, USERS_PAGE_SIZE),
        [currentPage, filteredUsers]
    );

    // Selection is kept as ids, but only rows the table shows and that can be
    // deleted count: a filter change hides a selection instead of acting on it.
    const selectedUserIdSet = useMemo(() => new Set(state.selectedUserIds), [state.selectedUserIds]);
    const selectedVisibleUsers = useMemo(
        () => filteredUsers.filter((user) => selectedUserIdSet.has(user.user_id) && isUserHardDeleteEligible(user)),
        [filteredUsers, selectedUserIdSet]
    );
    const selectableVisibleUsers = useMemo(
        () => filteredUsers.filter((user) => isUserHardDeleteEligible(user)),
        [filteredUsers]
    );
    const areAllVisibleUsersSelected = selectableVisibleUsers.length > 0
        && selectableVisibleUsers.every((user) => selectedUserIdSet.has(user.user_id));
    const isVisibleSelectionPartial = selectedVisibleUsers.length > 0 && !areAllVisibleUsersSelected;

    const selectedUser = useMemo(
        () => users.find((user) => user.user_id === state.detail.userId) || null,
        [state.detail.userId, users]
    );

    // Mirrors table state into the URL so filters, sort, page and the open user survive reloads and can be shared.
    const drawerUserId = state.detail.userId || deepLinkedUserId;
    const hasDrawerInUrl = Boolean((state.detail.open || deepLinkedUserId) && drawerUserId);
    useEffect(() => {
        const next = buildUsersSearchParams({
            search: state.search,
            dateRange: state.dateRange,
            filters: state.filters,
            sortKey: state.sortKey,
            sortDirection: state.sortDirection,
            page: currentPage,
            visibleColumns: state.visibleColumns,
            drawerUserId: hasDrawerInUrl ? drawerUserId : null,
        });
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        currentPage,
        drawerUserId,
        hasDrawerInUrl,
        searchParams,
        setSearchParams,
        state.dateRange,
        state.filters,
        state.search,
        state.sortDirection,
        state.sortKey,
        state.visibleColumns,
    ]);

    /**
     * Closes the inspector and drops `?user=…&drawer=user`. Every close path
     * goes through here: a hard delete used to close the sheet but leave the
     * deep link behind, so a reload reopened a deleted account.
     */
    const closeUserDetail = () => {
        dispatch({ type: 'closeDetail' });
        setSearchParams((current) => {
            if (!current.has('user') && current.get('drawer') !== 'user') return current;
            const next = new URLSearchParams(current);
            next.delete('user');
            next.delete('drawer');
            return next;
        }, { replace: true });
    };

    const setUserSelected = (userId: string, selected: boolean) => {
        const target = filteredUsers.find((user) => user.user_id === userId);
        if (selected && target && !isUserHardDeleteEligible(target)) return;
        dispatch({ type: 'setUserSelected', userId, selected });
    };

    const actions = {
        setSearch: (value: string) => dispatch({ type: 'setSearch', value }),
        setDateRange: (value: AdminDateRange) => dispatch({ type: 'setDateRange', value }),
        setFilter: (key: UserTableFilterKey, values: string[]) => dispatch({ type: 'setFilter', key, values }),
        resetFilters: () => dispatch({ type: 'resetFilters' }),
        applyQueue: (queueId: UserQueueId) => dispatch({ type: 'applyQueue', queueId, wasApplied: appliedQueue === queueId }),
        openMoreFilters: () => dispatch({ type: 'openMoreFilters' }),
        setVisibleColumns: (values: string[]) => dispatch({ type: 'setVisibleColumns', values }),
        toggleSort: (key: UserSortKey) => dispatch({ type: 'toggleSort', key }),
        setPage: (page: number) => dispatch({ type: 'setPage', page }),
        setUserSelected,
        setAllVisibleSelected: (selected: boolean) => dispatch({
            type: 'setUsersSelected',
            userIds: selectableVisibleUsers.map((user) => user.user_id),
            selected,
        }),
        replaceSelection: (userIds: string[]) => dispatch({ type: 'replaceSelection', userIds }),
        clearSelection: () => dispatch({ type: 'clearSelection' }),
        openUser: (userId: string) => dispatch({ type: 'openUser', userId }),
        reopenDetail: () => dispatch({ type: 'reopenDetail' }),
        closeUserDetail,
        setDetailTab: (tab: UserDetailTab) => dispatch({ type: 'setDetailTab', tab }),
        setDetailTripsPage: (page: number) => dispatch({ type: 'setDetailTripsPage', page }),
        setDetailChangeLogPage: (page: number) => dispatch({ type: 'setDetailChangeLogPage', page }),
        setCreateDialogOpen: (open: boolean) => dispatch({ type: 'setCreateDialogOpen', open }),
    };

    return {
        state,
        deepLinkedUserId,
        usersInDateRange,
        filteredUsers,
        pagedUsers,
        currentPage,
        queueCounts,
        appliedQueue,
        filterOptions,
        loginFilterCounts,
        hasActiveFilters: hasActiveUserFilters(state.filters),
        showMoreFilters: state.isMoreFiltersOpen || hasActiveMoreUserFilters(state.filters),
        selectedUserIdSet,
        selectedVisibleUsers,
        selectableVisibleUsers,
        areAllVisibleUsersSelected,
        isVisibleSelectionPartial,
        selectedUser,
        actions,
    };
};

export type AdminUsersStateApi = ReturnType<typeof useAdminUsersState>;
