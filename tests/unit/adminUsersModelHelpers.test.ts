import { describe, expect, it } from 'vitest';
import type { AdminUserChangeRecord, AdminUserRecord } from '../../services/adminService';
import {
  DEFAULT_VISIBLE_USER_COLUMNS,
  EMPTY_USER_TABLE_FILTERS,
  LEGACY_DEFAULT_VISIBLE_USER_COLUMNS,
  areOverrideRecordsEqual,
  buildBulkHardDeleteErrorMessage,
  buildUsersBillingCsv,
  buildUsersBillingCsvFileName,
  buildUsersColumnsCacheKey,
  buildUsersFilterOptions,
  buildUsersSearchParams,
  canOpenUserChangeFullDiff,
  clampPage,
  countUserLoginFilters,
  filterAdminUsers,
  findLocalTransferTargets,
  getDeepLinkedUserId,
  getLoginMethodSummary,
  getUserLoginPillKeys,
  getUserPublicProfilePath,
  getUserReferenceText,
  getUsernameCooldownMeta,
  hasActiveMoreUserFilters,
  hasActiveUserFilters,
  isLikelyEmail,
  isLikelyUserId,
  mergeTripSnapshotWithViewSettings,
  parseOverrideDraft,
  parseQueryMultiValue,
  parseUserSortKey,
  parseUserTableFilters,
  parseUserVisibleColumns,
  resolveAppliedUserQueueForFilters,
  restoreCachedUserVisibleColumns,
  sanitizeUserVisibleColumns,
  slicePage,
  sortAdminUsers,
  summarizeBulkDeleteFailures,
  toUserProfileDraft,
  toggleUserSort,
  type UsersSearchParamsInput,
} from '../../components/admin/adminUsersModel';

const makeUser = (overrides: Partial<AdminUserRecord> = {}): AdminUserRecord => ({
  user_id: 'user-1',
  email: 'user@example.com',
  auth_provider: 'email',
  auth_providers: ['email'],
  is_anonymous: false,
  activation_status: 'activated',
  account_status: 'active',
  last_sign_in_at: '2026-10-01T10:00:00Z',
  system_role: 'user',
  tier_key: 'tier_free',
  entitlements_override: null,
  total_trips: 1,
  active_trips: 1,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...overrides,
});

const searchInput = (overrides: Partial<UsersSearchParamsInput> = {}): UsersSearchParamsInput => ({
  search: '',
  dateRange: '30d',
  filters: { ...EMPTY_USER_TABLE_FILTERS },
  sortKey: 'created_at',
  sortDirection: 'desc',
  page: 1,
  visibleColumns: [...DEFAULT_VISIBLE_USER_COLUMNS],
  drawerUserId: null,
  ...overrides,
});

describe('adminUsersModel URL parsing', () => {
  it('keeps only allowed query values, deduplicated and in canonical order', () => {
    expect(parseQueryMultiValue(' user ,admin,root,user', ['admin', 'user'])).toEqual(['admin', 'user']);
    expect(parseQueryMultiValue(null, ['admin'])).toEqual([]);
  });

  it('falls back to the default sort key for unknown values', () => {
    expect(parseUserSortKey('tier_key')).toBe('tier_key');
    expect(parseUserSortKey('drop table')).toBe('created_at');
  });

  it('reads every filter from the query and maps the legacy identity filter', () => {
    const filters = parseUserTableFilters(new URLSearchParams('role=admin&login=social&social=google,nope&terms=never&identity=anonymous'));
    expect(filters).toMatchObject({
      role: ['admin'],
      loginType: ['social'],
      socialProvider: ['google'],
      terms: ['never'],
      activation: ['pending', 'anonymous'],
    });
    expect(parseUserTableFilters(new URLSearchParams('identity=identified')).activation).toEqual(['activated', 'invited']);
    expect(parseUserTableFilters(new URLSearchParams('activation=invited&identity=anonymous')).activation).toEqual(['invited']);
  });

  it('reads the deep-linked user only with drawer=user', () => {
    expect(getDeepLinkedUserId(new URLSearchParams('user=u-1&drawer=user'))).toBe('u-1');
    expect(getDeepLinkedUserId(new URLSearchParams('user=u-1'))).toBeNull();
  });
});

