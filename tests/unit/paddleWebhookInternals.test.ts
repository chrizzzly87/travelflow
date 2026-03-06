import { describe, expect, it } from 'vitest';
import { __paddleWebhookInternals } from '../../netlify/edge-functions/paddle-webhook';

describe('paddle webhook internals', () => {
  it('coalesces the first valid ISO date', () => {
    expect(
      __paddleWebhookInternals.coalesceDate(
        null,
        'invalid',
        '2026-03-02T10:00:00Z',
        '2026-03-03T10:00:00Z',
      ),
    ).toBe('2026-03-02T10:00:00.000Z');
  });

  it('resolves missing occurred_at timestamps to current timestamp', () => {
    const nowIso = '2026-03-06T11:20:00.000Z';
    expect(__paddleWebhookInternals.resolveEventTimestamp(null, nowIso)).toBe(nowIso);
    expect(__paddleWebhookInternals.resolveEventTimestamp('2026-03-05T08:00:00Z', nowIso)).toBe('2026-03-05T08:00:00.000Z');
  });

  it('marks webhook events as stale when incoming event happened before last applied event', () => {
    expect(__paddleWebhookInternals.shouldIgnoreAsStale('2026-03-05T12:00:00Z', '2026-03-05T11:59:59Z')).toBe(true);
    expect(__paddleWebhookInternals.shouldIgnoreAsStale('2026-03-05T12:00:00Z', '2026-03-05T12:00:01Z')).toBe(false);
    expect(__paddleWebhookInternals.shouldIgnoreAsStale(null, '2026-03-05T12:00:01Z')).toBe(false);
  });
});
