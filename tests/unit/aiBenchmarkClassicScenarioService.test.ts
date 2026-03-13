import { describe, expect, it } from 'vitest';
import { buildClassicBenchmarkScenario } from '../../services/aiBenchmarkClassicScenarioService.ts';
import { normalizeBenchmarkMaskScenario } from '../../services/aiBenchmarkPreferencesService.ts';

describe('buildClassicBenchmarkScenario', () => {
  it('builds a fixed-order classic prompt from a route-locked benchmark scenario', () => {
    const scenario = normalizeBenchmarkMaskScenario({
      destinations: 'Munich, Salzburg, Vienna',
      dateInputMode: 'flex',
      startDate: '2026-04-10',
      endDate: '2026-04-24',
      flexWeeks: 1,
      flexWindow: 'summer',
      budget: 'Medium',
      pace: 'Balanced',
      notes: 'family museums, easy rail hops',
      specificCities: '',
      numCities: 3,
      roundTrip: false,
      routeLock: true,
      travelerSetup: 'family',
      tripStyleMask: 'culture_focused',
      transportMask: 'train',
    });

    const result = buildClassicBenchmarkScenario(scenario);

    expect(result.selectedDestinations).toEqual(['Munich', 'Salzburg', 'Vienna']);
    expect(result.generationOptions.destinationOrder).toEqual(['Munich', 'Salzburg', 'Vienna']);
    expect(result.generationOptions.routeLock).toBe(true);
    expect(result.generationOptions.numCities).toBe(3);
    expect(result.totalDays).toBe(7);
    expect(result.prompt).toContain('Destination order is fixed. Follow this order exactly: Munich -> Salzburg -> Vienna');
  });

  it('derives exact total days and specific cities from benchmark mask scenarios', () => {
    const scenario = normalizeBenchmarkMaskScenario({
      destinations: 'Portugal',
      dateInputMode: 'exact',
      startDate: '2026-06-03',
      endDate: '2026-06-10',
      flexWeeks: 1,
      flexWindow: 'summer',
      budget: 'Medium',
      pace: 'Balanced',
      notes: 'train-friendly pacing',
      specificCities: 'Lisbon, Porto',
      numCities: 2,
      roundTrip: false,
      routeLock: false,
      travelerSetup: 'couple',
      tripStyleMask: 'food_focused',
      transportMask: 'train',
    });

    const result = buildClassicBenchmarkScenario(scenario);

    expect(result.totalDays).toBe(8);
    expect(result.generationOptions.totalDays).toBe(8);
    expect(result.generationOptions.specificCities).toBe('Lisbon, Porto');
    expect(result.input.totalDays).toBe(8);
    expect(result.input.specificCities).toBe('Lisbon, Porto');
  });
});
