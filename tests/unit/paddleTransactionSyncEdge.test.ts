import { describe, expect, it } from 'vitest';
import { __paddleTransactionSyncInternals } from '../../netlify/edge-functions/paddle-transaction-sync';

describe('paddle transaction sync edge internals', () => {
  it('parses supported Paddle transaction ids', () => {
    expect(__paddleTransactionSyncInternals.parseTransactionId(' txn_123abc ')).toBe('txn_123abc');
    expect(__paddleTransactionSyncInternals.parseTransactionId('sub_123')).toBeNull();
  });

  it('maps Paddle subscription status to synthetic webhook event types', () => {
    expect(__paddleTransactionSyncInternals.buildEventType('active')).toBe('subscription.activated');
    expect(__paddleTransactionSyncInternals.buildEventType('canceled')).toBe('subscription.canceled');
    expect(__paddleTransactionSyncInternals.buildEventType('past_due')).toBe('subscription.updated');
  });
});
