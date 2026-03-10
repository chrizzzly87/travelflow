import { afterEach, describe, expect, it } from 'vitest';
import {
  markAuthBootstrapSettled,
  resetAuthBootstrapSuspenseForTests,
  suspendUntilAuthBootstrapSettles,
} from '../../services/authBootstrapSuspense';

describe('services/authBootstrapSuspense', () => {
  afterEach(() => {
    resetAuthBootstrapSuspenseForTests();
  });

  it('does not suspend once auth bootstrap is already settled', () => {
    expect(() => suspendUntilAuthBootstrapSettles(false)).not.toThrow();
  });

  it('reuses a single pending promise while auth is still loading', () => {
    let firstThrown: unknown;
    let secondThrown: unknown;

    try {
      suspendUntilAuthBootstrapSettles(true);
    } catch (error) {
      firstThrown = error;
    }

    try {
      suspendUntilAuthBootstrapSettles(true);
    } catch (error) {
      secondThrown = error;
    }

    expect(firstThrown).toBeInstanceOf(Promise);
    expect(secondThrown).toBe(firstThrown);
  });

  it('resolves the pending promise once bootstrap settles', async () => {
    let suspended: Promise<void> | null = null;

    try {
      suspendUntilAuthBootstrapSettles(true);
    } catch (error) {
      suspended = error as Promise<void>;
    }

    expect(suspended).not.toBeNull();

    markAuthBootstrapSettled();
    await expect(suspended).resolves.toBeUndefined();
    expect(() => suspendUntilAuthBootstrapSettles(false)).not.toThrow();
  });
});
