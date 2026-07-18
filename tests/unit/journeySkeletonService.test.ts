import { describe, expect, it } from 'vitest';
import { buildTripSkeletonFromTemplate, resolveJourneySkeletonStartDate } from '../../services/journeySkeletonService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import type { JourneySpec } from '../../shared/journeySpec';
import { applyTravelTemplateToJourneySpec, matchTravelTemplates } from '../../shared/travelTemplateMatcher';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');
const country = pack.entities.find((entity) => entity.canonicalSlug === 'thailand');
if (!country) throw new Error('Thailand country entity is unavailable.');

const intent: JourneySpec = {
  version: 1,
  journeyType: 'hub_and_day_trips',
  countryCodes: ['TH'],
  dateWindow: { mode: 'flexible', durationDays: 5, months: [11, 12] },
  durationDays: 5,
  places: [{
    entity: {
      entityId: country.entityId,
      canonicalSlug: country.canonicalSlug,
      entityType: country.entityType,
      countryCode: country.countryCode,
      name: country.name,
      resolution: 'canonical',
    },
    role: 'country_scope',
    order: 0,
  }],
  constraints: { roundTrip: false, routeLocked: false, maxBaseChanges: 0, transportPreferences: [] },
  preferences: { pace: 'balanced', interestTags: ['history'], vibeTags: [] },
  createdFrom: 'wizard_shape_v1',
};

describe('journey skeleton service', () => {
  it('uses exact dates and resolves flexible months to the next future window', () => {
    expect(resolveJourneySkeletonStartDate({
      ...intent,
      dateWindow: { mode: 'exact', startDate: '2026-09-10', endDate: '2026-09-15' },
    }, new Date('2026-07-16T00:00:00Z'))).toBe('2026-09-10');
    expect(resolveJourneySkeletonStartDate(intent, new Date('2026-07-16T00:00:00Z'))).toBe('2026-11-01');
  });

  it('creates an immediately editable map-and-timeline skeleton with provenance', () => {
    const match = matchTravelTemplates(intent, pack, { limit: 1 })[0];
    if (!match) throw new Error('Expected a hub template.');
    const applied = applyTravelTemplateToJourneySpec(intent, pack, match.template);
    const trip = buildTripSkeletonFromTemplate(applied, pack, {
      now: new Date('2026-07-16T00:00:00Z'),
      tripId: 'trip-skeleton-test',
      knowledgeSource: 'bundled',
      match,
      planningContext: {
        version: 1,
        retrieverVersion: 'structured-pack-v2',
        source: 'bundled',
        loadDurationMs: 8.5,
        rawBytes: 32_000,
        selectedEntityCount: 12,
        selectedTemplateCount: 1,
        selectedNeighborhoodCount: 4,
        selectedPoiCount: 6,
        aiCallCount: 0,
      },
    });

    expect(trip.id).toBe('trip-skeleton-test');
    expect(trip.startDate).toBe('2026-11-01');
    expect(trip.items.filter((item) => item.type === 'city')).toHaveLength(1);
    expect(trip.items.some((item) => item.type === 'activity' && item.coordinates)).toBe(true);
    expect(trip.items.find((item) => item.type === 'activity')?.description).toContain('round-trip transport');
    expect(trip.planningMeta).toMatchObject({
      routeStage: 'skeleton',
      datasetVersion: '2026.07.18-v13',
      templateKey: match.template.templateKey,
      templateVersion: 1,
      trace: {
        skeletonCompilerVersion: 'journey-skeleton-v1',
        templateRankerVersion: 'travel-template-ranker-v1',
        knowledgeSource: 'bundled',
        matchedTemplateScore: match.score,
        planningContext: {
          version: 1,
          retrieverVersion: 'structured-pack-v2',
          source: 'bundled',
          rawBytes: 32_000,
          aiCallCount: 0,
        },
      },
    });
    expect(trip.items.find((item) => item.type === 'city')?.knowledgeMeta).toMatchObject({
      entity: { canonicalSlug: 'th-bangkok', entityType: 'city' },
      datasetVersion: '2026.07.18-v13',
      origin: 'route_template',
      templateKey: match.template.templateKey,
    });
    const bangkokBrief = trip.planningMeta?.destinationBriefs.find((brief) => brief.city.canonicalSlug === 'th-bangkok');
    expect(bangkokBrief).toMatchObject({
      version: 1,
      datasetVersion: '2026.07.18-v13',
      signatureDishes: {
        value: expect.arrayContaining(['boat noodles', 'pad kra pao']),
        support: { sourceKey: 'travelflow_editorial' },
      },
      bestMonths: { value: [11, 12, 1, 2] },
    });
    expect(bangkokBrief?.neighborhoods).toHaveLength(4);
    expect(bangkokBrief?.activities.length).toBeGreaterThan(0);
    expect(bangkokBrief?.summary?.support.sourceUrl).toContain('tourismthailand.org');
  });

  it('uses template-leg transport ranges for an immediate circuit skeleton', () => {
    const circuitIntent: JourneySpec = {
      ...intent,
      journeyType: 'single_country_circuit',
      durationDays: 12,
      dateWindow: { mode: 'flexible', durationDays: 12, months: [12] },
      constraints: { ...intent.constraints, maxBaseChanges: 3 },
      preferences: { ...intent.preferences, interestTags: ['essential', 'culture', 'beaches'] },
    };
    const template = pack.templates.find((candidate) => candidate.templateKey === 'th-first-timer-bangkok-north-beach');
    if (!template) throw new Error('Expected the first-timer Thailand template.');
    const applied = applyTravelTemplateToJourneySpec(circuitIntent, pack, template);
    const trip = buildTripSkeletonFromTemplate(applied, pack, {
      now: new Date('2026-07-16T00:00:00Z'),
      tripId: 'trip-circuit-skeleton-test',
    });
    const travelItems = trip.items.filter((item) => item.type === 'travel');

    expect(travelItems).toHaveLength(2);
    expect(travelItems[0]).toMatchObject({
      transportMode: 'plane',
      routeDistanceKm: 600,
    });
    expect(travelItems[0]?.routeDurationHours).toBeCloseTo(4 / 3, 2);
    expect(travelItems[0]?.description).toContain('1–1.5 hours');
    expect(trip.planningMeta?.destinationBriefs.map((brief) => brief.city.canonicalSlug)).toEqual([
      'th-bangkok',
      'th-chiang-mai',
      'th-phuket',
    ]);
  });
});
