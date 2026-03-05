import { describe, expect, it } from 'vitest';

describe('create-trip variant page modules', () => {
  it('loads V1/V2/V3 modules without import errors', async () => {
    const [v1, v2, v3] = await Promise.all([
      import('../../pages/CreateTripV1Page'),
      import('../../pages/CreateTripV2Page'),
      import('../../pages/CreateTripV3Page'),
    ]);

    expect(typeof v1.CreateTripV1Page).toBe('function');
    expect(typeof v2.CreateTripV2Page).toBe('function');
    expect(typeof v3.CreateTripV3Page).toBe('function');
  });
});
