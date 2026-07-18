import { describe, expect, it } from 'vitest';
import datasetJson from '../../data/travelKnowledge/thailand.v1.json';
import {
  compileTravelDestinationPack,
  type TravelKnowledgeDataset,
} from '../../scripts/travelKnowledgeDatasetUtils';
import { getTravelActivityKnowledgeCoverage } from '../../shared/travelActivityKnowledge';

const dataset = datasetJson as TravelKnowledgeDataset;

describe('Thailand route-template coverage', () => {
  it('gives every published city a directly selectable city-break template', () => {
    const citySlugs = dataset.entities
      .filter((entity) => entity.entityType === 'city')
      .map((entity) => entity.canonicalSlug)
      .sort();
    const coveredCitySlugs = new Set(
      dataset.templates
        .filter((template) => template.journeyType === 'city_break')
        .flatMap((template) => template.stops)
        .filter((stop) => stop.role === 'base' && !stop.isOptional)
        .map((stop) => stop.entitySlug),
    );

    expect(citySlugs.filter((citySlug) => !coveredCitySlugs.has(citySlug))).toEqual([]);
  });

  it('keeps each city-break concept anchored to exactly one required city base', () => {
    const citySlugs = new Set(
      dataset.entities
        .filter((entity) => entity.entityType === 'city')
        .map((entity) => entity.canonicalSlug),
    );

    for (const template of dataset.templates.filter((candidate) => candidate.journeyType === 'city_break')) {
      const requiredCityBases = template.stops.filter((stop) => (
        stop.role === 'base'
        && !stop.isOptional
        && citySlugs.has(stop.entitySlug)
      ));

      expect(requiredCityBases, template.templateKey).toHaveLength(1);
    }
  });

  it('provides at least three rich activity anchors for every supported city', () => {
    const entitiesBySlug = new Map(dataset.entities.map((entity) => [entity.canonicalSlug, entity]));
    const compiledEntitiesBySlug = new Map(
      compileTravelDestinationPack(dataset).entities.map((entity) => [entity.canonicalSlug, entity]),
    );
    const citySlugs = dataset.entities
      .filter((entity) => entity.entityType === 'city')
      .map((entity) => entity.canonicalSlug);

    const resolveCitySlug = (entitySlug: string): string | undefined => {
      let current = entitiesBySlug.get(entitySlug);
      while (current) {
        if (current.entityType === 'city') return current.canonicalSlug;
        current = current.parentSlug ? entitiesBySlug.get(current.parentSlug) : undefined;
      }
      return undefined;
    };

    const richActivityCountByCity = new Map(citySlugs.map((citySlug) => [citySlug, 0]));
    for (const entity of dataset.entities.filter((candidate) => candidate.entityType === 'poi')) {
      const citySlug = resolveCitySlug(entity.canonicalSlug);
      const compiledEntity = compiledEntitiesBySlug.get(entity.canonicalSlug);
      if (!citySlug || !compiledEntity) continue;

      const coverage = getTravelActivityKnowledgeCoverage(
        compiledEntity,
        new Date('2026-07-18T13:30:00Z'),
      );
      if (coverage?.status === 'rich') {
        richActivityCountByCity.set(citySlug, (richActivityCountByCity.get(citySlug) ?? 0) + 1);
      }
    }

    expect(
      [...richActivityCountByCity.entries()].filter(([, richActivityCount]) => richActivityCount < 3),
    ).toEqual([]);
  });
});
