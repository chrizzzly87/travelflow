import { describe, expect, it } from 'vitest';
import {
  buildAdminForensicsReplayBundle,
  downloadAdminForensicsReplayBundle,
} from '../../services/adminForensicsService';

describe('services/adminForensicsService', () => {
  it('builds a stable replay bundle sorted by timestamp with correlation groups', () => {
    const bundle = buildAdminForensicsReplayBundle([
      {
        source: 'user',
        id: 'evt-2',
        created_at: '2026-02-28T16:00:05.000Z',
        action: 'trip.updated',
        target_type: 'trip',
        target_id: 'trip-1',
        actor_user_id: 'user-1',
        actor_email: 'user@example.com',
        metadata: { correlation_id: 'corr-1' },
        before_data: null,
        after_data: null,
      },
      {
        source: 'admin',
        id: 'evt-1',
        created_at: '2026-02-28T16:00:00.000Z',
        action: 'admin.trip.update',
        target_type: 'trip',
        target_id: 'trip-1',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        metadata: { correlation_id: 'corr-1' },
        before_data: null,
        after_data: null,
      },
      {
        source: 'user',
        id: 'evt-3',
        created_at: '2026-02-28T16:00:06.000Z',
        action: 'trip.archive_failed',
        target_type: 'trip',
        target_id: 'trip-2',
        actor_user_id: 'user-2',
        actor_email: 'user2@example.com',
        metadata: { event_id: 'event-fallback' },
        before_data: null,
        after_data: null,
      },
    ], {
      generatedAtIso: '2026-02-28T16:15:00.000Z',
      filters: { actor: ['admin', 'user'] },
    });

    expect(bundle.schema).toBe('admin_forensics_replay_v1');
    expect(bundle.generated_at).toBe('2026-02-28T16:15:00.000Z');
    expect(bundle.filters).toEqual({ actor: ['admin', 'user'] });
    expect(bundle.events.map((event) => event.id)).toEqual(['evt-1', 'evt-2', 'evt-3']);
    expect(bundle.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(bundle.events.map((event) => event.correlation_id)).toEqual(['corr-1', 'corr-1', 'event-fallback']);
    expect(bundle.totals).toEqual({
      event_count: 3,
      correlation_count: 2,
    });
    expect(bundle.correlations).toEqual([
      {
        correlation_id: 'corr-1',
        event_ids: ['evt-1', 'evt-2'],
        actions: ['admin.trip.update', 'trip.updated'],
        first_seen_at: '2026-02-28T16:00:00.000Z',
        last_seen_at: '2026-02-28T16:00:05.000Z',
      },
      {
        correlation_id: 'event-fallback',
        event_ids: ['evt-3'],
        actions: ['trip.archive_failed'],
        first_seen_at: '2026-02-28T16:00:06.000Z',
        last_seen_at: '2026-02-28T16:00:06.000Z',
      },
    ]);
  });

  it('redacts configured fields for events with a redaction policy', () => {
    const bundle = buildAdminForensicsReplayBundle([
      {
        source: 'user',
        id: 'evt-redacted',
        created_at: '2026-02-28T16:00:00.000Z',
        action: 'trip.archive_failed',
        target_type: 'trip',
        target_id: 'trip-9',
        actor_user_id: 'user-9',
        actor_email: 'redact@example.com',
        metadata: {
          redaction_policy: 'mask-errors',
          error_message: 'Original backend message',
        },
        before_data: {
          error_message: 'Before payload message',
        },
        after_data: {
          error_message: 'After payload message',
        },
      },
    ]);

    expect(bundle.events[0]?.redaction_policy).toBe('mask-errors');
    expect(bundle.events[0]?.metadata.error_message).toBe('[redacted]');
    expect(bundle.events[0]?.before_data.error_message).toBe('[redacted]');
    expect(bundle.events[0]?.after_data.error_message).toBe('[redacted]');
  });

  it('returns false for download helper outside browser runtime', () => {
    const downloaded = downloadAdminForensicsReplayBundle({
      schema: 'admin_forensics_replay_v1',
      generated_at: '2026-02-28T16:00:00.000Z',
      filters: {},
      totals: {
        event_count: 0,
        correlation_count: 0,
      },
      events: [],
      correlations: [],
    }, 'admin-audit-replay.json');

    expect(downloaded).toBe(false);
  });
});
