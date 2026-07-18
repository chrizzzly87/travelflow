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

  it('projects source-backed operational fields for the final enriched market POI', () => {
    const knowledge = buildTravelActivityKnowledge(
      poi('th-hua-hin-night-market'),
      new Date('2026-07-18T00:00:00Z'),
    );

    expect(knowledge?.summary?.value).toContain('evening food and shopping stop');
    expect(knowledge?.recommendedDuration?.value).toEqual({ min: 60, max: 150, unit: 'minutes' });
    expect(knowledge?.openingHours?.value).toMatchObject({
      timezone: 'Asia/Bangkok',
      checkBeforeVisit: true,
    });
    expect(knowledge?.admission?.value).toMatchObject({ currency: 'THB', free: true });
    expect(knowledge?.transportAccess?.value.modes).toContain('walking');
    expect(knowledge?.coverage).toMatchObject({ status: 'rich', score: 100 });
  });

  it('projects current official visitor facts for the expanded Thailand route anchors', () => {
    const doiSuthep = buildTravelActivityKnowledge(
      poi('th-chiang-mai-doi-suthep'),
      new Date('2026-07-18T12:00:00Z'),
    );
    const hellfirePass = buildTravelActivityKnowledge(
      poi('th-kanchanaburi-hellfire-pass'),
      new Date('2026-07-18T12:00:00Z'),
    );

    expect(doiSuthep).toMatchObject({
      openingHours: { value: { timezone: 'Asia/Bangkok', checkBeforeVisit: true } },
      admission: { value: { currency: 'THB', adultForeign: 30 } },
      booking: { value: { mode: 'walk_in' } },
      coverage: { status: 'rich' },
    });
    expect(hellfirePass).toMatchObject({
      openingHours: { value: { lastEntry: '15:00', checkBeforeVisit: true } },
      admission: { value: { free: true } },
      physicalIntensity: { value: { level: 'variable' } },
      weatherDependency: { value: { level: 'high' } },
      coverage: { status: 'rich' },
    });
    expect(hellfirePass?.sourceKeys).toContain('australian_dva_hellfire_pass');
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

  it('keeps every Thailand activity on the rich category-specific contract', () => {
    const richSlugs = [
      'th-bangkok-grand-palace',
      'th-bangkok-wat-pho',
      'th-bangkok-wat-arun',
      'th-bangkok-chatuchak',
      'th-ayutthaya-historical-park',
      'th-sukhothai-historical-park',
      'th-chiang-mai-doi-inthanon',
      'th-kanchanaburi-erawan-falls',
      'th-chiang-mai-doi-suthep',
      'th-chiang-rai-white-temple',
      'th-chiang-rai-blue-temple',
      'th-ayutthaya-wat-mahathat',
      'th-sukhothai-si-satchanalai',
      'th-kanchanaburi-hellfire-pass',
      'th-kanchanaburi-river-khwae-bridge',
      'th-phuket-promthep-cape',
      'th-koh-samui-ang-thong',
      'th-pattaya-koh-larn',
    ];
    richSlugs.forEach((slug) => {
      expect(getTravelActivityKnowledgeCoverage(poi(slug))?.status).toBe('rich');
    });

    const statuses = pack.entities
      .filter((entity) => entity.entityType === 'poi')
      .map((entity) => getTravelActivityKnowledgeCoverage(entity)?.status);
    expect(statuses.filter((status) => status === 'rich')).toHaveLength(32);
    expect(statuses.filter((status) => status === 'usable')).toHaveLength(0);
    expect(statuses.filter((status) => status === 'starter')).toHaveLength(0);

    expect(getTravelActivityKnowledgeCoverage(poi('th-hua-hin-night-market'))).toMatchObject({
      category: 'market',
      planningTier: 'supporting',
      status: 'rich',
      score: 100,
      missingRequiredFactKeys: [],
      missingRecommendedFactKeys: [],
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
