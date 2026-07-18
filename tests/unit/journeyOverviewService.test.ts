import { describe, expect, it } from 'vitest';
import type { ITrip } from '../../types';
import { buildJourneySpecFromShapeWizard } from '../../shared/journeyShapeWizard';
import { applyTravelTemplateToJourneySpec } from '../../shared/travelTemplateMatcher';
import { buildKnowledgeEnrichedTripFromTemplate } from '../../services/journeyKnowledgeEnrichmentService';
import { buildJourneyOverviewModel } from '../../services/journeyOverviewService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';

const pack = getBundledTravelDestinationPack('TH', 'en');
if (!pack) throw new Error('Thailand destination pack is unavailable.');

const buildTemplateTrip = (
  templateKey: string,
  journeyType: 'city_break' | 'hub_and_day_trips' | 'single_country_circuit',
  selectedCitySlug: string,
  durationDays: number,
): ITrip => {
  const spec = buildJourneySpecFromShapeWizard({
    journeyType,
    dateMode: 'flexible',
    durationDays,
    month: 1,
    pace: 'balanced',
    interestTags: ['food', 'culture', 'nature'],
    maxBaseChanges: journeyType === 'single_country_circuit' ? 3 : 0,
    selectedCitySlug,
    selectedNeighborhoodSlugs: [],
  }, pack);
  const template = pack.templates.find((candidate) => candidate.templateKey === templateKey);
  if (!template) throw new Error(`Template ${templateKey} is unavailable.`);
  const applied = applyTravelTemplateToJourneySpec(spec, pack, template);
  return buildKnowledgeEnrichedTripFromTemplate(applied, pack, {
    tripId: `overview-${templateKey}`,
    now: new Date('2026-11-10T12:00:00.000Z'),
    knowledgeSource: 'bundled',
    match: {
      score: 92,
      reasons: ['duration_fit', 'pace_fit'],
      tradeoffs: ['pace_adjustment'],
    },
  }).trip;
};

describe('journeyOverviewService', () => {
  it('builds a structured overview with canonical chapters, route load, briefs, and provenance', () => {
    const trip = buildTemplateTrip(
      'th-first-timer-bangkok-north-beach',
      'single_country_circuit',
      'th-bangkok',
      13,
    );
    const model = buildJourneyOverviewModel(trip);

    expect(model).toMatchObject({
      version: 1,
      source: 'structured',
      identity: {
        journeyType: 'single_country_circuit',
        durationDays: 13,
        pace: 'balanced',
      },
      summary: {
        baseCount: 3,
        transferCount: 2,
        openDecisionCount: 0,
      },
      provenance: {
        datasetVersion: '2026.07.18-v11',
        templateKey: 'th-first-timer-bangkok-north-beach',
        matchedTemplateScore: 92,
      },
    });
    expect(model.chapters.map((chapter) => chapter.entity?.canonicalSlug)).toEqual([
      'th-bangkok',
      'th-chiang-mai',
      'th-phuket',
    ]);
    expect(model.chapters[0]?.neighborhoods.length).toBeGreaterThan(0);
    expect(model.chapters[0]?.signatureDishes.length).toBeGreaterThan(0);
    expect(model.legs.every((leg) => leg.durationMinutes !== undefined)).toBe(true);
  });

  it('keeps day trips attached to their base chapter', () => {
    const trip = buildTemplateTrip(
      'th-chiang-mai-inthanon-hub',
      'hub_and_day_trips',
      'th-chiang-mai',
      5,
    );
    const model = buildJourneyOverviewModel(trip);

    expect(model.summary).toMatchObject({ baseCount: 1, dayTripCount: 1, transferCount: 0 });
    expect(model.chapters[0]?.dayTrips).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Doi Inthanon National Park', kind: 'day_trip' }),
    ]));
  });

  it('degrades legacy trips without hiding missing route evidence', () => {
    const legacyTrip: ITrip = {
      id: 'legacy-overview',
      title: 'Manual Thailand route',
      startDate: '2026-12-01',
      createdAt: 1,
      updatedAt: 1,
      items: [
        {
          id: 'legacy-bangkok',
          type: 'city',
          title: 'Bangkok',
          startDateOffset: 0,
          duration: 3,
          color: '#d97706',
          coordinates: { lat: 13.7563, lng: 100.5018 },
        },
        {
          id: 'legacy-transfer',
          type: 'travel',
          title: 'Travel to Chiang Mai',
          startDateOffset: 3,
          duration: 0.1,
          color: '#334155',
          transportMode: 'train',
        },
        {
          id: 'legacy-chiang-mai',
          type: 'city',
          title: 'Chiang Mai',
          startDateOffset: 3,
          duration: 4,
          color: '#0f766e',
          coordinates: { lat: 18.7883, lng: 98.9853 },
        },
      ],
    };
    const model = buildJourneyOverviewModel(legacyTrip);

    expect(model.source).toBe('legacy');
    expect(model.identity).toMatchObject({ journeyType: 'legacy', durationDays: 7 });
    expect(model.provenance).toBeUndefined();
    expect(model.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'legacy_trip',
      'transfer_metrics_missing',
    ]));
  });

  it('gives reused legacy travel item ids unique overview leg ids', () => {
    const legacyTrip: ITrip = {
      id: 'legacy-duplicate-travel-ids',
      title: 'Legacy Thailand route',
      startDate: '2026-12-01',
      createdAt: 1,
      updatedAt: 1,
      items: [
        { id: 'bangkok', type: 'city', title: 'Bangkok', startDateOffset: 0, duration: 3, color: '#f59e0b', coordinates: { lat: 13.7563, lng: 100.5018 } },
        { id: 'travel-5-1773407232863', type: 'travel', title: 'Travel', startDateOffset: 2.9, duration: 0.1, color: '#64748b', transportMode: 'train' },
        { id: 'ayutthaya', type: 'city', title: 'Ayutthaya', startDateOffset: 3, duration: 2, color: '#f97316', coordinates: { lat: 14.3532, lng: 100.5689 } },
        { id: 'travel-5-1773407232863', type: 'travel', title: 'Travel', startDateOffset: 4.9, duration: 0.1, color: '#64748b', transportMode: 'bus' },
        { id: 'sukhothai', type: 'city', title: 'Sukhothai', startDateOffset: 5, duration: 2, color: '#d97706', coordinates: { lat: 17.0056, lng: 99.8264 } },
      ],
    };

    const model = buildJourneyOverviewModel(legacyTrip);

    expect(model.legs.map((leg) => leg.id)).toEqual([
      'leg:travel-5-1773407232863',
      'leg:travel-5-1773407232863:leg-1',
    ]);
  });

  it('flags transfers that exceed the JourneySpec tolerance', () => {
    const trip = buildTemplateTrip(
      'th-first-timer-bangkok-north-beach',
      'single_country_circuit',
      'th-bangkok',
      13,
    );
    const firstTravel = trip.items.find((item) => item.type === 'travel');
    if (!firstTravel) throw new Error('Expected a transfer item.');
    firstTravel.routeDurationHours = 10;
    trip.planningMeta!.journeySpec.constraints.maxTransferMinutes = 360;

    const model = buildJourneyOverviewModel(trip);
    expect(model.legs[0]).toMatchObject({ load: 'heavy', exceedsTolerance: true, durationMinutes: 600 });
    expect(model.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'transfer_exceeds_tolerance', value: 600, limit: 360 }),
    ]));
  });
});
