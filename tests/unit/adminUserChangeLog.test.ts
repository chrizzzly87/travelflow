import { describe, expect, it } from 'vitest';
import type { AdminUserChangeRecord } from '../../services/adminService';
import {
  buildDiffEntryRenderKey,
  buildSecondaryFacetRenderKey,
  buildUserChangeDiffEntries,
  formatUserChangeDiffValue,
  resolveUserChangeActionPresentation,
  resolveUserChangeSecondaryFacets,
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

  it('ignores legacy timeline_diff payload when timeline_diff_v1 is present', () => {
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

  it('does not derive timeline entries from legacy timeline_diff when v1 is absent', () => {
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

    expect(entries).toEqual([]);
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

  it('normalizes deleted travel-empty timeline items into segment diff keys', () => {
    const entries = buildUserChangeDiffEntries(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        version_id: 'version-segment',
        timeline_diff_v1: {
          schema: 'timeline_diff_v1',
          version: 1,
          deleted_items: [
            {
              item_id: 'segment-1',
              before: { id: 'segment-1', type: 'travel-empty', title: 'Airport transfer' },
              after: null,
            },
          ],
        },
      },
    }));

    expect(entries).toEqual([
      {
        key: 'deleted_segment · Airport transfer',
        beforeValue: { id: 'segment-1', type: 'travel-empty', title: 'Airport transfer' },
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

  it('returns mapped secondary facets for trip.updated metadata secondary_action_codes', () => {
    const facets = resolveUserChangeSecondaryFacets(makeRecord({
      action: 'trip.updated',
      target_type: 'trip',
      target_id: 'trip-1',
      metadata: {
        secondary_action_codes: [
          'trip.transport.updated',
          'trip.activity.deleted',
          'trip.segment.deleted',
        ],
      },
    }));

    expect(facets).toEqual([
      expect.objectContaining({ code: 'trip.transport.updated', label: 'Transport updated' }),
      expect.objectContaining({ code: 'trip.activity.deleted', label: 'Activity deleted' }),
      expect.objectContaining({ code: 'trip.segment.deleted', label: 'Segment deleted' }),
    ]);
  });

  it('builds collision-safe render keys for duplicate diff entries and facets', () => {
    const duplicateDiffEntry = {
      key: 'transport_mode · Train Travel',
      beforeValue: 'bus',
      afterValue: 'train',
    };
    expect(buildDiffEntryRenderKey(duplicateDiffEntry, 0)).toBe('transport_mode · Train Travel::0');
    expect(buildDiffEntryRenderKey(duplicateDiffEntry, 1)).toBe('transport_mode · Train Travel::1');

    const duplicateFacet = {
      code: 'trip.transport.updated',
      label: 'Transport updated',
      className: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    };
    expect(buildSecondaryFacetRenderKey(duplicateFacet, 0)).toBe('trip.transport.updated::0');
    expect(buildSecondaryFacetRenderKey(duplicateFacet, 1)).toBe('trip.transport.updated::1');
  });

  it('formats structured deleted-item values without raw JSON fallback', () => {
    const entry = {
      key: 'deleted_activity · Night market',
      beforeValue: {
        id: 'activity-1',
        type: 'activity',
        title: 'Night market',
        start_date_offset: 2,
        duration: 1,
      },
      afterValue: null,
    };

    expect(formatUserChangeDiffValue(entry, entry.beforeValue)).toBe('activity · Night market · Day +2 · 1d');
    expect(formatUserChangeDiffValue(entry, entry.afterValue)).toBe('—');
  });
});
