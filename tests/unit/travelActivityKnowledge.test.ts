import { describe, expect, it } from 'vitest';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  buildTravelActivityKnowledge,
  getTravelActivityKnowledgeCoverage,
  getTravelActivityProfile,
  TRAVEL_ACTIVITY_KNOWLEDGE_VERSION,
  validateTravelActivityFactValue,
} from '../../shared/travelActivityKnowledge';

const pack = getBundledTravelDestinationPack('TH', 'en');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const poi = (slug: string) => {
  const entity = pack.entities.find((candidate) => candidate.canonicalSlug === slug);
  if (!entity) throw new Error(`Missing Thailand POI ${slug}.`);
  return entity;
};

describe('travel activity knowledge', () => {
  it('projects the rich Bangkok visitor contract with per-field provenance', () => {
    const knowledge = buildTravelActivityKnowledge(
      poi('th-bangkok-grand-palace'),
      new Date('2026-07-18T00:00:00Z'),
    );

    expect(knowledge).toMatchObject({
      version: TRAVEL_ACTIVITY_KNOWLEDGE_VERSION,
      entity: { canonicalSlug: 'th-bangkok-grand-palace', entityType: 'poi' },
      categories: expect.arrayContaining(['culture']),
      recommendedDuration: {
        value: { min: 120, max: 180, unit: 'minutes' },
        support: { sourceKey: 'travelflow_editorial' },
      },
      openingHours: {
        value: {
          timezone: 'Asia/Bangkok',
          lastEntry: '15:30',
          checkBeforeVisit: true,
        },
        support: {
          sourceKey: 'grand_palace_official',
          reviewStatus: 'verified',
          validUntil: '2026-08-16T13:45:00Z',
        },
      },
      admission: {
        value: { currency: 'THB', adultForeign: 500, checkBeforeVisit: true },
      },
      booking: { value: { mode: 'optional_advance' } },
      audience: [
        expect.objectContaining({
          value: expect.objectContaining({ audience: 'family', fit: 'conditional' }),
        }),
      ],
      freshness: {
        status: 'current',
        earliestValidUntil: '2026-08-16T13:45:00Z',
      },
    });
    expect(knowledge?.sourceKeys).toEqual(expect.arrayContaining([
      'grand_palace_official',
      'travelflow_editorial',
    ]));
  });

  it('marks the activity metadata expired after its earliest operational evidence expires', () => {
    const knowledge = buildTravelActivityKnowledge(
      poi('th-bangkok-grand-palace'),
      new Date('2026-08-17T00:00:00Z'),
    );

    expect(knowledge?.freshness.status).toBe('expired');
  });

  it('keeps sparse POIs usable without inventing unavailable operational fields', () => {
    const knowledge = buildTravelActivityKnowledge(
      poi('th-chiang-mai-doi-suthep'),
      new Date('2026-07-18T00:00:00Z'),
    );

    expect(knowledge?.summary?.value).toContain('mountain temple');
    expect(knowledge?.recommendedDuration).toBeUndefined();
    expect(knowledge?.openingHours).toBeUndefined();
    expect(knowledge?.admission).toBeUndefined();
  });

  it('persists a category and planning tier for every Thailand POI', () => {
    const pois = pack.entities.filter((entity) => entity.entityType === 'poi');
    const profiles = pois.map((entity) => getTravelActivityProfile(entity));

    expect(pois).toHaveLength(32);
    expect(profiles.every(Boolean)).toBe(true);
    expect(getTravelActivityProfile(poi('th-phuket-karon-viewpoint'))).toMatchObject({
      primaryCategory: 'viewpoint',
      planningTier: 'supporting',
      derivedFromTags: false,
    });
  });

  it('makes rich and starter coverage visually distinguishable without inventing facts', () => {
    const richSlugs = [
      'th-bangkok-grand-palace',
      'th-bangkok-wat-pho',
      'th-bangkok-wat-arun',
      'th-bangkok-chatuchak',
    ];
    richSlugs.forEach((slug) => {
      expect(getTravelActivityKnowledgeCoverage(poi(slug))?.status).toBe('rich');
    });

    expect(getTravelActivityKnowledgeCoverage(poi('th-koh-samui-ang-thong'))).toMatchObject({
      category: 'national_park',
      planningTier: 'anchor',
      status: 'starter',
      missingRequiredFactKeys: expect.arrayContaining([
        'visit.duration_minutes',
        'visit.weather_dependency',
        'visit.physical_intensity',
      ]),
    });
  });

  it('rejects malformed typed activity facts before they enter a published pack', () => {
    expect(validateTravelActivityFactValue('visit.duration_minutes', { min: 180, max: 60 }))
      .toContain('must be an object with finite min/max minutes and max >= min');
    expect(validateTravelActivityFactValue('opening_hours.regular', {
      timezone: 'Asia/Bangkok',
      schedule: [{ days: ['funday'], opens: '9', closes: '18:00' }],
    })).toContain('schedule entry 1 must include valid days, opens, and closes');
    expect(validateTravelActivityFactValue('visit.weather_dependency', { level: 'sometimes' }))
      .toContain('must include a supported weather-dependency level');
  });
});
