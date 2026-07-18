import { describe, expect, it } from 'vitest';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import type { JourneySpec } from '../../shared/journeySpec';
import {
  applyTravelTemplateToJourneySpec,
  matchTravelTemplates,
} from '../../shared/travelTemplateMatcher';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const thailandCountry = pack.entities.find((entity) => entity.canonicalSlug === 'thailand');
if (!thailandCountry) throw new Error('Thailand country entity is unavailable.');

const buildIntent = (overrides: Partial<JourneySpec> = {}): JourneySpec => ({
  version: 1,
  journeyType: 'single_country_circuit',
  countryCodes: ['TH'],
  dateWindow: { mode: 'flexible', durationDays: 10, months: [11, 12] },
  durationDays: 10,
  places: [{
    entity: {
      entityId: thailandCountry.entityId,
      canonicalSlug: thailandCountry.canonicalSlug,
      entityType: thailandCountry.entityType,
      countryCode: thailandCountry.countryCode,
      name: thailandCountry.name,
      resolution: 'canonical',
    },
    role: 'country_scope',
    order: 0,
  }],
  constraints: {
    roundTrip: false,
    routeLocked: false,
    transportPreferences: ['train'],
  },
  preferences: {
    pace: 'balanced',
    interestTags: ['culture', 'history'],
    vibeTags: [],
  },
  createdFrom: 'wizard_shape_v1',
  ...overrides,
});

