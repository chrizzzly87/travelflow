import { describe, expect, it } from 'vitest';
import { getExampleTemplateSummary, loadExampleTemplateFactory } from '../../data/exampleTripTemplates/runtimeFactory';

describe('example trip runtime factory', () => {
  it('loads the flexible Europe template with uncertain city options', async () => {
    const factory = await loadExampleTemplateFactory('europe-flex-options');
    expect(factory).toBeTypeOf('function');

    const createdTrip = factory?.('2026-06-01');
    expect(createdTrip).toBeDefined();

    const cityItems = (createdTrip?.items || []).filter((item) => item.type === 'city');
    const uncertainCities = cityItems.filter((item) => item.cityPlanStatus === 'uncertain');
    expect(uncertainCities).toHaveLength(2);
    expect(uncertainCities.every((item) => item.isApproved === false)).toBe(true);

    const groupIds = Array.from(new Set(uncertainCities.map((item) => item.cityPlanGroupId)));
    expect(groupIds).toEqual(['mediterranean-middle-leg']);

    const optionIndexes = uncertainCities
      .map((item) => item.cityPlanOptionIndex)
      .slice()
      .sort((a, b) => (a || 0) - (b || 0));
    expect(optionIndexes).toEqual([0, 1]);
  });

  it('returns a summary for the flexible Europe template', () => {
    const summary = getExampleTemplateSummary('europe-flex-options');
    expect(summary?.title).toBe('Mediterranean Forked Itinerary');
    expect(summary?.countries.map((country) => country.name)).toEqual(['Spain', 'Italy']);
  });
});