describe('adminUsersModel columns', () => {
  it('keeps render order and always includes the User column', () => {
    expect(sanitizeUserVisibleColumns(['created', 'status', 'bogus'])).toEqual(['user', 'status', 'created']);
    expect(sanitizeUserVisibleColumns([])).toEqual(DEFAULT_VISIBLE_USER_COLUMNS);
    expect(parseUserVisibleColumns('bogus')).toEqual(DEFAULT_VISIBLE_USER_COLUMNS);
  });

  it('upgrades a stored legacy default to the new default but keeps a custom choice', () => {
    expect(restoreCachedUserVisibleColumns([...LEGACY_DEFAULT_VISIBLE_USER_COLUMNS].reverse())).toEqual(DEFAULT_VISIBLE_USER_COLUMNS);
    expect(restoreCachedUserVisibleColumns(['user', 'role'])).toEqual(['user', 'role']);
  });

  it('keys the column cache by admin', () => {
    expect(buildUsersColumnsCacheKey(' admin-1 ')).toBe('admin.users.columns.v2.admin-1');
    expect(buildUsersColumnsCacheKey(null)).toBe('admin.users.columns.v2.anonymous');
  });
});

describe('buildUsersSearchParams', () => {
  it('writes nothing for the default view', () => {
    expect(buildUsersSearchParams(searchInput()).toString()).toBe('');
  });

  it('writes the same keys and order the screen always used', () => {
    const params = buildUsersSearchParams(searchInput({
      search: '  ada ',
      dateRange: 'all',
      filters: {
        ...EMPTY_USER_TABLE_FILTERS,
        role: ['admin'],
        activation: ['invited', 'pending'],
        loginType: ['social'],
        socialProvider: ['google'],
        trips: ['no_trips'],
      },
      sortKey: 'name',
      sortDirection: 'asc',
      page: 3,
      visibleColumns: ['user', 'role'],
      drawerUserId: 'u-1',
    }));
    expect(params.toString()).toBe(
      'q=ada&range=all&role=admin&activation=invited%2Cpending&login=social&social=google&trips=no_trips&sort=name&dir=asc&page=3&cols=user%2Crole&user=u-1&drawer=user'
    );
  });

  it('drops a filter with every value selected, and providers without the social login type', () => {
    const params = buildUsersSearchParams(searchInput({
      filters: { ...EMPTY_USER_TABLE_FILTERS, role: ['admin', 'user'], loginType: ['password'], socialProvider: ['google'] },
    }));
    expect(params.toString()).toBe('login=password');
  });

  it('round-trips through the parser', () => {
    const filters = { ...EMPTY_USER_TABLE_FILTERS, status: ['disabled' as const], subscription: ['past_due' as const] };
    const params = buildUsersSearchParams(searchInput({ filters }));
    expect(parseUserTableFilters(params)).toEqual(filters);
  });
});

