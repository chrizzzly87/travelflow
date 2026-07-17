import { describe, expect, it } from 'vitest';
import {
  compileTravelDestinationPack,
  deterministicTravelUuid,
  generateTravelKnowledgeSeedSql,
  sortTravelEntitiesByHierarchy,
  validateTravelKnowledgeDataset,
  type TravelKnowledgeDataset,
} from '../../scripts/travelKnowledgeDatasetUtils';

const dataset: TravelKnowledgeDataset = {
  manifest: {
    datasetKey: 'thailand-core',
    countryCode: 'TH',
    version: '2026.07.16-v1',
    generatedAt: '2026-07-16T10:00:00Z',
  },
  sources: [
    {
      sourceKey: 'travelflow_editorial',
      name: 'TravelFlow editorial',
      sourceKind: 'editorial',
      baseUrl: 'https://travelflowapp.netlify.app',
      commercialUseAllowed: true,
      redistributionAllowed: true,
    },
  ],
  tags: [
    {
      tagKey: 'city_break',
      tagGroup: 'trip_shape',
      label: 'City break',
      description: 'Suitable for a short city trip.',
    },
  ],
  entities: [
    {
      canonicalSlug: 'thailand',
      entityType: 'country',
      countryCode: 'TH',
      primaryName: 'Thailand',
      latitude: 15.87,
      longitude: 100.99,
      popularityScore: 90,
      hiddenGemScore: 10,
      tourismIntensityScore: 80,
      tagKeys: ['city_break'],
    },
    {
      canonicalSlug: 'th-bangkok',
      entityType: 'city',
      parentSlug: 'thailand',
      countryCode: 'TH',
      primaryName: 'Bangkok',
      latitude: 13.75,
      longitude: 100.5,
      popularityScore: 95,
      hiddenGemScore: 20,
      tourismIntensityScore: 95,
    },
    {
      canonicalSlug: 'th-ayutthaya',
      entityType: 'city',
      parentSlug: 'thailand',
      countryCode: 'TH',
      primaryName: 'Ayutthaya',
      latitude: 14.35,
      longitude: 100.57,
      popularityScore: 85,
      hiddenGemScore: 35,
      tourismIntensityScore: 70,
    },
    {
      canonicalSlug: 'th-bangkok-old-town',
      entityType: 'neighborhood',
      parentSlug: 'th-bangkok',
      countryCode: 'TH',
      primaryName: 'Old Town',
      latitude: 13.75,
      longitude: 100.49,
      popularityScore: 90,
      hiddenGemScore: 20,
      tourismIntensityScore: 90,
    },
    {
      canonicalSlug: 'th-bangkok-grand-palace',
      entityType: 'poi',
      parentSlug: 'th-bangkok-old-town',
      countryCode: 'TH',
      primaryName: 'Grand Palace',
      latitude: 13.75,
      longitude: 100.49,
      popularityScore: 99,
      hiddenGemScore: 5,
      tourismIntensityScore: 99,
    },
  ],
  templates: [
    {
      templateKey: 'th-bangkok-weekend',
      countryCode: 'TH',
      journeyType: 'city_break',
      minDays: 2,
      maxDays: 4,
      preferredPace: 'balanced',
      idealMonths: [11, 12, 1, 2],
      version: 1,
      copy: [{ locale: 'en', title: 'Bangkok weekend', summary: 'A short city trip.', highlights: [], tradeoffs: [] }],
      stops: [
        { entitySlug: 'th-bangkok', role: 'base', minNights: 2, maxNights: 4 },
        { entitySlug: 'th-ayutthaya', role: 'day_trip', minNights: 0, maxNights: 0 },
      ],
      legs: [{
        fromEntitySlug: 'th-bangkok',
        toEntitySlug: 'th-ayutthaya',
        legRole: 'day_trip',
        transportModes: ['train'],
        durationMinMinutes: 180,
        durationMaxMinutes: 240,
        roundTrip: true,
        sourceKey: 'travelflow_editorial',
      }],
      tags: [{ tagKey: 'city_break', weight: 1 }],
    },
  ],
};

describe('travel knowledge dataset tooling', () => {
  it('generates deterministic stable UUIDs', () => {
    expect(deterministicTravelUuid('entity:th-bangkok')).toBe(deterministicTravelUuid('entity:th-bangkok'));
    expect(deterministicTravelUuid('entity:th-bangkok')).not.toBe(deterministicTravelUuid('entity:th-phuket'));
  });

  it('accepts a valid hierarchical dataset', () => {
    const result = validateTravelKnowledgeDataset(dataset);
    expect(result.valid).toBe(true);
    expect(result.counts.entities).toBe(5);
    expect(result.counts.templates).toBe(1);
    expect(result.counts.templateLegs).toBe(1);
  });

  it('rejects a template whose required base has no descendant POI candidate', () => {
    const invalid: TravelKnowledgeDataset = {
      ...dataset,
      entities: dataset.entities.filter((entity) => entity.entityType !== 'poi'),
    };

    const result = validateTravelKnowledgeDataset(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Template th-bangkok-weekend required base th-bangkok has no descendant POI candidate.',
    );
  });

  it('rejects orphan entities and unsourced evidence tags', () => {
    const invalid: TravelKnowledgeDataset = {
      ...dataset,
      entities: [
        dataset.entities[0]!,
        {
          ...dataset.entities[1]!,
          parentSlug: 'missing-parent',
          evidenceTags: [{
            tagKey: 'city_break',
            sourceKey: 'missing-source',
            evidenceLevel: 'editorial',
            relevance: 0.5,
            evidenceNote: 'Missing source should fail.',
          }],
        },
      ],
    };
    const result = validateTravelKnowledgeDataset(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('unknown parent'))).toBe(true);
    expect(result.errors.some((error) => error.includes('unknown source'))).toBe(true);
  });

  it('sorts parents before children without depending on source-file order', () => {
    const ordered = sortTravelEntitiesByHierarchy([...dataset.entities].reverse());
    expect(ordered.map((entity) => entity.canonicalSlug)).toEqual([
      'thailand',
      'th-bangkok',
      'th-bangkok-old-town',
      'th-bangkok-grand-palace',
      'th-ayutthaya',
    ]);
  });

  it('resolves foreign keys through stable natural keys for repeatable imports', () => {
    const sql = generateTravelKnowledgeSeedSql(dataset);
    expect(sql).toContain("(select id from public.travel_entities where canonical_slug = 'th-bangkok')");
    expect(sql).toContain("(select id from public.travel_sources where source_key = 'travelflow_editorial')");
    expect(sql).toContain("(select id from public.travel_templates where template_key = 'th-bangkok-weekend')");
    expect(sql).toContain('insert into public.travel_template_legs');
  });

  it('compiles a browser-ready pack with canonical place IDs', () => {
    const pack = compileTravelDestinationPack(dataset);
    const bangkok = pack.entities.find((entity) => entity.canonicalSlug === 'th-bangkok');
    expect(pack.dataset?.entityCount).toBe(5);
    expect(bangkok?.resolution).toBe('canonical');
    expect(bangkok?.parentId).toBe(pack.entities[0]?.entityId);
    expect(pack.templates[0]?.stops[0]?.entityId).toBe(bangkok?.entityId);
    expect(pack.templates[0]?.legs[0]).toMatchObject({
      fromEntitySlug: 'th-bangkok',
      toEntitySlug: 'th-ayutthaya',
      transportModes: ['train'],
      roundTrip: true,
    });
  });
});
