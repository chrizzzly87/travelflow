import { beforeEach, describe, expect, it } from 'vitest';
import { buildJourneySpecFromShapeWizard } from '../../shared/journeyShapeWizard';
import { buildTravelPlanningContext } from '../../shared/travelPlanningContext';
import {
  clearTravelPlanningContextMemoryCacheForTests,
  loadTravelPlanningContext,
  normalizeTravelPlanningContext,
} from '../../services/travelPlanningContextService';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';

const pack = getBundledTravelDestinationPack('TH');
if (!pack) throw new Error('Thailand test pack is unavailable.');

const spec = buildJourneySpecFromShapeWizard({
  journeyType: 'city_break',
  dateMode: 'flexible',
  durationDays: 4,
  month: 12,
  pace: 'balanced',
  interestTags: ['food', 'culture'],
  maxBaseChanges: 0,
  selectedCitySlug: 'th-bangkok',
  selectedNeighborhoodSlugs: ['th-bangkok-yaowarat'],
}, pack);

describe('travel planning context service', () => {
  beforeEach(() => clearTravelPlanningContextMemoryCacheForTests());

  it('returns the deterministic bundled context immediately when remote retrieval is disabled', async () => {
    const result = await loadTravelPlanningContext({
      spec,
      locale: 'de',
      networkPolicy: 'network-first',
    });

    expect(result.source).toBe('bundled');
    expect(result.loadDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.context.pack.dataset?.version).toBe('2026.07.18-v10');
    expect(result.context.pack.locale).toBe('de');
    expect(result.context.pack.templates.map((template) => template.templateKey)).toEqual([
      'th-bangkok-long-weekend',
      'th-bangkok-food-neighborhoods',
    ]);
  });

  it('normalizes the database context contract and rejects partial payloads', () => {
    const context = buildTravelPlanningContext(pack, spec);
    const normalized = normalizeTravelPlanningContext(structuredClone(context));

    expect(normalized).toEqual(context);
    expect(normalizeTravelPlanningContext({ ...context, retrieverVersion: 'unknown' })).toBeNull();
    expect(normalizeTravelPlanningContext({
      ...context,
      pack: { ...context.pack, entities: [] },
    })).toBeNull();
  });

  it('caches identical contexts without mutating their pinned query', async () => {
    const first = await loadTravelPlanningContext({ spec, locale: 'en', networkPolicy: 'network-first' });
    const second = await loadTravelPlanningContext({ spec, locale: 'en', networkPolicy: 'network-first' });

    expect(second.source).toBe('memory');
    expect(second.context.query).toEqual(first.context.query);
    expect(second.context.pack.dataset?.version).toBe(first.context.pack.dataset?.version);
  });
});
