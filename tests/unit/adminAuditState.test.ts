import { describe, expect, it } from 'vitest';
import type { AdminAuditRecord } from '../../services/adminService';
import {
  adminAuditReducer,
  createInitialAdminAuditState,
  type AdminAuditState,
} from '../../components/admin/audit/adminAuditState';
import { AUDIT_COLUMN_WIDTH_DEFAULTS, DEFAULT_VISIBLE_COLUMNS } from '../../components/admin/audit/adminAuditModel';

const RANGE = { startDate: '2026-10-18', endDate: '2026-10-24' };
const NOW = Date.parse('2026-10-24T12:00:00.000Z');

const initial = (query = ''): AdminAuditState => createInitialAdminAuditState(new URLSearchParams(query), RANGE);

const log = (overrides: Partial<AdminAuditRecord> = {}): AdminAuditRecord => ({
  id: 'a-1',
  actor_user_id: 'admin-1',
  actor_email: 'admin@example.com',
  action: 'admin.trip.update',
  target_type: 'trip',
  target_id: 'trip-1',
  before_data: null,
  after_data: null,
  metadata: null,
  created_at: '2026-10-24T10:00:00.000Z',
  ...overrides,
});

describe('adminAuditState initial state', () => {
  it('reads filters, sort and offset from the URL', () => {
    const state = initial('q=ada&range=custom&start=2026-10-01&action=trip.created,trip.created&actor=user,robot&cols=when,diff&sort=action&dir=desc&offset=50');
    expect(state).toMatchObject({
      search: 'ada',
      timePreset: 'custom',
      customStartDate: '2026-10-01',
      customEndDate: RANGE.endDate,
      actionFilters: ['trip.created'],
      actorFilters: ['user'],
      visibleColumns: ['when', 'diff'],
      sort: { column: 'action', direction: 'desc' },
      offset: 50,
      panel: { kind: 'none' },
    });
  });

  it('starts on the newest-first timeline with default columns', () => {
    expect(initial()).toMatchObject({
      timePreset: '30d',
      sort: { column: 'when', direction: 'desc' },
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      columnWidths: AUDIT_COLUMN_WIDTH_DEFAULTS,
      offset: 0,
    });
  });
});