describe('travel template matcher', () => {
  it('only returns templates for the selected trip shape and ranks relevant fits first', () => {
    const matches = matchTravelTemplates(buildIntent(), pack, { limit: 3 });

    expect(matches).toHaveLength(3);
    expect(matches.every((match) => match.template.journeyType === 'single_country_circuit')).toBe(true);
    expect(matches[0]?.template.templateKey).toBe('th-heritage-to-north-circuit');
    expect(matches[0]?.reasons).toEqual(expect.arrayContaining(['duration_fit', 'pace_fit', 'season_fit', 'interest_fit']));
  });

  it('offers three distinct Bangkok city-break concepts for comparison', () => {
    const bangkok = pack.entities.find((entity) => entity.canonicalSlug === 'th-bangkok');
    if (!bangkok) throw new Error('Bangkok test entity is unavailable.');
    const cityBreak = buildIntent({
      journeyType: 'city_break',
      durationDays: 4,
      dateWindow: { mode: 'flexible', durationDays: 4, months: [12] },
      places: [
        ...buildIntent().places,
        {
          entity: {
            entityId: bangkok.entityId,
            canonicalSlug: bangkok.canonicalSlug,
            entityType: bangkok.entityType,
            countryCode: bangkok.countryCode,
            name: bangkok.name,
            resolution: 'canonical',
          },
          role: 'base',
          order: 1,
          locked: true,
        },
      ],
      preferences: { pace: 'balanced', interestTags: ['food', 'culture'], vibeTags: [] },
    });

    const matches = matchTravelTemplates(cityBreak, pack, { limit: 3 });
    expect(matches).toHaveLength(3);
    expect(matches.map((match) => match.template.templateKey)).toEqual(expect.arrayContaining([
      'th-bangkok-long-weekend',
      'th-bangkok-food-neighborhoods',
      'th-bangkok-river-slow',
    ]));
  });

  it('lets explicit route constraints exclude otherwise strong templates', () => {
    const chiangMai = pack.entities.find((entity) => entity.canonicalSlug === 'th-chiang-mai');
    if (!chiangMai) throw new Error('Chiang Mai test entity is unavailable.');
    const spec = buildIntent({
      constraints: {
        roundTrip: false,
        routeLocked: true,
        maxBaseChanges: 2,
        transportPreferences: ['train'],
      },
      places: [
        ...buildIntent().places,
        {
          entity: {
            entityId: chiangMai.entityId,
            canonicalSlug: chiangMai.canonicalSlug,
            entityType: chiangMai.entityType,
            countryCode: chiangMai.countryCode,
            name: chiangMai.name,
            resolution: 'canonical',
          },
          role: 'must_visit',
          order: 1,
          locked: true,
        },
      ],
    });

    const matches = matchTravelTemplates(spec, pack, { limit: 10 });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.template.stops.some((stop) => stop.entitySlug === 'th-chiang-mai'))).toBe(true);
    expect(matches.every((match) => match.template.stops.filter((stop) => stop.stopRole === 'base' && !stop.isOptional).length <= 3)).toBe(true);
  });

  it('removes templates containing an avoided place', () => {
    const phuket = pack.entities.find((entity) => entity.canonicalSlug === 'th-phuket');
    if (!phuket) throw new Error('Phuket test entity is unavailable.');
    const spec = buildIntent({
      places: [
        ...buildIntent().places,
        {
          entity: {
            entityId: phuket.entityId,
            canonicalSlug: phuket.canonicalSlug,
            entityType: phuket.entityType,
            countryCode: phuket.countryCode,
            name: phuket.name,
            resolution: 'canonical',
          },
          role: 'avoid',
          order: 1,
        },
      ],
    });

    const matches = matchTravelTemplates(spec, pack, { limit: 10 });
    expect(matches.some((match) => match.template.templateKey === 'th-first-timer-bangkok-north-beach')).toBe(false);
    expect(matches.some((match) => match.template.templateKey === 'th-andaman-island-circuit')).toBe(false);
  });

  it('compiles a chosen template to canonical route places and a traceable JourneySpec', () => {
    const spec = buildIntent();
    const match = matchTravelTemplates(spec, pack, { limit: 1 })[0];
    if (!match) throw new Error('Expected a matching Thailand template.');

    const applied = applyTravelTemplateToJourneySpec(spec, pack, match.template);
    const bases = applied.spec.places.filter((place) => place.role === 'base');

    expect(bases.length).toBeGreaterThanOrEqual(2);
    expect(bases.every((place) => place.entity.resolution === 'canonical' && place.entity.entityId)).toBe(true);
    expect(bases.reduce((sum, place) => sum + (place.nights ?? 0), 0)).toBe(10);
    expect(applied.unallocatedNights).toBe(0);
    expect(applied.overflowNights).toBe(0);
    expect(applied.spec.knowledgeContext).toEqual({
      datasetKey: 'thailand-core',
      datasetVersion: '2026.07.18-v13',
      templateKey: match.template.templateKey,
      templateVersion: match.template.version,
    });
  });

  it('preserves explicit traveler selections without marking template-added places as selected', () => {
    const bangkok = pack.entities.find((entity) => entity.canonicalSlug === 'th-bangkok');
    const yaowarat = pack.entities.find((entity) => entity.canonicalSlug === 'th-bangkok-yaowarat');
    const template = pack.templates.find((candidate) => candidate.templateKey === 'th-bangkok-long-weekend');
    if (!bangkok || !yaowarat || !template) throw new Error('Expected Bangkok selection fixtures.');
    const spec = buildIntent({
      journeyType: 'city_break',
      durationDays: 4,
      dateWindow: { mode: 'flexible', durationDays: 4, months: [12] },
      places: [
        ...buildIntent().places,
        {
          entity: {
            entityId: bangkok.entityId,
            canonicalSlug: bangkok.canonicalSlug,
            entityType: bangkok.entityType,
            countryCode: bangkok.countryCode,
            name: bangkok.name,
            resolution: 'canonical',
          },
          role: 'base',
          order: 1,
          locked: true,
        },
        {
          entity: {
            entityId: yaowarat.entityId,
            canonicalSlug: yaowarat.canonicalSlug,
            entityType: yaowarat.entityType,
            countryCode: yaowarat.countryCode,
            name: yaowarat.name,
            resolution: 'canonical',
          },
          role: 'must_visit',
          order: 2,
          locked: true,
        },
      ],
    });

    const applied = applyTravelTemplateToJourneySpec(spec, pack, template);
    const lockedSlugs = applied.spec.places
      .filter((place) => place.locked)
      .map((place) => place.entity.canonicalSlug);

    expect(lockedSlugs).toEqual(expect.arrayContaining(['th-bangkok', 'th-bangkok-yaowarat']));
    expect(lockedSlugs).not.toContain('th-bangkok-rattanakosin');
  });

  it('uses a stable template key tie-breaker', () => {
    const cityBreak = buildIntent({
      journeyType: 'city_break',
      durationDays: 4,
      dateWindow: { mode: 'flexible', durationDays: 4, months: [] },
      preferences: { pace: 'balanced', interestTags: [], vibeTags: [] },
    });
    const original = pack.templates[0];
    if (!original) throw new Error('Expected a template fixture.');
    const duplicatedPack = {
      ...pack,
      templates: [
        { ...original, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', templateKey: 'z-copy' },
        { ...original, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', templateKey: 'a-copy' },
      ],
    };

    expect(matchTravelTemplates(cityBreak, duplicatedPack, { limit: 2 }).map((match) => match.template.templateKey))
      .toEqual(['a-copy', 'z-copy']);
  });
});
