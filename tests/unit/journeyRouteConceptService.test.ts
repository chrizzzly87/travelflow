import { describe, expect, it } from 'vitest';
import { buildJourneyRouteConcepts } from '../../services/journeyRouteConceptService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import { buildJourneySpecFromShapeWizard } from '../../shared/journeyShapeWizard';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const cityBreakSpec = buildJourneySpecFromShapeWizard({
  journeyType: 'city_break',
  dateMode: 'flexible',
  durationDays: 4,
  month: 12,
  pace: 'balanced',
  interestTags: ['food', 'culture'],
  maxBaseChanges: 0,
  selectedCitySlug: 'th-bangkok',
  selectedNeighborhoodSlugs: [],
}, pack);

describe('journey route concept service', () => {
  it('prepares three canonical route concepts for comparison', () => {
    const result = buildJourneyRouteConcepts(cityBreakSpec, pack, { limit: 3 });

    expect(result.concepts).toHaveLength(3);
    expect(result.failedTemplateCount).toBe(0);
    expect(result.attemptedTemplateCount).toBe(3);
    expect(result.concepts.every(({ applied }) => (
      applied.spec.places
        .filter((place) => place.role === 'base')
        .every((place) => place.entity.resolution === 'canonical')
    ))).toBe(true);
  });

  it('reports ranking, application, and total preparation time', () => {
    const timestamps = [10, 12.5, 16];
    const result = buildJourneyRouteConcepts(cityBreakSpec, pack, {
      limit: 3,
      measureNow: () => timestamps.shift() ?? 16,
    });

    expect(result.rankDurationMs).toBe(2.5);
    expect(result.applyDurationMs).toBe(3.5);
    expect(result.totalDurationMs).toBe(6);
  });

  it('returns an empty comparison when the shape has no matching templates', () => {
    const result = buildJourneyRouteConcepts({
      ...cityBreakSpec,
      journeyType: 'road_trip',
    }, pack);

    expect(result.concepts).toEqual([]);
    expect(result.attemptedTemplateCount).toBe(0);
    expect(result.failedTemplateCount).toBe(0);
  });
});
