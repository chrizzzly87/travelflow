import { describe, expect, it } from 'vitest';
import datasetJson from '../../data/travelKnowledge/thailand.v1.json';
import type { TravelKnowledgeDataset } from '../../scripts/travelKnowledgeDatasetUtils';

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
});
