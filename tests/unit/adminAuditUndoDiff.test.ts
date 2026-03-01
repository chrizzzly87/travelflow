import { describe, expect, it } from 'vitest';
import { parseUndoSourceEventId, resolveUndoDiffEntries } from '../../services/adminAuditUndoDiff';

describe('services/adminAuditUndoDiff', () => {
  it('prefers explicit undo source event id metadata', () => {
    const sourceId = parseUndoSourceEventId({
      id: 'admin-0',
      actor_user_id: 'admin',
      actor_email: 'admin@example.com',
      action: 'admin.trip.override_commit',
      target_type: 'trip',
      target_id: 'trip-1',
      before_data: null,
      after_data: null,
      metadata: {
        undo_source_event_id: 'from-explicit-key',
        label: 'Audit undo from-label',
      },
      created_at: new Date().toISOString(),
    });

    expect(sourceId).toBe('from-explicit-key');
  });

  it('parses source event id from legacy undo label metadata', () => {
    const sourceId = parseUndoSourceEventId({
      id: 'admin-1',
      actor_user_id: 'admin',
      actor_email: 'admin@example.com',
      action: 'admin.trip.override_commit',
      target_type: 'trip',
      target_id: 'trip-1',
      before_data: null,
      after_data: null,
      metadata: { label: 'Audit undo abc-123' },
      created_at: new Date().toISOString(),
    });

    expect(sourceId).toBe('abc-123');
  });

  it('builds inverted fine-grained diff entries from the source user event', () => {
    const sourceEventId = 'source-user-event-1';
    const timelineEntriesById = new Map<string, any>([
      [
        sourceEventId,
        {
          kind: 'user',
          log: {
            id: sourceEventId,
            owner_user_id: 'user-1',
            owner_email: 'user@example.com',
            action: 'trip.updated',
            source: 'trip.editor',
            target_type: 'trip',
            target_id: 'trip-1',
            before_data: null,
            after_data: null,
            metadata: {
              timeline_diff_v1: {
                transport_mode_changes: [
                  {
                    title: 'Plane Travel',
                    before_mode: 'train',
                    after_mode: 'plane',
                  },
                ],
              },
            },
            created_at: new Date().toISOString(),
          },
        },
      ],
    ]);

    const inverted = resolveUndoDiffEntries(
      {
        id: 'admin-undo-1',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        action: 'admin.trip.override_commit',
        target_type: 'trip',
        target_id: 'trip-1',
        before_data: null,
        after_data: null,
        metadata: {
          label: `Audit undo ${sourceEventId}`,
        },
        created_at: new Date().toISOString(),
      },
      timelineEntriesById
    );

    expect(inverted).toEqual([
      {
        key: 'transport_mode · Plane Travel',
        beforeValue: 'plane',
        afterValue: 'train',
      },
    ]);
  });

  it('resolves chained undo rows and preserves fine-grained parity', () => {
    const sourceEventId = 'source-user-event-2';
    const firstUndoEventId = 'admin-undo-1';
    const timelineEntriesById = new Map<string, any>([
      [
        sourceEventId,
        {
          kind: 'user',
          log: {
            id: sourceEventId,
            owner_user_id: 'user-1',
            owner_email: 'user@example.com',
            action: 'trip.updated',
            source: 'trip.editor',
            target_type: 'trip',
            target_id: 'trip-1',
            before_data: null,
            after_data: null,
            metadata: {
              timeline_diff_v1: {
                transport_mode_changes: [
                  {
                    title: 'Plane Travel',
                    before_mode: 'train',
                    after_mode: 'plane',
                  },
                ],
              },
            },
            created_at: new Date().toISOString(),
          },
        },
      ],
      [
        firstUndoEventId,
        {
          kind: 'admin',
          log: {
            id: firstUndoEventId,
            actor_user_id: 'admin-1',
            actor_email: 'admin@example.com',
            action: 'admin.trip.override_commit',
            target_type: 'trip',
            target_id: 'trip-1',
            before_data: null,
            after_data: null,
            metadata: {
              label: `Audit undo ${sourceEventId}`,
            },
            created_at: new Date().toISOString(),
          },
        },
      ],
    ]);

    const secondUndo = resolveUndoDiffEntries(
      {
        id: 'admin-undo-2',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        action: 'admin.trip.override_commit',
        target_type: 'trip',
        target_id: 'trip-1',
        before_data: null,
        after_data: null,
        metadata: {
          label: `Audit undo ${firstUndoEventId}`,
        },
        created_at: new Date().toISOString(),
      },
      timelineEntriesById
    );

    expect(secondUndo).toEqual([
      {
        key: 'transport_mode · Plane Travel',
        beforeValue: 'train',
        afterValue: 'plane',
      },
    ]);
  });
});
