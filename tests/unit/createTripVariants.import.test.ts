import { describe, expect, it } from 'vitest';

describe('create-trip wizard page module', () => {
  it('loads the wizard module without import errors', async () => {
    const module = await import('../../pages/CreateTripV3Page');
    expect(typeof module.CreateTripV3Page).toBe('function');
  });
});
