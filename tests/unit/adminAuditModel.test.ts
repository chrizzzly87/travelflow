import { describe, expect, it } from 'vitest';
import type { AdminAuditRecord, AdminUserChangeRecord } from '../../services/adminService';
import {
  buildActionFilterOptions,
  buildActorFilterOptions,
  buildAuditSearchParams,
  buildTargetFilterOptions,
  buildTripOwnerLog,
  buildUndoOverrideMetadata,
  buildUserSheetLog,
  canOpenFullDiff,
  canUndoTimelineEntry,
  clampAuditOffset,
  extractRevertibleProfilePatch,
  filterAuditTimeline,
  findMissingUndoSourceIds,
  getAuditExportBlocker,
  getAuditPageSelectionState,
  hasActiveAuditFilters,
  indexAuditTimeline,
  isIsoDateInAuditRange,
  mergeAuditTimeline,
  parseAuditSort,
  parseAuditVisibleColumns,
  resolveAuditTripIdentity,
  resolveAuditUserAccountStatus,
  resolveAuditUserIdentity,
  sortAuditTimeline,
  toForensicsReplayFileName,
  toggleAuditSort,
  AUDIT_COLUMN_WIDTH_DEFAULTS,
  DEFAULT_AUDIT_SORT,
  DEFAULT_VISIBLE_COLUMNS,
  type AuditFilterState,
  type AuditTimelineEntry,
} from '../../components/admin/audit/adminAuditModel';
import {
  buildAuditDiffEntries,
  describeAuditEntry,
  formatAuditActorName,
  formatAuditDiffLine,
  resolveAuditActionPresentation,
} from '../../components/admin/audit/adminAuditPresentation';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

const adminLog = (overrides: Partial<AdminAuditRecord> = {}): AdminAuditRecord => ({
  id: 'a-1',
  actor_user_id: 'admin-1',
  actor_email: 'admin@example.com',
  action: 'admin.user.update_profile',
  target_type: 'user',
  target_id: 'user-1',
  before_data: { tier_key: 'tier_free' },
  after_data: { tier_key: 'tier_mid' },
  metadata: null,
  created_at: hoursAgo(1),
  ...overrides,
});

const userLog = (overrides: Partial<AdminUserChangeRecord> = {}): AdminUserChangeRecord => ({
  id: 'u-1',
  owner_user_id: 'user-9',
  owner_email: 'zoe@example.com',
  action: 'trip.archived',
  target_type: 'trip',
  target_id: 'trip-1',
  before_data: null,
  after_data: null,
  metadata: null,
  created_at: hoursAgo(2),
  ...overrides,
} as AdminUserChangeRecord);

const filters = (overrides: Partial<AuditFilterState> = {}): AuditFilterState => ({
  search: '',
  timePreset: 'all',
  customStartDate: '',
  customEndDate: '',
  actionFilters: [],
  targetFilters: [],
  actorFilters: [],
  ...overrides,
});

describe('adminAuditModel parsing and URL', () => {
  it('falls back to default columns and sort for unknown values', () => {
    expect(parseAuditVisibleColumns('when,bogus,actor')).toEqual(['when', 'actor']);
    expect(parseAuditVisibleColumns('bogus')).toEqual(DEFAULT_VISIBLE_COLUMNS);
    expect(parseAuditSort('bogus', 'sideways')).toEqual(DEFAULT_AUDIT_SORT);
    expect(parseAuditSort('actor', null)).toEqual({ column: 'actor', direction: 'asc' });
  });

  it('flips the sorted column and starts a new one in its natural order', () => {
    expect(toggleAuditSort(DEFAULT_AUDIT_SORT, 'when')).toEqual({ column: 'when', direction: 'asc' });
    expect(toggleAuditSort(DEFAULT_AUDIT_SORT, 'action')).toEqual({ column: 'action', direction: 'asc' });
    expect(toggleAuditSort({ column: 'action', direction: 'asc' }, 'when')).toEqual({ column: 'when', direction: 'desc' });
  });

  it('writes only non-default values to the URL', () => {
    const base = { ...filters({ timePreset: '30d' }), visibleColumns: DEFAULT_VISIBLE_COLUMNS, sort: DEFAULT_AUDIT_SORT, offset: 0 };
    expect(buildAuditSearchParams(base).toString()).toBe('');
    expect(buildAuditSearchParams({
      ...base,
      search: '  ada ',
      timePreset: 'custom',
      customStartDate: '2026-10-01',
      customEndDate: '2026-10-07',
      actionFilters: ['trip.created', 'trip.updated'],
      actorFilters: ['user'],
      visibleColumns: ['when', 'action'],
      sort: { column: 'actor', direction: 'asc' },
      offset: 50,
    }).toString()).toBe(
      'q=ada&range=custom&start=2026-10-01&end=2026-10-07&action=trip.created%2Ctrip.updated&actor=user&cols=when%2Caction&sort=actor&dir=asc&offset=50',
    );
  });
});

