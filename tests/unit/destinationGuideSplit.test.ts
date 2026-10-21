import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  COUNTRY_GUIDE_SUMMARIES,
  getCountryGuideSummary,
  listCountryGuideSummaries,
} from '../../data/destinationGuideList';
import {
  MAX_DESTINATION_GUIDE_LIMIT,
  getCountryDestinationGuide,
  listDestinationGuides,
} from '../../services/destinationGuideService';
import { SPLIT_TARGETS, readDestinationGuides, renderSplit } from '../../scripts/split-destination-guides.mjs';

const dataDir = path.resolve(__dirname, '../../data');

describe('destination guide split', () => {
  it.each(Object.keys(SPLIT_TARGETS))('%s stays in sync with destinationGuides.json', (filename) => {
    // Regenerating must be a no-op. The monolith is the source of truth; an
    // import-destination-guides run has to be followed by a split run.
    expect(fs.readFileSync(path.join(dataDir, filename), 'utf8')).toBe(renderSplit(filename));
  });

  it('lists exactly the countries the monolith holds, in the same order', () => {
    const full = listDestinationGuides({ kind: 'country', limit: MAX_DESTINATION_GUIDE_LIMIT });
    expect(COUNTRY_GUIDE_SUMMARIES.map((summary) => summary.slug)).toEqual(full.map((guide) => guide.slug));
    expect(COUNTRY_GUIDE_SUMMARIES).toHaveLength(readDestinationGuides().selection.countryCount);
  });

  it('serves the same fields for every country the monolith serves', () => {
    for (const guide of listDestinationGuides({ kind: 'country', limit: MAX_DESTINATION_GUIDE_LIMIT })) {
      const summary = getCountryGuideSummary(guide.slug);
      expect(summary).toBeDefined();
      expect(summary).toEqual({
        id: guide.id,
        name: guide.name,
        slug: guide.slug,
        countryCode: guide.countryCode,
        region: guide.region,
        tags: guide.tags,
        ...(guide.priorityRank === undefined ? {} : { priorityRank: guide.priorityRank }),
        ...(guide.suggestedTripDays === undefined ? {} : { suggestedTripDays: guide.suggestedTripDays }),
        ...(guide.seasonality === undefined ? {} : { seasonality: guide.seasonality }),
      });
    }
  });

  it('resolves slugs, names and country codes exactly as the full service does', () => {
    for (const guide of listDestinationGuides({ kind: 'country', limit: MAX_DESTINATION_GUIDE_LIMIT })) {
      for (const lookup of [guide.slug, guide.name, guide.countryCode, guide.countryCode.toLowerCase(), ` ${guide.name} `]) {
        // Both lookups must land on the same guide, not merely on *a* guide.
        expect(getCountryGuideSummary(lookup)?.slug).toBe(getCountryDestinationGuide(lookup)?.slug);
      }
    }
    expect(getCountryGuideSummary('not-a-country')).toBeUndefined();
    expect(getCountryDestinationGuide('not-a-country')).toBeUndefined();
  });

  it('honours the same limit semantics as listDestinationGuides', () => {
    for (const limit of [1, 10, 52, MAX_DESTINATION_GUIDE_LIMIT]) {
      expect(listCountryGuideSummaries(limit).map((summary) => summary.slug))
        .toEqual(listDestinationGuides({ kind: 'country', limit }).map((guide) => guide.slug));
    }
  });

  it('drops the prose the list views never render', () => {
    const slice = JSON.parse(fs.readFileSync(path.join(dataDir, 'destinationGuideList.generated.json'), 'utf8'));
    const keys = new Set(slice.countries.flatMap((summary: Record<string, unknown>) => Object.keys(summary)));
    // The whole point of the slice: source links, events, airports, beaches and
    // highlights are ~80% of the monolith and belong only to the detail pages.
    // (Checked as keys, not as a substring — 'beaches' is also a tag value.)
    for (const field of ['sourceLinks', 'events', 'airports', 'beaches', 'highlights', 'facts', 'summary', 'reviewedAt', 'sourceUpdatedAt']) {
      expect(keys).not.toContain(field);
    }
    const sliceBytes = fs.statSync(path.join(dataDir, 'destinationGuideList.generated.json')).size;
    expect(sliceBytes).toBeLessThan(JSON.stringify(readDestinationGuides()).length / 10);
  });
});
