import { describe, expect, it } from 'vitest';
import type { AdminUserChangeRecord } from '../../services/adminService';
import {
  buildUserChangeDiffEntries,
  resolveUserChangeActionPresentation,
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
      },
    }));

    expect(entries).toEqual([
      { key: 'status', beforeValue: 'active', afterValue: 'expired' },
      { key: 'title', beforeValue: 'Old title', afterValue: 'New title' },
    ]);
  });

  it('prefers timeline diff details for version-based trip updates and skips after-only noise fields', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-1',
        version_label: 'Data: Changed transport type',
        status_after: 'active',
        source_kind_after: 'ai_benchmark',
        timeline_diff: {
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

  it('formats unknown actions into readable labels', () => {
    const record = makeRecord({
      action: 'trip.shared_link_rotated',
      target_type: 'trip',
      target_id: 'trip-1',
    });
    const presentation = resolveUserChangeActionPresentation(record, []);

    expect(presentation.label).toBe('Trip Shared Link Rotated');
  });
});