describe('adminAuditModel time range', () => {
  it('matches presets against the given clock', () => {
    expect(isIsoDateInAuditRange(hoursAgo(23), '24h', '', '', NOW)).toBe(true);
    expect(isIsoDateInAuditRange(hoursAgo(25), '24h', '', '', NOW)).toBe(false);
    expect(isIsoDateInAuditRange(hoursAgo(24 * 29), '30d', '', '', NOW)).toBe(true);
    expect(isIsoDateInAuditRange(null, 'all', '', '', NOW)).toBe(false);
  });

  it('accepts a custom range given in either order', () => {
    expect(isIsoDateInAuditRange('2026-10-05T10:00:00', 'custom', '2026-10-01', '2026-10-07', NOW)).toBe(true);
    expect(isIsoDateInAuditRange('2026-10-05T10:00:00', 'custom', '2026-10-07', '2026-10-01', NOW)).toBe(true);
    expect(isIsoDateInAuditRange('2026-10-09T10:00:00', 'custom', '2026-10-01', '2026-10-07', NOW)).toBe(false);
  });
});

describe('adminAuditModel timeline', () => {
  const entries = mergeAuditTimeline(
    [adminLog(), adminLog({ id: 'a-2', action: 'admin.trip.update', target_type: 'trip', target_id: 'trip-7', created_at: hoursAgo(30) })],
    [userLog()],
  );

  it('merges both sources newest first and keeps main-list rows over lookups', () => {
    expect(entries.map((entry) => entry.log.id)).toEqual(['a-1', 'u-1', 'a-2']);
    const merged = mergeAuditTimeline([], [userLog()], [userLog({ action: 'trip.created' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].log.action).toBe('trip.archived');
  });

  it('filters by range, action, target, actor and search token', () => {
    expect(filterAuditTimeline(entries, filters({ timePreset: '24h' }), NOW).map((e) => e.log.id)).toEqual(['a-1', 'u-1']);
    expect(filterAuditTimeline(entries, filters({ actorFilters: ['user'] }), NOW).map((e) => e.log.id)).toEqual(['u-1']);
    expect(filterAuditTimeline(entries, filters({ targetFilters: ['trip'] }), NOW).map((e) => e.log.id)).toEqual(['u-1', 'a-2']);
    expect(filterAuditTimeline(entries, filters({ actionFilters: ['admin.trip.update'] }), NOW).map((e) => e.log.id)).toEqual(['a-2']);
    expect(filterAuditTimeline(entries, filters({ search: 'ZOE@' }), NOW).map((e) => e.log.id)).toEqual(['u-1']);
    expect(filterAuditTimeline(entries, filters({ search: 'trip-7' }), NOW).map((e) => e.log.id)).toEqual(['a-2']);
  });

  it('sorts by time either way and by text with newest-first ties', () => {
    expect(sortAuditTimeline(entries, DEFAULT_AUDIT_SORT).map((e) => e.log.id)).toEqual(['a-1', 'u-1', 'a-2']);
    expect(sortAuditTimeline(entries, { column: 'when', direction: 'asc' }).map((e) => e.log.id)).toEqual(['a-2', 'u-1', 'a-1']);
    expect(sortAuditTimeline(entries, { column: 'actor', direction: 'asc' }).map((e) => e.log.id)).toEqual(['a-1', 'a-2', 'u-1']);
    expect(sortAuditTimeline(entries, { column: 'target', direction: 'desc' }).map((e) => e.log.id)).toEqual(['a-1', 'u-1', 'a-2']);
  });

  it('clamps an offset past the end to the last page', () => {
    expect(clampAuditOffset(0, 0)).toBe(0);
    expect(clampAuditOffset(100, 0)).toBe(0);
    expect(clampAuditOffset(50, 60)).toBe(50);
    expect(clampAuditOffset(100, 60)).toBe(50);
    expect(clampAuditOffset(50, 50)).toBe(0);
  });

  it('reports page selection as all, some or none', () => {
    expect(getAuditPageSelectionState(['a', 'b'], new Set(['a', 'b', 'z']))).toBe(true);
    expect(getAuditPageSelectionState(['a', 'b'], new Set(['a']))).toBe('indeterminate');
    expect(getAuditPageSelectionState(['a', 'b'], new Set())).toBe(false);
    expect(getAuditPageSelectionState([], new Set(['a']))).toBe(false);
  });

  it('builds counted filter options grouped like the menu shows them', () => {
    expect(buildActionFilterOptions(entries).map((option) => [option.value, option.count, option.group])).toEqual([
      ['admin.user.update_profile', 1, 'Admin users'],
      ['admin.trip.update', 1, 'Admin trips'],
      ['trip.archived', 1, 'User trip actions'],
    ]);
    expect(buildTargetFilterOptions(entries)).toEqual([
      { value: 'trip', label: 'Trip', count: 2 },
      { value: 'user', label: 'User', count: 1 },
    ]);
    expect(buildActorFilterOptions(entries).map((option) => option.count)).toEqual([2, 1]);
  });

  it('counts resized columns and a non-default range as active filters, but not search', () => {
    const clean = {
      actionFilters: [], targetFilters: [], actorFilters: [], timePreset: '30d' as const,
      visibleColumns: DEFAULT_VISIBLE_COLUMNS, columnWidths: { ...AUDIT_COLUMN_WIDTH_DEFAULTS },
    };
    expect(hasActiveAuditFilters(clean)).toBe(false);
    expect(hasActiveAuditFilters({ ...clean, timePreset: 'all' })).toBe(true);
    expect(hasActiveAuditFilters({ ...clean, columnWidths: { ...AUDIT_COLUMN_WIDTH_DEFAULTS, diff: 400 } })).toBe(true);
  });

  it('finds undo source events that are not loaded and not requested yet', () => {
    const undo = adminLog({ id: 'a-9', action: 'admin.trip.override_commit', metadata: { undo_source_event_id: 'u-missing' } });
    const timeline = mergeAuditTimeline([undo], [userLog()]);
    const index = indexAuditTimeline(timeline);
    expect(findMissingUndoSourceIds(timeline, index, new Set())).toEqual(['u-missing']);
    expect(findMissingUndoSourceIds(timeline, index, new Set(['u-missing']))).toEqual([]);
  });
});

describe('adminAuditModel undo rules', () => {
  it('extracts only revertible profile fields', () => {
    expect(extractRevertibleProfilePatch({ first_name: ' Ada ', account_status: 'bogus', updated_at: 'x' }))
      .toEqual({ firstName: 'Ada', accountStatus: null });
    expect(extractRevertibleProfilePatch({ updated_at: 'x' })).toBeNull();
  });

  it('allows undo only where a revert can be written', () => {
    expect(canUndoTimelineEntry({ kind: 'admin', log: adminLog() })).toBe(true);
    expect(canUndoTimelineEntry({ kind: 'admin', log: adminLog({ target_id: null }) })).toBe(false);
    expect(canUndoTimelineEntry({ kind: 'admin', log: adminLog({ action: 'admin.user.hard_delete' }) })).toBe(false);
    expect(canUndoTimelineEntry({ kind: 'user', log: userLog() })).toBe(true);
    expect(canUndoTimelineEntry({ kind: 'user', log: userLog({ action: 'trip.updated' }) })).toBe(false);
    expect(canUndoTimelineEntry({ kind: 'user', log: userLog({ action: 'trip.updated', metadata: { version_id: 'v2' } }) })).toBe(true);
  });

  it('records the undo chain so a second undo flips parity', () => {
    const userEntry: AuditTimelineEntry = { kind: 'user', log: userLog() };
    expect(buildUndoOverrideMetadata(userEntry, new Map())).toEqual({
      undo_source_event_id: 'u-1',
      undo_root_source_event_id: 'u-1',
      undo_parity: 1,
    });
    const firstUndo: AuditTimelineEntry = {
      kind: 'admin',
      log: adminLog({ id: 'a-5', action: 'admin.trip.override_commit', metadata: { undo_source_event_id: 'u-1', undo_root_source_event_id: 'u-1', undo_parity: 1 } }),
    };
    expect(buildUndoOverrideMetadata(firstUndo, indexAuditTimeline([userEntry, firstUndo]))).toEqual({
      undo_source_event_id: 'a-5',
      undo_root_source_event_id: 'u-1',
      undo_parity: 0,
    });
  });
});

describe('adminAuditModel sheets and export', () => {
  it('builds a synthetic actor log, or reuses the source row for a target', () => {
    const actor = buildUserSheetLog(' user-3 ', { actorEmail: 'x@example.com' }, NOW);
    expect(actor).toMatchObject({ id: `audit-actor-user-3-${NOW}`, target_id: 'user-3', action: 'audit.open_actor', actor_email: 'x@example.com' });
    expect(buildUserSheetLog('user-1', { sourceLog: adminLog() }, NOW)).toMatchObject({ id: 'a-1', target_type: 'user' });
    expect(buildUserSheetLog('  ', {}, NOW)).toBeNull();
  });

  it('prefers live records and falls back to the audit snapshot', () => {
    const log = adminLog({ after_data: { first_name: 'Ida', email: 'ida@example.com', account_status: 'deleted' } });
    expect(resolveAuditUserIdentity(log, null)).toMatchObject({ userId: 'user-1', name: 'Ida', email: 'ida@example.com' });
    expect(resolveAuditUserAccountStatus(log, null)).toBe('deleted');
    const trip = resolveAuditTripIdentity(adminLog({ target_type: 'trip', target_id: 'trip-1', after_data: { owner_id: 'o-1', title: 'Lisbon' } }), null);
    expect(trip).toMatchObject({ tripId: 'trip-1', title: 'Lisbon', ownerId: 'o-1' });
    expect(buildTripOwnerLog(null, trip)).toMatchObject({ target_type: 'user', target_id: 'o-1', action: 'audit.open_owner_from_trip' });
    expect(buildTripOwnerLog(null, { ...trip, ownerId: null })).toBeNull();
  });

  it('offers a full diff when snapshots or a trip version exist', () => {
    expect(canOpenFullDiff({ kind: 'admin', log: adminLog() })).toBe(true);
    expect(canOpenFullDiff({ kind: 'user', log: userLog() })).toBe(false);
    expect(canOpenFullDiff({ kind: 'user', log: userLog({ metadata: { version_id: 'v1' } }) })).toBe(true);
  });

  it('blocks empty or oversized exports and names the file by timestamp', () => {
    expect(getAuditExportBlocker(0, 0)).toBe('No audit entries match the current filters.');
    expect(getAuditExportBlocker(0, 3)).toBeNull();
    expect(getAuditExportBlocker(501, 3)).toMatch(/Too many selected entries \(501\)/);
    expect(toForensicsReplayFileName('2026-10-24T10:00:00.123Z')).toBe('admin-audit-replay-2026-10-24T10-00-00Z.json');
  });
});

describe('adminAuditPresentation', () => {
  it('drops noisy and unchanged keys from the diff', () => {
    expect(buildAuditDiffEntries(adminLog({
      before_data: { b: 1, a: 'x', updated_at: '1', same: true },
      after_data: { b: 2, a: 'y', updated_at: '2', same: true },
    })).map((entry) => entry.key)).toEqual(['a', 'b']);
  });

  it('labels profile updates by what changed', () => {
    const presentation = (before: Record<string, unknown>, after: Record<string, unknown>) => {
      const log = adminLog({ before_data: before, after_data: after });
      return resolveAuditActionPresentation(log, buildAuditDiffEntries(log)).label;
    };
    expect(presentation({ account_status: 'active' }, { account_status: 'deleted' })).toBe('Soft-deleted user');
    expect(presentation({ account_status: 'disabled' }, { account_status: 'active' })).toBe('Reactivated user');
    expect(presentation({ system_role: 'user' }, { system_role: 'admin' })).toBe('Updated user role');
    expect(presentation({ tier_key: 'tier_free' }, { tier_key: 'tier_mid' })).toBe('Updated user tier');
    expect(resolveAuditActionPresentation(adminLog({ action: 'billing.subscription.canceled' }), []).label).toBe('Billing subscription canceled');
    expect(resolveAuditActionPresentation(adminLog({ action: 'something.else' }), []).label).toBe('something.else');
  });

  it('describes an entry once for the row, menu and sheet', () => {
    const entry: AuditTimelineEntry = {
      kind: 'admin',
      log: adminLog({ action: 'admin.user.hard_delete', metadata: { owned_trips_before_delete: 3 } }),
    };
    const details = describeAuditEntry(entry, indexAuditTimeline([entry]));
    expect(details).toMatchObject({
      entryKey: 'admin:a-1',
      originLabel: 'Admin action',
      targetLabel: 'User',
      targetCanOpenDrawer: true,
      ownedTripsBeforeDelete: 3,
      canUndo: false,
    });
    expect(formatAuditDiffLine(details, details.diffEntries[0])).toBe('Tier Key: tier_free → tier_mid');
    expect(formatAuditActorName('Paddle')).toBe('Paddle system');
    expect(formatAuditActorName(null)).toBe('Unknown actor');
  });
});
