import { describe, expect, it } from 'vitest';
import { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin } from '../../services/simulatedLoginService';

describe('services/simulatedLoginService (node environment)', () => {
  it('manages in-memory override without browser storage', () => {
    expect(isSimulatedLoggedIn()).toBe(false);
    expect(setSimulatedLoggedIn(true)).toBe(true);
    expect(isSimulatedLoggedIn()).toBe(true);
    expect(toggleSimulatedLogin(false)).toBe(false);
  });
});
