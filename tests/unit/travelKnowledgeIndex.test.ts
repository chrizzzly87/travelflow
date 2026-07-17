import { describe, expect, it } from 'vitest';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  getTravelKnowledgeChildren,
  getTravelKnowledgeDescendants,
  getTravelKnowledgeIndex,
} from '../../shared/travelKnowledgeIndex';

describe('travel knowledge index', () => {
  const pack = getBundledTravelDestinationPack('TH')!;

  it('caches one index per immutable destination pack', () => {
    expect(getTravelKnowledgeIndex(pack)).toBe(getTravelKnowledgeIndex(pack));
  });

  it('resolves canonical entities by ID and slug', () => {
    const index = getTravelKnowledgeIndex(pack);
    const bangkok = index.bySlug.get('th-bangkok');

    expect(bangkok?.entityType).toBe('city');
    expect(bangkok?.entityId && index.byId.get(bangkok.entityId)).toBe(bangkok);
  });

  it('indexes direct neighborhoods and POIs nested beneath them', () => {
    const index = getTravelKnowledgeIndex(pack);
    const bangkok = index.bySlug.get('th-bangkok')!;
    const neighborhoods = getTravelKnowledgeChildren(index, bangkok.entityId!, 'neighborhood');
    const activities = getTravelKnowledgeDescendants(index, bangkok.entityId!, 'poi');

    expect(neighborhoods.map((entity) => entity.canonicalSlug)).toContain('th-bangkok-rattanakosin');
    expect(activities.map((entity) => entity.canonicalSlug)).toContain('th-bangkok-grand-palace');
  });
});
