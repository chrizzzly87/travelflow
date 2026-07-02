import { describe, expect, it } from 'vitest';
import {
  createTokenBucketLimiter,
  normalizeVoucherCode,
  shapeDiscountLookupData,
  RATE_LIMITED_MESSAGE,
  UNIFORM_INVALID_VOUCHER_MESSAGE,
} from '../../netlify/edge-lib/discount-lookup-guard';

describe('normalizeVoucherCode', () => {
  it('uppercases and trims valid voucher codes', () => {
    expect(normalizeVoucherCode(' spring20 ')).toBe('SPRING20');
    expect(normalizeVoucherCode('WELCOME-10')).toBe('WELCOME-10');
    expect(normalizeVoucherCode('summer_2026')).toBe('SUMMER_2026');
  });

  it('rejects non-string, empty, too-short, and too-long inputs', () => {
    expect(normalizeVoucherCode(null)).toBeNull();
    expect(normalizeVoucherCode(undefined)).toBeNull();
    expect(normalizeVoucherCode(42)).toBeNull();
    expect(normalizeVoucherCode('')).toBeNull();
    expect(normalizeVoucherCode('AB')).toBeNull();
    expect(normalizeVoucherCode('X'.repeat(33))).toBeNull();
    expect(normalizeVoucherCode('X'.repeat(32))).toBe('X'.repeat(32));
  });

  it('rejects codes with characters outside the allowlist', () => {
    expect(normalizeVoucherCode('SPRING 20')).toBeNull();
    expect(normalizeVoucherCode('CODE%')).toBeNull();
    expect(normalizeVoucherCode('CODE*')).toBeNull();
    expect(normalizeVoucherCode('<script>')).toBeNull();
    expect(normalizeVoucherCode('-LEADINGDASH')).toBeNull();
  });
});

describe('createTokenBucketLimiter', () => {
  it('allows bursts up to capacity and then rejects', () => {
    const limiter = createTokenBucketLimiter({ capacity: 3, refillIntervalMs: 60_000 });
    const now = 1_000_000;
    expect(limiter.tryConsume('ip:1.2.3.4', now)).toBe(true);
    expect(limiter.tryConsume('ip:1.2.3.4', now)).toBe(true);
    expect(limiter.tryConsume('ip:1.2.3.4', now)).toBe(true);
    expect(limiter.tryConsume('ip:1.2.3.4', now)).toBe(false);
    expect(limiter.tryConsume('ip:1.2.3.4', now + 1_000)).toBe(false);
  });

  it('tracks keys independently', () => {
    const limiter = createTokenBucketLimiter({ capacity: 1, refillIntervalMs: 60_000 });
    const now = 5_000;
    expect(limiter.tryConsume('ip:1.1.1.1', now)).toBe(true);
    expect(limiter.tryConsume('ip:1.1.1.1', now)).toBe(false);
    expect(limiter.tryConsume('ip:2.2.2.2', now)).toBe(true);
    expect(limiter.tryConsume('code:SPRING20', now)).toBe(true);
  });

  it('refills tokens over time', () => {
    const limiter = createTokenBucketLimiter({ capacity: 2, refillIntervalMs: 60_000 });
    const start = 0;
    expect(limiter.tryConsume('k', start)).toBe(true);
    expect(limiter.tryConsume('k', start)).toBe(true);
    expect(limiter.tryConsume('k', start)).toBe(false);
    // Half the refill interval restores half the capacity (1 token here).
    expect(limiter.tryConsume('k', start + 30_000)).toBe(true);
    expect(limiter.tryConsume('k', start + 30_000)).toBe(false);
    // A full interval later the bucket is full again.
    expect(limiter.tryConsume('k', start + 90_001)).toBe(true);
    expect(limiter.tryConsume('k', start + 90_001)).toBe(true);
    expect(limiter.tryConsume('k', start + 90_001)).toBe(false);
  });

  it('bounds the number of tracked keys', () => {
    const limiter = createTokenBucketLimiter({ capacity: 1, refillIntervalMs: 1_000, maxKeys: 10 });
    for (let index = 0; index < 200; index += 1) {
      limiter.tryConsume(`ip:10.0.0.${index}`, index * 5);
    }
    expect(limiter.size()).toBeLessThanOrEqual(11);
  });
});

describe('shapeDiscountLookupData', () => {
  it('keeps only the fields the checkout UI consumes', () => {
    const shaped = shapeDiscountLookupData({
      code: 'SPRING20',
      type: 'percentage',
      amount: 20,
      currencyCode: 'USD',
      applicableToTier: true,
      estimate: {
        originalAmount: 900,
        discountedAmount: 720,
        savingsAmount: 180,
        currencyCode: 'USD',
      },
    });

    expect(shaped).toEqual({
      code: 'SPRING20',
      type: 'percentage',
      amount: 20,
      currencyCode: 'USD',
      applicableToTier: true,
      estimate: {
        originalAmount: 900,
        discountedAmount: 720,
        savingsAmount: 180,
        currencyCode: 'USD',
      },
    });
    // Regression: internal Paddle metadata must never leak to the client.
    expect(Object.keys(shaped).sort()).toEqual([
      'amount',
      'applicableToTier',
      'code',
      'currencyCode',
      'estimate',
      'type',
    ]);
    expect(shaped).not.toHaveProperty('description');
    expect(shaped).not.toHaveProperty('maximumRecurringIntervals');
    expect(shaped).not.toHaveProperty('appliesToAllRecurring');
  });

  it('sanitizes malformed values and drops estimates for non-applicable tiers', () => {
    expect(shapeDiscountLookupData({
      code: 'FLAT5',
      type: '  ',
      amount: Number.NaN,
      currencyCode: '',
      applicableToTier: false,
      estimate: {
        originalAmount: 900,
        discountedAmount: 400,
        savingsAmount: 500,
        currencyCode: 'USD',
      },
    })).toEqual({
      code: 'FLAT5',
      type: null,
      amount: null,
      currencyCode: null,
      applicableToTier: false,
      estimate: null,
    });
  });
});

describe('uniform messaging', () => {
  it('exposes stable uniform copy for negative and throttled responses', () => {
    expect(UNIFORM_INVALID_VOUCHER_MESSAGE).toBe('Voucher code not found or not available for checkout.');
    expect(RATE_LIMITED_MESSAGE).toContain('Too many voucher lookups');
  });
});
