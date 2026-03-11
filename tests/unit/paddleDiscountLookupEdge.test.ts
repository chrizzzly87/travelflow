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

  it('matches discounts by code first and then by description for diagnostics', () => {
    expect(__paddleDiscountLookupInternals.findMatchingDiscount([
      {
        code: 'SPRING20',
        description: 'Spring 20',
      },
    ], 'SPRING20')).toEqual({
      discount: {
        code: 'SPRING20',
        description: 'Spring 20',
      },
      matchedBy: 'code',
    });

    expect(__paddleDiscountLookupInternals.findMatchingDiscount([
      {
        code: null,
        description: 'CHRISISTCOOL',
      },
    ], 'CHRISISTCOOL')).toEqual({
      discount: {
        code: null,
        description: 'CHRISISTCOOL',
      },
      matchedBy: 'description',
    });
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
