import { describe, expect, it } from 'vitest';
import { filterTimelineEntriesForExport } from '../../netlify/edge-functions/admin-audit-export';

describe('netlify/edge-functions/admin-audit-export filterTimelineEntriesForExport', () => {
  it('applies actor/action/target/search/date filters and sorts by newest first', () => {
    const now = Date.now();
    const within7Days = new Date(now - (2 * 24 * 60 * 60 * 1000)).toISOString();
    const outside7Days = new Date(now - (12 * 24 * 60 * 60 * 1000)).toISOString();

    const entries = [
      {
        source: 'admin',
        id: 'a-1',
        created_at: within7Days,
        action: 'admin.user.update_profile',
        target_type: 'user',
        target_id: 'user-1',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
      {
        source: 'user',
        id: 'u-2',
        created_at: new Date(now - (1 * 24 * 60 * 60 * 1000)).toISOString(),
        action: 'trip.updated',
        target_type: 'trip',
        target_id: 'trip-2',
        actor_user_id: 'user-2',
        actor_email: 'traveler@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
      {
        source: 'user',
        id: 'u-3',
        created_at: outside7Days,
        action: 'trip.updated',
        target_type: 'trip',
        target_id: 'trip-3',
        actor_user_id: 'user-3',
        actor_email: 'old@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
    ] as const;

    const filtered = filterTimelineEntriesForExport(entries as any, {
      searchToken: 'trip-2',
      dateRange: '7d',
      actionFilters: ['trip.updated'],
      targetFilters: ['trip'],
      actorFilters: ['user'],
      sourceLimit: 500,
    } as any);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('u-2');
  });

  it('returns all records for dateRange=all when no filters are set', () => {
    const entries = [
      {
        source: 'admin',
        id: 'a-1',
        created_at: '2026-01-01T00:00:00.000Z',
        action: 'admin.audit.export',
        target_type: 'audit',
        target_id: null,
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
      {
        source: 'user',
        id: 'u-1',
        created_at: '2026-02-01T00:00:00.000Z',
        action: 'trip.created',
        target_type: 'trip',
        target_id: 'trip-1',
        actor_user_id: 'user-1',
        actor_email: 'user@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
    ] as const;

    const filtered = filterTimelineEntriesForExport(entries as any, {
      searchToken: '',
      dateRange: 'all',
      actionFilters: [],
      targetFilters: [],
      actorFilters: [],
      sourceLimit: 500,
    } as any);

    expect(filtered.map((entry) => entry.id)).toEqual(['u-1', 'a-1']);
  });

  it('supports custom date range filtering with inclusive bounds', () => {
    const entries = [
      {
        source: 'user',
        id: 'in-range',
        created_at: '2026-02-14T12:00:00.000Z',
        action: 'trip.updated',
        target_type: 'trip',
        target_id: 'trip-10',
        actor_user_id: 'user-10',
        actor_email: 'user10@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
      {
        source: 'user',
        id: 'out-of-range',
        created_at: '2026-01-10T12:00:00.000Z',
        action: 'trip.updated',
        target_type: 'trip',
        target_id: 'trip-11',
        actor_user_id: 'user-11',
        actor_email: 'user11@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
    ] as const;

    const filtered = filterTimelineEntriesForExport(entries as any, {
      searchToken: '',
      dateRange: 'custom',
      customStartTs: Date.parse('2026-02-10T00:00:00.000Z'),
      customEndTs: Date.parse('2026-02-20T23:59:59.999Z'),
      actionFilters: [],
      targetFilters: [],
      actorFilters: [],
      selectedEventIds: [],
      sourceLimit: 500,
    } as any);

    expect(filtered.map((entry) => entry.id)).toEqual(['in-range']);
  });

  it('supports selected event id filtering with source-prefixed keys', () => {
    const entries = [
      {
        source: 'admin',
        id: 'evt-1',
        created_at: '2026-02-20T10:00:00.000Z',
        action: 'admin.trip.update',
        target_type: 'trip',
        target_id: 'trip-1',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
      {
        source: 'user',
        id: 'evt-2',
        created_at: '2026-02-20T11:00:00.000Z',
        action: 'trip.updated',
        target_type: 'trip',
        target_id: 'trip-2',
        actor_user_id: 'user-2',
        actor_email: 'user@example.com',
        metadata: null,
        before_data: null,
        after_data: null,
      },
    ] as const;

    const filtered = filterTimelineEntriesForExport(entries as any, {
      searchToken: '',
      dateRange: 'all',
      customStartTs: null,
      customEndTs: null,
      actionFilters: [],
      targetFilters: [],
      actorFilters: [],
      selectedEventIds: ['user:evt-2'],
      sourceLimit: 500,
    } as any);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('evt-2');
  });
});