describe('adminUsersModel filtering and sorting', () => {
  const ada = makeUser({ user_id: 'ada', email: 'ada@example.com', first_name: 'Ada', total_trips: 4, tier_key: 'tier_mid' });
  const bob = makeUser({ user_id: 'bob', email: 'bob@example.com', first_name: 'Bob', total_trips: 0, auth_provider: 'google', auth_providers: ['google'] });
  const cyd = makeUser({ user_id: 'cyd', email: 'cyd@example.com', first_name: 'Cyd', total_trips: 2, account_status: 'disabled', system_role: 'admin' });

  it('applies filters and the free-text search together', () => {
    const users = [ada, bob, cyd];
    expect(filterAdminUsers(users, { ...EMPTY_USER_TABLE_FILTERS, role: ['admin'] }, '', null)).toEqual([cyd]);
    expect(filterAdminUsers(users, { ...EMPTY_USER_TABLE_FILTERS, loginType: ['social'] }, '', null)).toEqual([bob]);
    expect(filterAdminUsers(users, { ...EMPTY_USER_TABLE_FILTERS, loginType: ['social'], socialProvider: ['apple'] }, '', null)).toEqual([]);
    expect(filterAdminUsers(users, EMPTY_USER_TABLE_FILTERS, '  BOB@ ', null)).toEqual([bob]);
    expect(filterAdminUsers(users, EMPTY_USER_TABLE_FILTERS, 'google', null)).toEqual([bob]);
  });

  it('sorts numbers numerically and strings lexically in either direction', () => {
    expect(sortAdminUsers([ada, bob, cyd], 'total_trips', 'asc', null).map((user) => user.user_id)).toEqual(['bob', 'cyd', 'ada']);
    expect(sortAdminUsers([bob, cyd, ada], 'name', 'desc', null).map((user) => user.user_id)).toEqual(['cyd', 'bob', 'ada']);
    expect(sortAdminUsers([ada, cyd], 'account_status', 'asc', null)[0]).toBe(cyd);
  });

  it('flips the sorted column and starts another one ascending', () => {
    expect(toggleUserSort({ sortKey: 'name', sortDirection: 'asc' }, 'name')).toEqual({ sortKey: 'name', sortDirection: 'desc' });
    expect(toggleUserSort({ sortKey: 'name', sortDirection: 'desc' }, 'email')).toEqual({ sortKey: 'email', sortDirection: 'asc' });
  });

  it('clamps and slices pages', () => {
    expect(clampPage(9, 30, 25)).toBe(2);
    expect(clampPage(3, 0, 25)).toBe(1);
    expect(slicePage([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });

  it('counts filter options and sign-in methods over the given users', () => {
    const options = buildUsersFilterOptions([ada, bob, cyd], null);
    expect(options.role.find((option) => option.value === 'admin')?.count).toBe(1);
    expect(options.status.find((option) => option.value === 'disabled')?.count).toBe(1);
    expect(options.tier.find((option) => option.value === 'tier_mid')?.label).toBeTruthy();
    const counts = countUserLoginFilters([ada, bob, cyd]);
    expect(counts).toMatchObject({ password: 2, social: 1, unknown: 0 });
    expect(counts.socialProviders.google).toBe(1);
  });

  it('labels sign-in methods in pill order', () => {
    expect(getUserLoginPillKeys(bob)).toEqual(['google']);
    expect(getLoginMethodSummary(makeUser({ auth_providers: ['email', 'github'] }))).toBe('Email, GitHub');
  });
});

describe('adminUsersModel filter state', () => {
  it('separates queue filters from the rest', () => {
    const queue = { ...EMPTY_USER_TABLE_FILTERS, activation: ['pending' as const, 'invited' as const] };
    expect(resolveAppliedUserQueueForFilters(queue)).toBe('awaiting_activation');
    expect(resolveAppliedUserQueueForFilters({ ...queue, role: ['admin'] })).toBeNull();
    expect(hasActiveUserFilters(queue)).toBe(true);
    expect(hasActiveUserFilters(EMPTY_USER_TABLE_FILTERS)).toBe(false);
  });

  it('treats subscription, role and terms as the "more" filters', () => {
    expect(hasActiveMoreUserFilters({ ...EMPTY_USER_TABLE_FILTERS, terms: ['never'] })).toBe(true);
    expect(hasActiveMoreUserFilters({ ...EMPTY_USER_TABLE_FILTERS, status: ['active'] })).toBe(false);
  });
});

describe('adminUsersModel CSV export', () => {
  it('quotes every field and escapes quotes', () => {
    const csv = buildUsersBillingCsv([makeUser({ email: 'a"b@example.com', provider_subscription_id: 'sub_1' })]);
    const [header, row] = csv.split('\n');
    expect(header).toBe('"email","user_id","tier","subscription_status","provider_status","provider_subscription_id","canceled_at","grace_ends_at","downgrade_at","current_period_end"');
    expect(row.startsWith('"a""b@example.com","user-1",')).toBe(true);
    expect(row).toContain('"sub_1"');
  });

  it('names the file after the export date', () => {
    expect(buildUsersBillingCsvFileName('2026-11-01T10:00:00.000Z')).toBe('admin-users-billing-2026-11-01.csv');
  });
});

describe('adminUsersModel detail sheet helpers', () => {
  it('reports an active username cooldown for 90 days after a change', () => {
    const changedAt = '2026-10-01T00:00:00.000Z';
    expect(getUsernameCooldownMeta(changedAt, Date.parse('2026-10-15T00:00:00Z'))).toEqual({
      isActive: true,
      endsAt: '2026-12-30T00:00:00.000Z',
    });
    expect(getUsernameCooldownMeta(changedAt, Date.parse('2027-01-01T00:00:00Z')).isActive).toBe(false);
    expect(getUsernameCooldownMeta(null)).toEqual({ isActive: false, endsAt: null });
  });

  it('seeds the profile form with the display-cased username and a valid gender', () => {
    const draft = toUserProfileDraft(makeUser({ username: 'mixed', username_display: 'MiXeD', gender: 'Female', preferred_language: null }));
    expect(draft).toMatchObject({ username: 'MiXeD', gender: 'female', preferredLanguage: 'en', role: 'user' });
    expect(toUserProfileDraft(makeUser({ gender: 'robot' })).gender).toBe('');
  });

  it('parses override JSON and compares it ignoring key order', () => {
    expect(parseOverrideDraft('  ')).toEqual({});
    expect(() => parseOverrideDraft('[1]')).toThrow('Overrides JSON must be an object.');
    expect(() => parseOverrideDraft('{oops')).toThrow(SyntaxError);
    expect(areOverrideRecordsEqual({ a: 1, b: { d: 2, c: 3 } }, { b: { c: 3, d: 2 }, a: 1 })).toBe(true);
    expect(areOverrideRecordsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('builds the public profile path only for a valid username', () => {
    expect(getUserPublicProfilePath(' Traveler_One ')).toContain('traveler_one');
    expect(getUserPublicProfilePath('x')).toBeNull();
  });

  it('opens a full diff for snapshots or a trip version only', () => {
    const base = { id: 'c-1', owner_user_id: 'u-1', action: 'trip.updated', target_type: 'trip', target_id: 't-1', before_data: null, after_data: null, metadata: null, created_at: '2026-10-01T00:00:00Z' } as unknown as AdminUserChangeRecord;
    expect(canOpenUserChangeFullDiff(base)).toBe(false);
    expect(canOpenUserChangeFullDiff({ ...base, metadata: { version_id: 'v-2' } })).toBe(true);
    expect(canOpenUserChangeFullDiff({ ...base, target_type: 'user', after_data: { tier_key: 'tier_mid' } })).toBe(true);
  });

  it('adds view settings to a trip snapshot only when there are any', () => {
    expect(mergeTripSnapshotWithViewSettings({ a: 1 }, {})).toEqual({ a: 1 });
    expect(mergeTripSnapshotWithViewSettings({ a: 1 }, { zoom: 3 })).toEqual({ a: 1, view_settings: { zoom: 3 } });
  });
});

describe('adminUsersModel deletion helpers', () => {
  it('recognises ids and emails for the transfer target', () => {
    expect(isLikelyUserId('3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe(true);
    expect(isLikelyUserId('not-a-uuid')).toBe(false);
    expect(isLikelyEmail(' someone@example.com ')).toBe(true);
    expect(isLikelyEmail('someone@')).toBe(false);
  });

  it('matches local transfer targets by exact id or email', () => {
    const users = [makeUser({ user_id: 'A-1', email: 'One@Example.com' }), makeUser({ user_id: 'b-2', email: null })];
    expect(findLocalTransferTargets(users, ' one@example.com ')).toHaveLength(1);
    expect(findLocalTransferTargets(users, 'a-1')).toHaveLength(1);
    expect(findLocalTransferTargets(users, 'example.com')).toHaveLength(0);
  });

  it('refers to a user by name and email, or name and id', () => {
    expect(getUserReferenceText(makeUser({ first_name: 'Ada', last_name: 'L' }))).toMatch(/\(user@example\.com\)$/);
    expect(getUserReferenceText(makeUser({ email: null }))).toMatch(/\(user-1\)$/);
  });

  it('lists at most five failures and counts the rest', () => {
    const details = Array.from({ length: 7 }, (_, index) => `user-${index}: failed`);
    expect(summarizeBulkDeleteFailures(details).split('\n')).toEqual([
      '- user-0: failed', '- user-1: failed', '- user-2: failed', '- user-3: failed', '- user-4: failed', '- +2 more failures',
    ]);
    expect(summarizeBulkDeleteFailures([])).toBe('');
  });

  it('words the bulk hard-delete error for full and partial failures', () => {
    expect(buildBulkHardDeleteErrorMessage(3, [])).toBeNull();
    expect(buildBulkHardDeleteErrorMessage(0, ['a: x'])).toBe('Could not hard-delete selected users.\n- a: x');
    expect(buildBulkHardDeleteErrorMessage(2, ['a: x'])).toBe('1 user failed to hard-delete.\n- a: x');
  });
});
