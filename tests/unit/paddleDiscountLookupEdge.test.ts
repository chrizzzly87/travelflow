import { describe, expect, it } from 'vitest';
import { __paddleDiscountLookupInternals } from '../../netlify/edge-functions/paddle-discount-lookup';

describe('paddle discount lookup edge internals', () => {
  it('normalizes supported tier keys and voucher codes', () => {
    expect(__paddleDiscountLookupInternals.parseTierKey('tier_mid')).toBe('tier_mid');
    expect(__paddleDiscountLookupInternals.parseTierKey('tier_free')).toBeNull();
    expect(__paddleDiscountLookupInternals.normalizeCode(' spring20 ')).toBe('SPRING20');
  });

  it('checks whether a discount applies to the target price or product', () => {
    expect(__paddleDiscountLookupInternals.isDiscountApplicableToTarget({
      restrict_to: {
        prices: ['pri_mid'],
      },
    }, 'pri_mid', 'pro_mid')).toBe(true);

    expect(__paddleDiscountLookupInternals.isDiscountApplicableToTarget({
      restrict_to: {
        products: ['pro_mid'],
      },
    }, 'pri_other', 'pro_mid')).toBe(true);

    expect(__paddleDiscountLookupInternals.isDiscountApplicableToTarget({
      restrict_to: {
        prices: ['pri_other'],
      },
    }, 'pri_mid', 'pro_mid')).toBe(false);
  });

  it('matches discounts by exact redeemable code only', () => {
    expect(__paddleDiscountLookupInternals.findDiscountByCode([
      {
        code: 'SPRING20',
        description: 'Spring 20',
      },
    ], 'SPRING20')).toEqual({
      code: 'SPRING20',
      description: 'Spring 20',
    });
  });

  it('regression: never matches discounts by description (enumeration oracle)', () => {
    // Previously the lookup fell back to matching the code against discount
    // descriptions, letting unauthenticated callers enumerate internal
    // discount descriptions. Description-only records must not match.
    expect(__paddleDiscountLookupInternals.findDiscountByCode([
      {
        code: null,
        description: 'CHRISISTCOOL',
      },
      {
        code: 'OTHER10',
        description: 'SPRINGSALE',
      },
    ], 'CHRISISTCOOL')).toBeNull();

    expect(__paddleDiscountLookupInternals.findDiscountByCode([
      { code: 'OTHER10', description: 'SPRINGSALE' },
    ], 'SPRINGSALE')).toBeNull();
  });

  it('builds percentage and flat estimates from Paddle discount values', () => {
    expect(__paddleDiscountLookupInternals.buildEstimate({
      type: 'percentage',
      amount: 20,
    }, 900, 'USD')).toEqual({
      originalAmount: 900,
      discountedAmount: 720,
      savingsAmount: 180,
      currencyCode: 'USD',
    });

    expect(__paddleDiscountLookupInternals.buildEstimate({
      type: 'flat',
      amount: 300,
      currency_code: 'USD',
    }, 1900, 'USD')).toEqual({
      originalAmount: 1900,
      discountedAmount: 1600,
      savingsAmount: 300,
      currencyCode: 'USD',
    });
  });
});
