import { describe, expect, it } from 'vitest';
import datasetJson from '../../data/travelKnowledge/thailand.v1.json';
import type { TravelKnowledgeDataset } from '../../scripts/travelKnowledgeDatasetUtils';

const dataset = datasetJson as TravelKnowledgeDataset;

const expectedPlanningAreaSlugs = [
  'th-chiang-rai-city-centre',
  'th-chiang-rai-rim-kok',
  'th-ayutthaya-historical-island',
  'th-ayutthaya-hua-ro-riverside',
  'th-sukhothai-old-city',
  'th-sukhothai-new-city',
  'th-kanchanaburi-river-khwae-road',
  'th-kanchanaburi-pak-phraek',
  'th-pattaya-central',
  'th-pattaya-jomtien',
  'th-pattaya-naklua-wong-amat',
  'th-hua-hin-centre',
  'th-hua-hin-khao-takiab',
  'th-pai-town-centre',
  'th-pai-mae-yen',
] as const;

describe('Thailand neighborhood coverage', () => {
  it('gives every supported city at least two directly selectable planning areas', () => {
    const cities = dataset.entities.filter((entity) => entity.entityType === 'city');
    const neighborhoods = dataset.entities.filter((entity) => entity.entityType === 'neighborhood');

    expect(cities).toHaveLength(15);
    for (const city of cities) {
      expect(
        neighborhoods.filter((neighborhood) => neighborhood.parentSlug === city.canonicalSlug).length,
        `${city.canonicalSlug} neighborhood count`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps new travel areas explicit, source-backed, and useful for base decisions', () => {
    const entitiesBySlug = new Map(dataset.entities.map((entity) => [entity.canonicalSlug, entity]));

    for (const slug of expectedPlanningAreaSlugs) {
      const area = entitiesBySlug.get(slug);
      expect(area, slug).toBeDefined();
      expect(area?.entityType, slug).toBe('neighborhood');
      expect(area?.latitude, slug).toEqual(expect.any(Number));
      expect(area?.longitude, slug).toEqual(expect.any(Number));
      expect(area?.profile?.summary, slug).toEqual(expect.any(String));
      expect(area?.sourceUrls?.[0], slug).toMatch(/^https:\/\/www\.tourismthailand\.org\//);
      expect(area?.sourceUrls?.[1], slug).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
      expect(area?.attributes?.planningArea, slug).toMatchObject({
        classification: 'editorial_travel_area',
        baseFit: expect.stringMatching(/^(primary|alternative|visit_only)$/),
        walkability: expect.stringMatching(/^(high|medium|low)$/),
        eveningEnergy: expect.stringMatching(/^(quiet|balanced|lively)$/),
        tradeoffs: expect.arrayContaining([expect.any(String)]),
        scopeNote: expect.stringContaining('not an administrative boundary'),
      });
    }
  });

  it('registers the OSM extract source used for geographic references', () => {
    expect(dataset.sources.find((source) => source.sourceKey === 'osm_geofabrik')).toMatchObject({
      sourceKind: 'open_data',
      licenseKey: 'ODbL-1.0',
      commercialUseAllowed: true,
      redistributionAllowed: true,
    });
  });
});
