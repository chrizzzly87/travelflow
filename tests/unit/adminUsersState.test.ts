import { describe, expect, it } from 'vitest';
import {
  adminUsersReducer,
  createInitialAdminUsersState,
  type AdminUsersState,
} from '../../components/admin/users/adminUsersState';
import { DEFAULT_VISIBLE_USER_COLUMNS, EMPTY_USER_TABLE_FILTERS } from '../../components/admin/adminUsersModel';

const initial = (query = ''): AdminUsersState => createInitialAdminUsersState(new URLSearchParams(query));

describe('adminUsersState initial state', () => {
  it('reads search, range, filters, columns, sort and page from the URL', () => {
    const state = initial('q=ada&range=7d&role=admin&tier=tier_mid&subscription=past_due&cols=user,role&sort=name&dir=asc&page=3');
    expect(state).toMatchObject({
      search: 'ada',
      dateRange: '7d',
      filters: { role: ['admin'], tier: ['tier_mid'], subscription: ['past_due'] },
      visibleColumns: ['user', 'role'],
      sortKey: 'name',
      sortDirection: 'asc',
      page: 3,
      selectedUserIds: [],
      detail: { userId: null, open: false, tab: 'overview' },
      isCreateDialogOpen: false,
    });
  });

  it('starts newest first on the last 30 days with the lean columns', () => {
    expect(initial('range=bogus&sort=bogus&page=-4')).toMatchObject({
      dateRange: '30d',
      sortKey: 'created_at',
      sortDirection: 'desc',
      page: 1,
      filters: EMPTY_USER_TABLE_FILTERS,
      visibleColumns: DEFAULT_VISIBLE_USER_COLUMNS,
    });
  });
});

describe('adminUsersReducer', () => {
  it('returns to the first page when the search, range or a filter changes, but not on sort', () => {
    const paged = { ...initial(), page: 4 };
    expect(adminUsersReducer(paged, { type: 'setSearch', value: 'x' }).page).toBe(1);
    expect(adminUsersReducer(paged, { type: 'setDateRange', value: 'all' }).page).toBe(1);
    expect(adminUsersReducer(paged, { type: 'setFilter', key: 'status', values: ['deleted'] })).toMatchObject({
      page: 1,
      filters: { status: ['deleted'] },
    });
    expect(adminUsersReducer(paged, { type: 'resetFilters' }).page).toBe(1);
    expect(adminUsersReducer(paged, { type: 'toggleSort', key: 'name' })).toMatchObject({
      page: 4,
      sortKey: 'name',
      sortDirection: 'asc',
    });
  });

  it('flips the direction when the sorted column is toggled again', () => {
    const sorted = adminUsersReducer(initial(), { type: 'toggleSort', key: 'name' });
    expect(adminUsersReducer(sorted, { type: 'toggleSort', key: 'name' }).sortDirection).toBe('desc');
  });

  it('resets every filter but keeps the search, range and "more filters" state', () => {
    const filtered = {
      ...initial('q=ada&range=90d&role=admin&trips=no_trips'),
      isMoreFiltersOpen: true,
    };
    const reset = adminUsersReducer(filtered, { type: 'resetFilters' });
    expect(reset.filters).toEqual(EMPTY_USER_TABLE_FILTERS);
    expect(reset).toMatchObject({ search: 'ada', dateRange: '90d', isMoreFiltersOpen: true });
  });

  it('swaps every filter for a queue and clears it when the applied queue is clicked again', () => {
    const filtered = initial('role=admin&page=2');
    const applied = adminUsersReducer(filtered, { type: 'applyQueue', queueId: 'subscriptions_at_risk', wasApplied: false });
    expect(applied.filters).toEqual({ ...EMPTY_USER_TABLE_FILTERS, subscription: ['past_due', 'canceled_grace'] });
    expect(applied.page).toBe(1);
    const cleared = adminUsersReducer(applied, { type: 'applyQueue', queueId: 'subscriptions_at_risk', wasApplied: true });
    expect(cleared.filters).toEqual(EMPTY_USER_TABLE_FILTERS);
  });

  it('sanitizes the column choice and keeps the User column', () => {
    const next = adminUsersReducer(initial(), { type: 'setVisibleColumns', values: ['created', 'role', 'nope'] });
    expect(next.visibleColumns).toEqual(['user', 'role', 'created']);
  });

  it('adds, removes, replaces and clears selected ids', () => {
    let state = adminUsersReducer(initial(), { type: 'setUserSelected', userId: 'a', selected: true });
    expect(adminUsersReducer(state, { type: 'setUserSelected', userId: 'a', selected: true })).toBe(state);
    state = adminUsersReducer(state, { type: 'setUsersSelected', userIds: ['b', 'c'], selected: true });
    expect(state.selectedUserIds).toEqual(['a', 'b', 'c']);
    state = adminUsersReducer(state, { type: 'setUsersSelected', userIds: ['a', 'c'], selected: false });
    expect(state.selectedUserIds).toEqual(['b']);
    state = adminUsersReducer(state, { type: 'replaceSelection', userIds: ['x', 'y'] });
    expect(state.selectedUserIds).toEqual(['x', 'y']);
    state = adminUsersReducer(state, { type: 'clearSelection' });
    expect(state.selectedUserIds).toEqual([]);
    expect(adminUsersReducer(state, { type: 'clearSelection' })).toBe(state);
  });

  it('opens a user on the overview with both sheet lists on their first page', () => {
    const browsing = {
      ...initial(),
      detail: { userId: 'old', open: true, tab: 'trips' as const, tripsPage: 3, changeLogPage: 2 },
    };
    expect(adminUsersReducer(browsing, { type: 'openUser', userId: 'new' }).detail).toEqual({
      userId: 'new',
      open: true,
      tab: 'overview',
      tripsPage: 1,
      changeLogPage: 1,
    });
  });

  it('closes the sheet and forgets the user', () => {
    const open = adminUsersReducer(initial(), { type: 'openUser', userId: 'u-1' });
    const tabbed = adminUsersReducer(open, { type: 'setDetailTab', tab: 'billing' });
    expect(tabbed.detail.tab).toBe('billing');
    expect(adminUsersReducer(tabbed, { type: 'closeDetail' }).detail).toMatchObject({ userId: null, open: false });
  });

  it('pages the sheet lists independently', () => {
    const open = adminUsersReducer(initial(), { type: 'openUser', userId: 'u-1' });
    const next = adminUsersReducer(
      adminUsersReducer(open, { type: 'setDetailTripsPage', page: 2 }),
      { type: 'setDetailChangeLogPage', page: 3 },
    );
    expect(next.detail).toMatchObject({ tripsPage: 2, changeLogPage: 3 });
  });

  it('tracks the create dialog and the "more filters" toggle', () => {
    const opened = adminUsersReducer(initial(), { type: 'setCreateDialogOpen', open: true });
    expect(opened.isCreateDialogOpen).toBe(true);
    expect(adminUsersReducer(opened, { type: 'setCreateDialogOpen', open: true })).toBe(opened);
    expect(adminUsersReducer(initial(), { type: 'openMoreFilters' }).isMoreFiltersOpen).toBe(true);
  });
});
