import { describe, expect, it } from 'vitest';
import { __paddleCheckoutInternals } from '../../netlify/edge-functions/paddle-checkout';

describe('paddle checkout internals', () => {
  it('uses the sandbox API base URL for sandbox environment', () => {
    expect(__paddleCheckoutInternals.resolvePaddleApiBaseUrl('sandbox')).toBe('https://sandbox-api.paddle.com');
  });

  it('uses the live API base URL for live and unknown environments', () => {
    expect(__paddleCheckoutInternals.resolvePaddleApiBaseUrl('live')).toBe('https://api.paddle.com');
    expect(__paddleCheckoutInternals.resolvePaddleApiBaseUrl('staging')).toBe('https://api.paddle.com');
  });
});
