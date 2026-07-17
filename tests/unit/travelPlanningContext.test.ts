import { describe, expect, it } from 'vitest';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  buildJourneySpecFromShapeWizard,
  type JourneyShapeWizardDraft,
} from '../../shared/journeyShapeWizard';
import {
  buildTravelPlanningContext,
  TRAVEL_PLANNING_CONTEXT_VERSION,
  TRAVEL_PLANNING_RETRIEVER_VERSION,
  validateTravelPlanningContext,
} from '../../shared/travelPlanningContext';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const cityBreakDraft: JourneyShapeWizardDraft = {
  journeyType: 'city_break',
  dateMode: 'flexible',
  durationDays: 4,
  month: 12,
  pace: 'balanced',
  interestTags: ['food', 'culture'],
  maxBaseChanges: 0,
  selectedCitySlug: 'th-bangkok',
  selectedNeighborhoodSlugs: ['th-bangkok-yaowarat'],
};

describe('travel planning context', () => {
  it('projects a version-pinned city-break context with canonical hierarchy and bounded POIs', () => {
    const spec = buildJourneySpecFromShapeWizard(cityBreakDraft, pack);
    const context = buildTravelPlanningContext(pack, spec, {
      locale: 'de',
      templateLimit: 3,
      neighborhoodLimitPerCity: 4,
      poiLimitPerCity: 4,
    });

    expect(context.version).toBe(TRAVEL_PLANNING_CONTEXT_VERSION);
    expect(context.retrieverVersion).toBe(TRAVEL_PLANNING_RETRIEVER_VERSION);
    expect(context.pack.dataset?.version).toBe('2026.07.17-v7');
    expect(context.pack.locale).toBe('de');
    expect(context.pack.templates).toHaveLength(2);
    expect(context.pack.templates.map((template) => template.templateKey)).toEqual([
      'th-bangkok-long-weekend',
      'th-bangkok-food-neighborhoods',
    ]);
    expect(context.pack.entities.map((entity) => entity.canonicalSlug)).toEqual(expect.arrayContaining([
      'thailand',
      'th-central',
      'th-bangkok',
      'th-bangkok-yaowarat',
    ]));
    expect(context.stats.selectedPoiCount).toBeLessThanOrEqual(4);
    expect(context.stats.selectedEntityCount).toBeLessThan(context.stats.sourceEntityCount);
    expect(validateTravelPlanningContext(context)).toEqual({ valid: true, errors: [] });
  });

  it.each([
    {
      label: 'hub and day trips',
      draft: {
        ...cityBreakDraft,
        journeyType: 'hub_and_day_trips' as const,
        durationDays: 5,
        selectedNeighborhoodSlugs: [],
        interestTags: ['culture', 'history'],
      },
    },
    {
      label: 'single-country circuit',
      draft: {
        ...cityBreakDraft,
        journeyType: 'single_country_circuit' as const,
        durationDays: 12,
        month: 11,
        maxBaseChanges: 4,
        selectedCitySlug: undefined,
        selectedNeighborhoodSlugs: [],
        interestTags: ['culture', 'food', 'nature'],
      },
    },
  ])('supports the $label shape with enough entities to compile every selected template', ({ draft }) => {
    const spec = buildJourneySpecFromShapeWizard(draft, pack);
    const context = buildTravelPlanningContext(pack, spec);

    expect(context.pack.templates.length).toBeGreaterThan(0);
    for (const template of context.pack.templates) {
      for (const stop of template.stops) {
        expect(context.pack.entities.some((entity) => entity.entityId === stop.entityId)).toBe(true);
      }
    }
    expect(validateTravelPlanningContext(context).valid).toBe(true);
  });

  it('respects avoided places before selecting route templates', () => {
    const spec = buildJourneySpecFromShapeWizard({
      ...cityBreakDraft,
      journeyType: 'single_country_circuit',
      durationDays: 12,
      selectedCitySlug: undefined,
      selectedNeighborhoodSlugs: [],
      maxBaseChanges: 4,
    }, pack);
    const phuket = pack.entities.find((entity) => entity.canonicalSlug === 'th-phuket');
    if (!phuket) throw new Error('Phuket fixture is unavailable.');
    spec.places.push({
      entity: {
        entityId: phuket.entityId,
        canonicalSlug: phuket.canonicalSlug,
        entityType: phuket.entityType,
        countryCode: phuket.countryCode,
        name: phuket.name,
        resolution: 'canonical',
      },
      role: 'avoid',
      order: spec.places.length,
      locked: true,
    });

    const context = buildTravelPlanningContext(pack, spec, { templateLimit: 10 });

    expect(context.query.avoidedPlaceSlugs).toContain('th-phuket');
    expect(context.pack.templates.every((template) => (
      template.stops.every((stop) => stop.entitySlug !== 'th-phuket')
    ))).toBe(true);
  });

  it('expands one selected route into a deeper AI-ready context without returning unrelated templates', () => {
    const spec = buildJourneySpecFromShapeWizard({
      ...cityBreakDraft,
      journeyType: 'single_country_circuit',
      durationDays: 12,
      month: 11,
      maxBaseChanges: 4,
      selectedCitySlug: undefined,
      selectedNeighborhoodSlugs: [],
    }, pack);
    const comparison = buildTravelPlanningContext(pack, spec);
    const selectedTemplate = comparison.pack.templates[0]!;
    const deepContext = buildTravelPlanningContext(pack, spec, {
      templateKeys: [selectedTemplate.templateKey],
      neighborhoodLimitPerCity: 4,
      poiLimitPerCity: 6,
    });

    expect(deepContext.query.templateKeys).toEqual([selectedTemplate.templateKey]);
    expect(deepContext.pack.templates.map((template) => template.templateKey)).toEqual([
      selectedTemplate.templateKey,
    ]);
    expect(deepContext.stats.selectedPoiCount).toBeGreaterThan(comparison.stats.selectedPoiCount / 3);
    expect(new TextEncoder().encode(JSON.stringify(deepContext)).byteLength).toBeLessThan(100_000);
  });

  it('keeps every initial Thailand context below the raw 100 KB retrieval budget', () => {
    const drafts: JourneyShapeWizardDraft[] = [
      cityBreakDraft,
      { ...cityBreakDraft, journeyType: 'hub_and_day_trips', durationDays: 5, selectedNeighborhoodSlugs: [] },
      {
        ...cityBreakDraft,
        journeyType: 'single_country_circuit',
        durationDays: 12,
        maxBaseChanges: 4,
        selectedCitySlug: undefined,
        selectedNeighborhoodSlugs: [],
      },
    ];

    for (const draft of drafts) {
      const context = buildTravelPlanningContext(pack, buildJourneySpecFromShapeWizard(draft, pack));
      const bytes = new TextEncoder().encode(JSON.stringify(context)).byteLength;
      expect(bytes, `${draft.journeyType} context bytes`).toBeLessThan(100_000);
    }
  });

  it('rejects dataset drift and missing template entities', () => {
    const context = buildTravelPlanningContext(pack, buildJourneySpecFromShapeWizard(cityBreakDraft, pack));
    const drifted = structuredClone(context);
    drifted.pack.entities[0]!.datasetVersion = 'different-version';
    drifted.pack.entities = drifted.pack.entities.filter((entity) => (
      entity.canonicalSlug !== drifted.pack.templates[0]!.stops[0]!.entitySlug
    ));
    drifted.stats.selectedEntityCount = drifted.pack.entities.length;

    const validation = validateTravelPlanningContext(drifted);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('different dataset version'),
      expect.stringContaining('references a missing context entity'),
    ]));
  });
});
