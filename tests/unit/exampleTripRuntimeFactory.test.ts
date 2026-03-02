import { describe, expect, it } from 'vitest';
import { getExampleTemplateSummary, loadExampleTemplateFactory } from '../../data/exampleTripTemplates/runtimeFactory';

describe('data/exampleTripTemplates/runtimeFactory', () => {
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
    expect(createdTrip?.defaultView?.timelineMode).toBe('calendar');
  });

  it('returns a summary for the flexible Europe template', () => {
    const summary = getExampleTemplateSummary('europe-flex-options');
    expect(summary?.title).toBe('Mediterranean Forked Itinerary');
    expect(summary?.countries.map((country) => country.name)).toEqual(['Spain', 'Italy']);
  });

  it('loads the Husum Krokus weekend summary metadata', () => {
    const summary = getExampleTemplateSummary('husum-krokus-weekend');
    expect(summary).toBeTruthy();
    expect(summary?.title).toBe('Husum Krokusblütenfest Wochenende');
    expect(summary?.countries[0]?.name).toBe('Germany');
  });

  it('creates the Husum Krokus weekend example trip via runtime factory', async () => {
    const factory = await loadExampleTemplateFactory('husum-krokus-weekend');
    expect(typeof factory).toBe('function');

    const trip = factory?.('2026-03-13');
    expect(trip).toBeTruthy();
    expect(trip?.title).toBe('Husum Krokusblütenfest Wochenende');
    expect(trip?.startDate).toBe('2026-03-13');
    expect(trip?.items.length).toBeGreaterThan(2);
    expect(trip?.items.some((item) => item.type === 'city' && item.title === 'Husum')).toBe(true);
    expect(trip?.defaultView?.timelineMode).toBe('timeline');
  });
});
