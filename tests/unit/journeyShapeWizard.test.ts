import { describe, expect, it } from 'vitest';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  buildJourneySpecFromShapeWizard,
  getJourneyShapeAnchorCities,
  getJourneyShapeNeighborhoods,
  type JourneyShapeWizardDraft,
} from '../../shared/journeyShapeWizard';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const draft: JourneyShapeWizardDraft = {
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

describe('journey shape wizard contract', () => {
  it('offers only canonical cities backed by templates for each shape', () => {
    expect(getJourneyShapeAnchorCities(pack, 'city_break').map((entity) => entity.canonicalSlug))
      .toEqual(expect.arrayContaining(['th-bangkok', 'th-chiang-mai', 'th-phuket']));
    expect(getJourneyShapeAnchorCities(pack, 'hub_and_day_trips').map((entity) => entity.canonicalSlug))
      .toEqual(expect.arrayContaining(['th-bangkok', 'th-chiang-mai', 'th-koh-samui', 'th-pattaya', 'th-kanchanaburi']));
  });

  it('returns first-class neighborhoods belonging to the selected city', () => {
    const neighborhoods = getJourneyShapeNeighborhoods(pack, 'th-bangkok');
    expect(neighborhoods.length).toBeGreaterThan(5);
    expect(neighborhoods.every((entity) => entity.entityType === 'neighborhood')).toBe(true);
    expect(neighborhoods.some((entity) => entity.canonicalSlug === 'th-bangkok-yaowarat')).toBe(true);
  });

  it('builds canonical city and neighborhood intent instead of free-text place data', () => {
    const spec = buildJourneySpecFromShapeWizard(draft, pack);
    expect(spec.journeyType).toBe('city_break');
    expect(spec.durationDays).toBe(4);
    expect(spec.places.map((place) => [place.entity.canonicalSlug, place.role, place.locked])).toEqual([
      ['thailand', 'country_scope', true],
      ['th-bangkok', 'base', true],
      ['th-bangkok-yaowarat', 'must_visit', true],
    ]);
  });

  it('derives duration from exact dates and rejects invalid ranges', () => {
    const spec = buildJourneySpecFromShapeWizard({
      ...draft,
      dateMode: 'exact',
      startDate: '2026-12-02',
      endDate: '2026-12-06',
    }, pack);
    expect(spec.durationDays).toBe(4);
    expect(spec.dateWindow).toEqual({ mode: 'exact', startDate: '2026-12-02', endDate: '2026-12-06' });

    expect(() => buildJourneySpecFromShapeWizard({
      ...draft,
      dateMode: 'exact',
      startDate: '2026-12-06',
      endDate: '2026-12-02',
    }, pack)).toThrow('Exact trip end date must be after its start date.');
  });
});
