import { describe, expect, it } from 'vitest';
import {
  FESTIVAL_CATALOG,
  FESTIVAL_REGION_ORDER,
  listFestivalMonths,
  listFestivalRegions,
} from '../../services/festivalCatalogService';
import { validateDestinationEventDates } from '../../shared/destinationGuides';
import { resolveNextOccurrence } from '../../services/festivalDateService';

describe('services/festivalCatalogService', () => {
  it('exposes a substantial, deduplicated catalogue', () => {
    expect(FESTIVAL_CATALOG.length).toBeGreaterThanOrEqual(30);
    expect(new Set(FESTIVAL_CATALOG.map((entry) => entry.id)).size).toBe(FESTIVAL_CATALOG.length);
  });

  it('excludes the generic per-country filler events', () => {
    const genericIds = new Set(['new-year-celebrations', 'national-day-celebrations', 'seasonal-cultural-events']);
    expect(FESTIVAL_CATALOG.some((entry) => genericIds.has(entry.event.id))).toBe(false);
  });

  it('gives every festival a researched recurrence and a valid month', () => {
    FESTIVAL_CATALOG.forEach((entry) => {
      expect(entry.event.recurrence?.kind, entry.id).toBeDefined();
      expect(entry.event.month, entry.id).toBeGreaterThanOrEqual(1);
      expect(entry.event.month, entry.id).toBeLessThanOrEqual(12);
      expect(entry.event.summary.length, entry.id).toBeGreaterThan(10);
    });
  });

  it('keeps every date field internally consistent', () => {
    FESTIVAL_CATALOG.forEach((entry) => {
      expect(validateDestinationEventDates(entry.event)).toEqual([]);
    });
  });

  it('only ships source URLs that are absolute https links', () => {
    FESTIVAL_CATALOG.forEach((entry) => {
      if (!entry.event.sourceUrl) return;
      expect(() => new URL(entry.event.sourceUrl as string), entry.id).not.toThrow();
      expect(entry.event.sourceUrl, entry.id).toMatch(/^https:\/\//);
    });
  });

  it('resolves an occurrence for every catalogue entry without inventing dates', () => {
    const now = new Date('2026-08-18T00:00:00Z');
    FESTIVAL_CATALOG.forEach((entry) => {
      const occurrence = resolveNextOccurrence(entry.event, now);
      if (occurrence.kind === 'exact') {
        // An exact date must be backed by real data, never by the resolver.
        const hasFixedDay = entry.event.day !== undefined || entry.event.startDay !== undefined;
        const hasKnownDate = Object.keys(entry.event.knownDates || {}).length > 0;
        expect(hasFixedDay || hasKnownDate, entry.id).toBe(true);
        expect(occurrence.endDate >= occurrence.date, entry.id).toBe(true);
      } else {
        expect(occurrence.month, entry.id).toBe(entry.event.month);
      }
    });
  });

  it('spans several continents and most of the calendar year', () => {
    expect(listFestivalRegions().length).toBeGreaterThanOrEqual(5);
    expect(listFestivalMonths().length).toBeGreaterThanOrEqual(10);
    listFestivalRegions().forEach((region) => expect(FESTIVAL_REGION_ORDER).toContain(region));
  });

  it('links festivals to a destination guide whenever one exists', () => {
    const withGuide = FESTIVAL_CATALOG.filter((entry) => entry.guideSlug);
    expect(withGuide.length).toBeGreaterThan(0);
    withGuide.forEach((entry) => expect(entry.guideSlug, entry.id).toMatch(/^[a-z0-9-]+$/));
  });
});
