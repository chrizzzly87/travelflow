import { describe, expect, it, vi } from 'vitest';
import {
  formatDisplayNameForGreeting,
  INTERNATIONAL_GREETINGS_CATALOG,
  pickRandomInternationalGreeting,
} from '../../data/internationalGreetingsCatalog';

describe('data/internationalGreetingsCatalog', () => {
  it('returns a deterministic greeting when random index is mocked', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const greeting = pickRandomInternationalGreeting();

    expect(greeting.id).toBe(INTERNATIONAL_GREETINGS_CATALOG[0].id);
    randomSpy.mockRestore();
  });

  it('formats names with locale-specific ordering', () => {
    expect(formatDisplayNameForGreeting('Haruto', 'Tanaka', 'Traveler', 'family_first')).toBe('Tanaka Haruto');
    expect(formatDisplayNameForGreeting('Mia', 'Lopez', 'Traveler', 'given_first')).toBe('Mia Lopez');
  });

  it('uses fallback name when first and last names are missing', () => {
    expect(formatDisplayNameForGreeting('', '', 'Traveler', 'family_first')).toBe('Traveler');
  });
});
