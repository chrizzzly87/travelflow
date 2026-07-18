import { describe, expect, it } from 'vitest';
import {
  getBundledTravelDestinationPack,
  isRemoteTravelKnowledgeEnabled,
  loadTravelDestinationPack,
  normalizeTravelDestinationPack,
} from '../../services/travelKnowledgeService';
import { getTravelActivityKnowledgeCoverage } from '../../shared/travelActivityKnowledge';

describe('travel knowledge service', () => {
  it('provides the versioned Thailand bundle immediately', () => {
    const pack = getBundledTravelDestinationPack('th');
    expect(pack?.dataset?.version).toBe('2026.07.18-v9');
    expect(pack?.entities).toHaveLength(84);
    expect(pack?.templates).toHaveLength(15);
    expect(pack?.entities.find((entity) => entity.canonicalSlug === 'th-bangkok')?.resolution).toBe('canonical');
  });

  it('keeps every route-template POI on the rich activity contract', () => {
    const pack = getBundledTravelDestinationPack('th');
    expect(pack).toBeDefined();

    const poiSlugs = new Set(
      pack?.templates.flatMap((template) => template.stops)
        .filter((stop) => stop.entityType === 'poi')
        .map((stop) => stop.entitySlug),
    );
    const routePois = pack?.entities.filter((entity) => poiSlugs.has(entity.canonicalSlug)) ?? [];

    expect(routePois.map((entity) => entity.canonicalSlug)).toEqual(expect.arrayContaining([
      'th-kanchanaburi-river-khwae-bridge',
      'th-koh-samui-ang-thong',
      'th-pattaya-koh-larn',
      'th-phuket-promthep-cape',
    ]));
    routePois.forEach((entity) => {
      expect(getTravelActivityKnowledgeCoverage(entity)).toMatchObject({ status: 'rich' });
    });
  });

  it('keeps remote reads feature-gated until the additive schema is deployed', () => {
    expect(isRemoteTravelKnowledgeEnabled).toBe(false);
  });

  it('serves the bundled pack on the fast path when remote knowledge is disabled', async () => {
    const result = await loadTravelDestinationPack({
      countryCode: 'TH',
      locale: 'de-DE',
      networkPolicy: 'cache-first',
    });

    expect(result.source).toBe('bundled');
    expect(result.loadDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.pack.dataset?.version).toBe('2026.07.18-v9');
    expect(result.pack.locale).toBe('de-de');
  });

  it('selects localized bundled template copy without duplicating the destination pack', () => {
    const germanPack = getBundledTravelDestinationPack('TH', 'de-DE');
    const englishPack = getBundledTravelDestinationPack('TH', 'es');

    expect(germanPack?.templates.find((template) => template.templateKey === 'th-bangkok-long-weekend')?.copy)
      .toMatchObject({ locale: 'de', title: 'Bangkok in vielen Facetten' });
    expect(englishPack?.templates.find((template) => template.templateKey === 'th-bangkok-long-weekend')?.copy.locale)
      .toBe('en');
  });

  it('normalizes the snake-case shape returned by the Supabase RPC', () => {
    const pack = normalizeTravelDestinationPack({
      countryCode: 'TH',
      locale: 'en',
      dataset: {
        dataset_key: 'thailand-core',
        country_code: 'TH',
        version: 'v-test',
        checksum: 'abc',
        entity_count: 1,
        fact_count: 1,
        template_count: 1,
        generated_at: '2026-07-16T00:00:00Z',
      },
      entities: [{
        id: '11111111-1111-4111-8111-111111111111',
        canonical_slug: 'th-bangkok',
        entity_type: 'city',
        country_code: 'TH',
        primary_name: 'Bangkok',
        parent_id: null,
        status: 'published',
        dataset_version: 'v-test',
        popularity_score: 99,
        hidden_gem_score: 10,
        tourism_intensity_score: 98,
        attributes: {},
        names: [{ locale: 'en', name: 'Bangkok', name_kind: 'primary', is_preferred: true }],
        facts: [{
          id: '22222222-2222-4222-8222-222222222222',
          fact_key: 'summary',
          value_json: 'City summary',
          sourceKey: 'tat_official',
          confidence: 0.9,
          review_status: 'verified',
          observed_at: '2026-07-16T00:00:00Z',
          metadata: {},
        }],
        tags: [{
          tag_key: 'food',
          sourceKey: 'travelflow_editorial',
          relevance: 0.8,
          evidence_level: 'editorial',
          metadata: {},
        }],
      }],
      templates: [{
        id: '33333333-3333-4333-8333-333333333333',
        template_key: 'th-bangkok-weekend',
        country_code: 'TH',
        journey_type: 'city_break',
        min_days: 3,
        max_days: 5,
        preferred_pace: 'balanced',
        ideal_months: [1, 2, 11, 12],
        dataset_version: 'v-test',
        version: 1,
        attributes: {},
        copy: { locale: 'en', title: 'Bangkok weekend', summary: 'Short break', highlights: [], tradeoffs: [] },
        stops: [{
          sequence: 0,
          entityId: '11111111-1111-4111-8111-111111111111',
          entitySlug: 'th-bangkok',
          entityName: 'Bangkok',
          entityType: 'city',
          stop_role: 'base',
          min_nights: 3,
          max_nights: 5,
          is_optional: false,
          notes: {},
        }],
        legs: [{
          sequence: 0,
          fromEntityId: '11111111-1111-4111-8111-111111111111',
          fromEntitySlug: 'th-bangkok',
          fromEntityName: 'Bangkok',
          toEntityId: '44444444-4444-4444-8444-444444444444',
          toEntitySlug: 'th-ayutthaya',
          toEntityName: 'Ayutthaya',
          leg_role: 'day_trip',
          transport_modes: ['train', 'unknown'],
          duration_min_minutes: 180,
          duration_max_minutes: 240,
          round_trip: true,
          sourceKey: 'travelflow_editorial',
          confidence: 0.72,
          observed_at: '2026-07-16T00:00:00Z',
          notes: {},
        }],
        tags: [{ tag_key: 'city_break', weight: 1 }],
      }],
    });

    expect(pack?.dataset?.entityCount).toBe(1);
    expect(pack?.entities[0]?.facts[0]?.valueJson).toBe('City summary');
    expect(pack?.entities[0]?.tags[0]?.evidenceLevel).toBe('editorial');
    expect(pack?.templates[0]?.stops[0]?.entitySlug).toBe('th-bangkok');
    expect(pack?.templates[0]?.legs[0]).toMatchObject({
      fromEntitySlug: 'th-bangkok',
      toEntitySlug: 'th-ayutthaya',
      transportModes: ['train'],
      roundTrip: true,
    });
  });

  it('rejects malformed packs instead of caching partial data', () => {
    expect(normalizeTravelDestinationPack({ countryCode: 'TH', entities: [] })).toBeNull();
  });
});
