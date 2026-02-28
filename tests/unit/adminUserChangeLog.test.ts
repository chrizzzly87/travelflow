import { describe, expect, it } from 'vitest';
import type { AdminUserChangeRecord } from '../../services/adminService';
import {
  buildUserChangeDiffEntries,
  listUserChangeSecondaryActions,
  resolveUserChangeActionPresentation,
  resolveUserChangeSecondaryActions,
  summarizeTimelineDiffCoverage,
} from '../../services/adminUserChangeLog';

const makeRecord = (overrides: Partial<AdminUserChangeRecord> = {}): AdminUserChangeRecord => ({
  id: 'event-1',
  owner_user_id: 'user-1',
  owner_email: 'user@example.com',
  action: 'profile.updated',
  source: 'profile.settings',
  target_type: 'user',
  target_id: 'user-1',
  before_data: null,
  after_data: null,
  metadata: null,
  created_at: '2026-02-28T10:00:00.000Z',
  ...overrides,
});

describe('services/adminUserChangeLog', () => {
  it('builds profile diff entries from before/after snapshots and ignores noisy fields', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      before_data: {
        username: 'before_name',
        bio: '',
        updated_at: '2026-02-28T09:00:00.000Z',
      },
      after_data: {
        username: 'after_name',
        bio: 'new bio',
        updated_at: '2026-02-28T10:00:00.000Z',
      },
    }));

    expect(entries).toEqual([
      { key: 'bio', beforeValue: '', afterValue: 'new bio' },
      { key: 'username', beforeValue: 'before_name', afterValue: 'after_name' },
    ]);
  });

  it('derives trip status diff from archive metadata when no snapshots exist', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.archived',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        status_before: 'active',
        status_after: 'archived',
      },
    }));

    expect(entries).toEqual([
      { key: 'status', beforeValue: 'active', afterValue: 'archived' },
    ]);
  });

  it('labels profile updates with a single consistent profile pill', () => {
    const record = makeRecord({
      before_data: { username: 'old_name' },
      after_data: { username: 'new_name' },
      metadata: { changed_fields: ['username'] },
    });

    const diffEntries = buildUserChangeDiffEntries(record);
    const presentation = resolveUserChangeActionPresentation(record, diffEntries);

    expect(presentation).toEqual({
      label: 'Updated profile',
      className: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    });
  });

  it('maps canonical trip lifecycle actions to stable pills', () => {
    const created = resolveUserChangeActionPresentation(makeRecord({ action: 'trip.created' }), []);
    const updated = resolveUserChangeActionPresentation(makeRecord({ action: 'trip.updated' }), []);
    const deleted = resolveUserChangeActionPresentation(makeRecord({ action: 'trip.deleted' }), []);
    const archiveFailed = resolveUserChangeActionPresentation(makeRecord({ action: 'trip.archive_failed' }), []);
    const shared = resolveUserChangeActionPresentation(makeRecord({ action: 'trip.share_created' }), []);

    expect(created.label).toBe('Created trip');
    expect(updated.label).toBe('Updated trip');
    expect(deleted.label).toBe('Deleted trip');
    expect(archiveFailed.label).toBe('Archive failed');
    expect(shared.label).toBe('Shared trip');
  });

  it('derives trip update diff entries from trip event metadata', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        status_before: 'active',
        status_after: 'expired',
        title_before: 'Old title',
        title_after: 'New title',
        start_date_before: '2026-03-01',
        start_date_after: '2026-03-05',
      },
    }));

    expect(entries).toEqual([
      { key: 'status', beforeValue: 'active', afterValue: 'expired' },
      { key: 'title', beforeValue: 'Old title', afterValue: 'New title' },
      { key: 'start_date', beforeValue: '2026-03-01', afterValue: '2026-03-05' },
    ]);
  });

  it('prefers typed timeline diff details for version-based trip updates and skips after-only noise fields', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-1',
        version_label: 'Data: Changed transport type',
        status_after: 'active',
        source_kind_after: 'ai_benchmark',
        timeline_diff_v1: {
          schema: 'timeline_diff_v1',
          version: 1,
          transport_mode_changes: [
            {
              item_id: 'travel-1',
              title: 'Bangkok to Chiang Mai',
              before_mode: 'bus',
              after_mode: 'train',
            },
          ],
          deleted_items: [
            {
              item_id: 'activity-1',
              before: { id: 'activity-1', type: 'activity', title: 'Night market' },
              after: null,
            },
          ],
        },
      },
    }));

    expect(entries).toEqual([
      {
        key: 'transport_mode · Bangkok to Chiang Mai',
        beforeValue: 'bus',
        afterValue: 'train',
      },
      {
        key: 'deleted_activity · Night market',
        beforeValue: { id: 'activity-1', type: 'activity', title: 'Night market' },
        afterValue: null,
      },
    ]);
  });

  it('prefers timeline_diff_v1 over legacy timeline_diff when both are present', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-both',
        timeline_diff_v1: {
          schema: 'timeline_diff_v1',
          version: 1,
          transport_mode_changes: [
            {
              item_id: 'travel-v1',
              title: 'V1 Segment',
              before_mode: 'bus',
              after_mode: 'train',
            },
          ],
        },
        timeline_diff: {
          transport_mode_changes: [
            {
              item_id: 'travel-legacy',
              title: 'Legacy Segment',
              before_mode: 'boat',
              after_mode: 'plane',
            },
          ],
        },
      },
    }));

    expect(entries).toEqual([
      {
        key: 'transport_mode · V1 Segment',
        beforeValue: 'bus',
        afterValue: 'train',
      },
    ]);
  });

  it('falls back to legacy timeline_diff when v1 payload is absent', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-legacy-only',
        timeline_diff: {
          transport_mode_changes: [
            {
              item_id: 'travel-legacy',
              title: 'Legacy Segment',
              before_mode: 'boat',
              after_mode: 'plane',
            },
          ],
        },
      },
    }));

    expect(entries).toEqual([
      {
        key: 'transport_mode · Legacy Segment',
        beforeValue: 'boat',
        afterValue: 'plane',
      },
    ]);
  });

  it('derives visual-only diff entries from visual version labels when snapshots are unchanged', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-visual-1',
        version_label: 'Visual: Map view: minimal → clean · Timeline layout: vertical → horizontal',
        status_after: 'active',
      },
    }));

    expect(entries).toEqual([
      { key: 'visual_map_view', beforeValue: 'minimal', afterValue: 'clean' },
      { key: 'visual_timeline_layout', beforeValue: 'vertical', afterValue: 'horizontal' },
    ]);
  });

  it('derives secondary trip-update labels from diff entries', () => {
    const record = makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
    });
    const diffEntries = [
      { key: 'transport_mode · Bangkok to Chiang Mai', beforeValue: 'bus', afterValue: 'train' },
      { key: 'deleted_activity · Night market', beforeValue: { id: 'a1' }, afterValue: null },
      { key: 'visual_map_view', beforeValue: 'minimal', afterValue: 'clean' },
    ];

    const secondaryActions = resolveUserChangeSecondaryActions(record, diffEntries);

    expect(secondaryActions).toEqual([
      {
        key: 'transport_updated',
        label: 'Updated transport',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      },
      {
        key: 'deleted_activity',
        label: 'Deleted activity',
        className: 'border-rose-200 bg-rose-50 text-rose-800',
      },
      {
        key: 'trip_view',
        label: 'Updated trip view',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      },
    ]);
  });

  it('derives deleted segment secondary labels from legacy diff keys', () => {
    const record = makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
    });
    const diffEntries = [
      { key: 'deleted_travel-empty · Empty segment', beforeValue: { id: 'segment-1' }, afterValue: null },
    ];

    const secondaryActions = resolveUserChangeSecondaryActions(record, diffEntries);

    expect(secondaryActions).toEqual([
      {
        key: 'deleted_segment',
        label: 'Deleted segment',
        className: 'border-rose-200 bg-rose-50 text-rose-800',
      },
    ]);
  });

  it('does not create secondary labels for non trip-update actions', () => {
    const record = makeRecord({
      action: 'profile.updated',
      target_type: 'user',
      target_id: 'user-1',
    });
    const secondaryActions = resolveUserChangeSecondaryActions(record, [
      { key: 'username', beforeValue: 'old', afterValue: 'new' },
    ]);

    expect(secondaryActions).toEqual([]);
  });

  it('prefers metadata secondary_actions when present', () => {
    const record = makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        secondary_actions: [
          'trip.visibility.updated',
          'trip.segment.deleted',
          'trip.transport.updated',
          'trip.trip_dates.updated',
          'trip.view.updated',
          'trip.transport.updated',
        ],
      },
    });

    const secondaryActions = resolveUserChangeSecondaryActions(record, []);

    expect(secondaryActions).toEqual(expect.arrayContaining([
      {
        key: 'transport_updated',
        label: 'Updated transport',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      },
      {
        key: 'trip_dates_updated',
        label: 'Updated trip dates',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      },
      {
        key: 'trip_visibility_updated',
        label: 'Updated visibility',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      },
      {
        key: 'deleted_segment',
        label: 'Deleted segment',
        className: 'border-rose-200 bg-rose-50 text-rose-800',
      },
    ]));
    expect(secondaryActions).toHaveLength(4);
  });

  it('derives visibility/date/settings secondary labels from lifecycle metadata diffs', () => {
    const record = makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        title_before: 'Before',
        title_after: 'After',
        show_on_public_profile_before: false,
        show_on_public_profile_after: true,
        start_date_before: '2026-03-01',
        start_date_after: '2026-03-05',
      },
    });

    const secondaryActions = listUserChangeSecondaryActions(record);
    const keys = secondaryActions.map((entry) => entry.key);

    expect(keys).toContain('trip_settings_updated');
    expect(keys).toContain('trip_visibility_updated');
    expect(keys).toContain('trip_dates_updated');
  });

  it('lists secondary actions directly from a user-change record', () => {
    const record = makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-1',
        timeline_diff_v1: {
          schema: 'timeline_diff_v1',
          version: 1,
          deleted_items: [
            {
              item_id: 'activity-1',
              before: { id: 'activity-1', type: 'activity', title: 'Night market' },
              after: null,
            },
          ],
          visual_changes: [
            {
              field: 'map_view',
              before_value: 'minimal',
              after_value: 'clean',
            },
          ],
        },
      },
    });

    const actions = listUserChangeSecondaryActions(record);

    expect(actions).toEqual([
      {
        key: 'deleted_activity',
        label: 'Deleted activity',
        className: 'border-rose-200 bg-rose-50 text-rose-800',
      },
      {
        key: 'trip_view',
        label: 'Updated trip view',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
      },
    ]);
  });

  it('formats unknown actions into readable labels', () => {
    const record = makeRecord({
      action: 'trip.shared_link_rotated',
      target_type: 'trip',
      target_id: 'trip-1',
    });
    const presentation = resolveUserChangeActionPresentation(record, []);

    expect(presentation.label).toBe('Trip Shared Link Rotated');
  });

  it('summarizes timeline diff coverage for v1 and legacy-only rows', () => {
    const coverage = summarizeTimelineDiffCoverage([
      makeRecord({
        action: 'trip.updated',
        metadata: {
          timeline_diff_v1: {
            schema: 'timeline_diff_v1',
            version: 1,
            transport_mode_changes: [],
          },
        },
      }),
      makeRecord({
        action: 'trip.updated',
        metadata: {
          timeline_diff: {
            transport_mode_changes: [],
          },
        },
      }),
      makeRecord({
        action: 'profile.updated',
        metadata: {
          timeline_diff: {
            transport_mode_changes: [],
          },
        },
      }),
    ]);

    expect(coverage).toEqual({
      v1Rows: 1,
      legacyOnlyRows: 1,
    });
  });
});
