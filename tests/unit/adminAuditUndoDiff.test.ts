import { describe, expect, it } from 'vitest';
import {
  parseUndoParity,
  parseUndoRootSourceEventId,
  parseUndoSourceEventId,
  resolveUndoDiffEntries,
  resolveUndoParity,
} from '../../services/adminAuditUndoDiff';

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

  it('parses explicit undo root source id and parity metadata', () => {
    const log = {
      id: 'admin-0b',
      actor_user_id: 'admin',
      actor_email: 'admin@example.com',
      action: 'admin.trip.override_commit',
      target_type: 'trip',
      target_id: 'trip-1',
      before_data: null,
      after_data: null,
      metadata: {
        undo_root_source_event_id: 'root-source-event-id',
        undo_parity: 0,
      },
      created_at: new Date().toISOString(),
    };

    expect(parseUndoRootSourceEventId(log)).toBe('root-source-event-id');
    expect(parseUndoParity(log)).toBe(0);
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

  it('resolves parity via source chain when explicit parity metadata is missing', () => {
    const sourceEventId = 'source-user-event-3';
    const firstUndoEventId = 'admin-undo-10';
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
            metadata: { timeline_diff_v1: { changed_fields: ['title'] } },
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
            metadata: { label: `Audit undo ${sourceEventId}` },
            created_at: new Date().toISOString(),
          },
        },
      ],
    ]);

    expect(resolveUndoParity(timelineEntriesById.get(firstUndoEventId)!.log, timelineEntriesById)).toBe(1);

    const secondUndoLog = {
      id: 'admin-undo-11',
      actor_user_id: 'admin-1',
      actor_email: 'admin@example.com',
      action: 'admin.trip.override_commit',
      target_type: 'trip',
      target_id: 'trip-1',
      before_data: null,
      after_data: null,
      metadata: { label: `Audit undo ${firstUndoEventId}` },
      created_at: new Date().toISOString(),
    };

    expect(resolveUndoParity(secondUndoLog, timelineEntriesById)).toBe(0);
  });

  it('uses root source + parity metadata when intermediate undo source event is not loaded', () => {
    const rootSourceEventId = 'source-user-event-root';
    const timelineEntriesById = new Map<string, any>([
      [
        rootSourceEventId,
        {
          kind: 'user',
          log: {
            id: rootSourceEventId,
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

    const secondUndo = resolveUndoDiffEntries(
      {
        id: 'admin-undo-missing-chain',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        action: 'admin.trip.override_commit',
        target_type: 'trip',
        target_id: 'trip-1',
        before_data: null,
        after_data: null,
        metadata: {
          undo_source_event_id: 'missing-intermediate-admin-undo',
          undo_root_source_event_id: rootSourceEventId,
          undo_parity: 0,
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
