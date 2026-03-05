import { describe, expect, it } from 'vitest';

describe('components/CreateTripForm module', () => {
  it('loads the component without module errors', async () => {
    const module = await import('../../components/CreateTripForm');
    expect(typeof module.CreateTripForm).toBe('function');
  });
});
