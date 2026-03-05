import { describe, expect, it } from 'vitest';

describe('pages/AdminTripsPage module', () => {
  it('loads the page component without module errors', async () => {
    const module = await import('../../pages/AdminTripsPage');
    expect(typeof module.AdminTripsPage).toBe('function');
  });
});