describe('adminAuditReducer', () => {
  it('returns to the first page whenever a filter, the search or the sort changes', () => {
    const paged = { ...initial(), offset: 100 };
    expect(adminAuditReducer(paged, { type: 'setSearch', value: 'x' }).offset).toBe(0);
    expect(adminAuditReducer(paged, { type: 'setTargetFilters', values: ['trip'] }).offset).toBe(0);
    expect(adminAuditReducer(paged, { type: 'setCustomRange', startDate: 'a', endDate: 'b' }).offset).toBe(0);
    expect(adminAuditReducer(paged, { type: 'toggleSort', column: 'actor' })).toMatchObject({
      offset: 0,
      sort: { column: 'actor', direction: 'asc' },
    });
    // Column choice is presentation only and keeps the page.
    expect(adminAuditReducer(paged, { type: 'setVisibleColumns', values: ['when'] }).offset).toBe(100);
  });

  it('keeps the custom dates only while the custom preset is chosen', () => {
    const custom = { ...initial(), customStartDate: '2026-01-01', customEndDate: '2026-01-31' };
    const stillCustom = adminAuditReducer(custom, { type: 'setTimePreset', value: 'custom', defaultRange: RANGE });
    expect(stillCustom.customStartDate).toBe('2026-01-01');
    const preset = adminAuditReducer(custom, { type: 'setTimePreset', value: '7d', defaultRange: RANGE });
    expect([preset.timePreset, preset.customStartDate, preset.customEndDate]).toEqual(['7d', RANGE.startDate, RANGE.endDate]);
  });

  it('stores an action filter covering every action as no filter', () => {
    const next = adminAuditReducer(initial(), { type: 'setActionFilters', values: ['b', 'a'], allValues: ['a', 'b'] });
    expect(next.actionFilters).toEqual([]);
  });

  it('drops unknown actor and column values', () => {
    expect(adminAuditReducer(initial(), { type: 'setActorFilters', values: ['admin', 'robot'] }).actorFilters).toEqual(['admin']);
    expect(adminAuditReducer(initial(), { type: 'setVisibleColumns', values: [] }).visibleColumns).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it('never resizes a column below its minimum', () => {
    expect(adminAuditReducer(initial(), { type: 'setColumnWidth', columnId: 'diff', width: 10 }).columnWidths.diff).toBe(220);
    expect(adminAuditReducer(initial(), { type: 'setColumnWidth', columnId: 'diff', width: 401.6 }).columnWidths.diff).toBe(402);
    const unchanged = initial();
    expect(adminAuditReducer(unchanged, { type: 'setColumnWidth', columnId: 'when', width: 112 })).toBe(unchanged);
  });

  it('toggles rows and whole pages without touching other selections', () => {
    let state = adminAuditReducer(initial(), { type: 'toggleRow', entryKey: 'admin:x' });
    state = adminAuditReducer(state, { type: 'setPageSelected', entryKeys: ['admin:a', 'admin:b'], selected: true });
    expect(state.selectedEntryKeys).toEqual(['admin:x', 'admin:a', 'admin:b']);
    state = adminAuditReducer(state, { type: 'setPageSelected', entryKeys: ['admin:a', 'admin:b'], selected: false });
    expect(state.selectedEntryKeys).toEqual(['admin:x']);
    state = adminAuditReducer(state, { type: 'toggleRow', entryKey: 'admin:x' });
    expect(state.selectedEntryKeys).toEqual([]);
  });

  it('resets filters, columns, widths and selection but keeps the search', () => {
    const dirty: AdminAuditState = {
      ...initial(),
      search: 'ada',
      actionFilters: ['a'],
      targetFilters: ['trip'],
      actorFilters: ['user'],
      timePreset: 'all',
      visibleColumns: ['when'],
      columnWidths: { ...AUDIT_COLUMN_WIDTH_DEFAULTS, diff: 500 },
      selectedEntryKeys: ['admin:a'],
      offset: 50,
    };
    expect(adminAuditReducer(dirty, { type: 'resetFilters', defaultRange: RANGE })).toMatchObject({
      search: 'ada',
      actionFilters: [],
      targetFilters: [],
      actorFilters: [],
      timePreset: '30d',
      customStartDate: RANGE.startDate,
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      columnWidths: AUDIT_COLUMN_WIDTH_DEFAULTS,
      selectedEntryKeys: [],
      offset: 0,
    });
  });

  it('keeps one panel open at a time', () => {
    let state = adminAuditReducer(initial(), { type: 'openEntry', entryKey: 'admin:a-1' });
    expect(state.panel).toEqual({ kind: 'entry', entryKey: 'admin:a-1' });

    state = adminAuditReducer(state, { type: 'openTarget', log: log(), nowMs: NOW });
    expect(state.panel).toMatchObject({ kind: 'trip', log: { id: 'a-1' } });

    state = adminAuditReducer(state, { type: 'openTarget', log: log({ target_type: 'user', target_id: 'user-2' }), nowMs: NOW });
    expect(state.panel).toMatchObject({ kind: 'user', log: { target_id: 'user-2', target_type: 'user' } });

    state = adminAuditReducer(state, { type: 'openUser', userId: 'user-3', nowMs: NOW });
    expect(state.panel).toMatchObject({ kind: 'user', log: { id: `audit-actor-user-3-${NOW}`, action: 'audit.open_actor' } });
  });

  it('ignores targets without a sheet and a late close from a replaced panel', () => {
    const base = initial();
    expect(adminAuditReducer(base, { type: 'openTarget', log: log({ target_type: 'tier' }), nowMs: NOW })).toBe(base);
    expect(adminAuditReducer(base, { type: 'openTarget', log: log({ target_id: null }), nowMs: NOW })).toBe(base);

    const userOpen = adminAuditReducer(base, { type: 'openUser', userId: 'user-3', nowMs: NOW });
    expect(adminAuditReducer(userOpen, { type: 'closePanel', kind: 'entry' })).toBe(userOpen);
    expect(adminAuditReducer(userOpen, { type: 'closePanel', kind: 'user' }).panel).toEqual({ kind: 'none' });
  });
});
