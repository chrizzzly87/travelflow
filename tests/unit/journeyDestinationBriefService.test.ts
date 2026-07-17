import { describe, expect, it } from 'vitest';
import { buildJourneyDestinationBriefs } from '../../services/journeyDestinationBriefService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import type { JourneySpec, JourneyPlaceSelection } from '../../shared/journeySpec';
import type { TravelEntityCatalogItem } from '../../shared/travelKnowledge';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const entity = (slug: string): TravelEntityCatalogItem => {
  const match = pack.entities.find((candidate) => candidate.canonicalSlug === slug);
  if (!match) throw new Error(`Missing test entity: ${slug}`);
  return match;
};

const place = (
  slug: string,
  role: JourneyPlaceSelection['role'],
  order: number,
): JourneyPlaceSelection => {
  const match = entity(slug);
  return {
    entity: {
      entityId: match.entityId,
      canonicalSlug: match.canonicalSlug,
      entityType: match.entityType,
      countryCode: match.countryCode,
      name: match.name,
      resolution: match.resolution,
    },
    role,
    order,
    locked: slug === 'th-bangkok-yaowarat',
  };
};

const spec: JourneySpec = {
  version: 1,
  journeyType: 'city_break',
  countryCodes: ['TH'],
  dateWindow: { mode: 'flexible', durationDays: 4, months: [12] },
  durationDays: 4,
  places: [
    place('thailand', 'country_scope', 0),
    place('th-bangkok', 'base', 1),
    place('th-bangkok-yaowarat', 'consider', 2),
  ],
  constraints: {
    roundTrip: false,
    routeLocked: true,
    maxBaseChanges: 0,
    transportPreferences: [],
  },
  preferences: {
    pace: 'balanced',
    interestTags: ['food', 'markets'],
    vibeTags: ['lively'],
  },
  knowledgeContext: {
    datasetKey: 'thailand-v1',
    datasetVersion: '2026.07.17-v7',
    templateKey: 'th-bangkok-long-weekend',
    templateVersion: 1,
  },
  createdFrom: 'wizard_shape_v1',
};

describe('journey destination brief service', () => {
  it('compiles only base-city context and preserves fact provenance', () => {
    const briefs = buildJourneyDestinationBriefs(spec, pack);

    expect(briefs).toHaveLength(1);
    expect(briefs[0]).toMatchObject({
      city: { canonicalSlug: 'th-bangkok', entityType: 'city' },
      summary: {
        support: {
          sourceKey: 'tat_official',
          confidence: 0.9,
          observedAt: '2026-07-17T15:46:00Z',
        },
      },
      relativeCostLevel: { value: 3, unit: '1_to_5' },
      recommendedStay: { value: { min: 2, max: 5 }, unit: 'days' },
    });
    expect(JSON.stringify(briefs).length).toBeLessThan(20_000);
  });

  it('pins traveler-selected neighborhoods and ranks candidates against preferences', () => {
    const [brief] = buildJourneyDestinationBriefs(spec, pack, { maxNeighborhoods: 3 });

    expect(brief?.neighborhoods).toHaveLength(3);
    expect(brief?.neighborhoods[0]).toMatchObject({
      entity: { canonicalSlug: 'th-bangkok-yaowarat' },
      selectedByTraveler: true,
    });
    expect(brief?.neighborhoods[0]?.tags).toEqual(expect.arrayContaining(['food', 'markets']));
  });

  it('keeps audience claims evidence-aware and resolves POIs nested below neighborhoods', () => {
    const [brief] = buildJourneyDestinationBriefs(spec, pack, { maxNeighborhoods: 7, maxActivities: 10 });
    const silom = brief?.neighborhoods.find((candidate) => candidate.entity.canonicalSlug === 'th-bangkok-silom');

    expect(brief?.activities.some((candidate) => candidate.entity.canonicalSlug === 'th-bangkok-grand-palace')).toBe(true);
    expect(silom?.audienceSignals).toContainEqual(expect.objectContaining({
      tagKey: 'lgbtq_scene',
      evidenceLevel: 'community',
      sourceKey: 'iglta_thailand',
      sourceUrl: 'https://www.iglta.org/destinations/asia-middle-east/thailand/',
    }));
    expect(silom?.tags).not.toContain('lgbtq_scene');
  });
});
