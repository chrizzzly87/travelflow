import { afterEach, describe, expect, it } from 'vitest';
import { __paddleWebhookInternals } from '../../netlify/edge-functions/paddle-webhook';

const ORIGINAL_DENO = (globalThis as typeof globalThis & {
  Deno?: { env?: { get: (key: string) => string | undefined } };
}).Deno;

const setWebhookSyncModeEnv = (value: string | null) => {
  const scope = globalThis as typeof globalThis & {
    Deno?: { env?: { get: (key: string) => string | undefined } };
  };

  scope.Deno = {
    env: {
      get: (key: string) => {
        if (key !== 'PADDLE_WEBHOOK_SYNC_MODE') return undefined;
        return value ?? undefined;
      },
    },
  };
};

describe('paddle webhook internals', () => {
  afterEach(() => {
    const scope = globalThis as typeof globalThis & {
      Deno?: { env?: { get: (key: string) => string | undefined } };
    };
    scope.Deno = ORIGINAL_DENO;
  });

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

  it('defaults webhook sync mode to full when env is unset', () => {
    setWebhookSyncModeEnv(null);
    expect(__paddleWebhookInternals.getWebhookSyncMode()).toBe('full');
  });

  it('enables verify_only webhook sync mode with case-insensitive env value', () => {
    setWebhookSyncModeEnv(' Verify_Only ');
    expect(__paddleWebhookInternals.getWebhookSyncMode()).toBe('verify_only');
  });
});
