import { describe, expect, it } from 'vitest';
import { shouldUseAdminMockData } from '../../services/adminService';

describe('services/adminService mock mode guard', () => {
  it('prevents admin mock data in production runtime', () => {
    expect(shouldUseAdminMockData(false, true)).toBe(false);
  });

  it('enables admin mock data only for dev + simulated login', () => {
    expect(shouldUseAdminMockData(true, true)).toBe(true);
    expect(shouldUseAdminMockData(true, false)).toBe(false);
    expect(shouldUseAdminMockData(false, false)).toBe(false);
  });
});
