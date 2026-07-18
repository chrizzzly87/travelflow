import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeEnrichedTripFromTemplate,
  enrichTripSkeletonFromKnowledge,
  JOURNEY_KNOWLEDGE_ENRICHER_VERSION,
} from '../../services/journeyKnowledgeEnrichmentService';
import { buildTripSkeletonFromTemplate } from '../../services/journeySkeletonService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  applyTravelTemplateToJourneySpec,
  matchTravelTemplates,
} from '../../shared/travelTemplateMatcher';
import type { JourneySpec } from '../../shared/journeySpec';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');
const country = pack.entities.find((entity) => entity.canonicalSlug === 'thailand');
const bangkok = pack.entities.find((entity) => entity.canonicalSlug === 'th-bangkok');
if (!country || !bangkok) throw new Error('Thailand test entities are unavailable.');

const intent: JourneySpec = {
  version: 1,
  journeyType: 'city_break',
  countryCodes: ['TH'],
  dateWindow: { mode: 'flexible', durationDays: 4, months: [12] },
  durationDays: 4,
  places: [
    {
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
      locked: true,
    },
    {
      entity: {
        entityId: bangkok.entityId,
        canonicalSlug: bangkok.canonicalSlug,
        entityType: bangkok.entityType,
        countryCode: bangkok.countryCode,
        name: bangkok.name,
        resolution: 'canonical',
      },
      role: 'base',
      order: 1,
      locked: true,
    },
  ],
  constraints: { roundTrip: false, routeLocked: false, maxBaseChanges: 0, transportPreferences: [] },
  preferences: { pace: 'balanced', interestTags: ['food', 'culture'], vibeTags: [] },
  createdFrom: 'wizard_shape_v1',
};

const selectedRoute = () => {
  const match = matchTravelTemplates(intent, pack, { limit: 1 })[0];
  if (!match) throw new Error('Expected a Bangkok city-break template.');
  return {
    match,
    applied: applyTravelTemplateToJourneySpec(intent, pack, match.template),
  };
};

describe('journey knowledge enrichment service', () => {
  it('materializes ranked source-backed POIs into the editable trip without AI', () => {
    const { match, applied } = selectedRoute();
    const result = buildKnowledgeEnrichedTripFromTemplate(applied, pack, {
      now: new Date('2026-07-17T09:00:00Z'),
      tripId: 'trip-knowledge-enriched',
      knowledgeSource: 'bundled',
      match,
    });
    const rankedActivities = result.trip.items.filter((item) => (
      item.type === 'activity' && item.knowledgeMeta?.origin === 'knowledge_ranker'
    ));

    expect(result.trip.planningMeta).toMatchObject({
      routeStage: 'enriched',
      trace: {
        templateRankerVersion: 'travel-template-ranker-v1',
        knowledgeEnricherVersion: JOURNEY_KNOWLEDGE_ENRICHER_VERSION,
        knowledgeSource: 'bundled',
        matchedTemplateScore: match.score,
        knowledgeActivityCount: rankedActivities.length,
      },
    });
    expect(result.addedActivityCount).toBe(rankedActivities.length);
    expect(result.skeletonDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.enrichmentDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.compileDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.compileDurationMs).toBeCloseTo(
      result.skeletonDurationMs + result.enrichmentDurationMs,
      6,
    );
    expect(rankedActivities.length).toBeGreaterThan(0);
    expect(rankedActivities[0]).toMatchObject({
      coordinates: { lat: expect.any(Number), lng: expect.any(Number) },
      knowledgeMeta: {
        entity: { entityType: 'poi', resolution: 'canonical' },
        datasetVersion: '2026.07.18-v8',
        origin: 'knowledge_ranker',
        matchScore: expect.any(Number),
        sourceKeys: expect.arrayContaining(['tat_official']),
      },
    });
    expect(new Set(rankedActivities.map((item) => item.knowledgeMeta?.entity.canonicalSlug)).size)
      .toBe(rankedActivities.length);
    const grandPalace = result.trip.items.find((item) => (
      item.knowledgeMeta?.entity.canonicalSlug === 'th-bangkok-grand-palace'
    ));
    expect(grandPalace?.activityKnowledge).toMatchObject({
      version: 2,
      recommendedDuration: { value: { min: 120, max: 180, unit: 'minutes' } },
      openingHours: { support: { sourceKey: 'grand_palace_official' } },
      admission: { value: { currency: 'THB', adultForeign: 500 } },
      audience: [expect.objectContaining({
        value: expect.objectContaining({ audience: 'family', fit: 'conditional' }),
      })],
    });
    expect(grandPalace?.duration).toBeCloseTo(150 / 1_440, 6);
  });

  it('is idempotent once a skeleton has been enriched', () => {
    const { match, applied } = selectedRoute();
    const skeleton = buildTripSkeletonFromTemplate(applied, pack, { match });
    const enriched = enrichTripSkeletonFromKnowledge(skeleton, pack);

    expect(enrichTripSkeletonFromKnowledge(enriched, pack)).toBe(enriched);
  });

  it('refuses to combine route selection and enrichment from different dataset versions', () => {
    const { match, applied } = selectedRoute();
    const skeleton = buildTripSkeletonFromTemplate(applied, pack, { match });
    const mismatchedPack = {
      ...pack,
      dataset: pack.dataset ? { ...pack.dataset, version: 'future-version' } : null,
    };

    expect(() => enrichTripSkeletonFromKnowledge(skeleton, mismatchedPack)).toThrow(
      'same dataset version',
    );
  });
});
