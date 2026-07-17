import {
  TRAVEL_ENTITY_TYPE_VALUES,
  type TravelDestinationPack,
  type TravelEntityCatalogItem,
  type TravelEntityType,
} from './travelKnowledge';

export interface TravelKnowledgeIndex {
  byId: ReadonlyMap<string, TravelEntityCatalogItem>;
  bySlug: ReadonlyMap<string, TravelEntityCatalogItem>;
  byType: ReadonlyMap<TravelEntityType, readonly TravelEntityCatalogItem[]>;
  childrenByParentId: ReadonlyMap<string, readonly TravelEntityCatalogItem[]>;
  descendantsByAncestorId: ReadonlyMap<string, readonly TravelEntityCatalogItem[]>;
}

const indexCache = new WeakMap<TravelDestinationPack, TravelKnowledgeIndex>();

const appendEntity = (
  map: Map<string, TravelEntityCatalogItem[]>,
  key: string,
  entity: TravelEntityCatalogItem,
): void => {
  const entries = map.get(key);
  if (entries) entries.push(entity);
  else map.set(key, [entity]);
};

export const getTravelKnowledgeIndex = (pack: TravelDestinationPack): TravelKnowledgeIndex => {
  const cached = indexCache.get(pack);
  if (cached) return cached;

  const byId = new Map<string, TravelEntityCatalogItem>();
  const bySlug = new Map<string, TravelEntityCatalogItem>();
  const byType = new Map<TravelEntityType, TravelEntityCatalogItem[]>(
    TRAVEL_ENTITY_TYPE_VALUES.map((type) => [type, []]),
  );
  const childrenByParentId = new Map<string, TravelEntityCatalogItem[]>();
  const descendantsByAncestorId = new Map<string, TravelEntityCatalogItem[]>();

  for (const entity of pack.entities) {
    if (entity.entityId) byId.set(entity.entityId, entity);
    bySlug.set(entity.canonicalSlug, entity);
    byType.get(entity.entityType)!.push(entity);
    if (entity.parentId) appendEntity(childrenByParentId, entity.parentId, entity);
  }

  for (const entity of pack.entities) {
    const visited = new Set<string>();
    let ancestorId = entity.parentId;
    while (ancestorId && !visited.has(ancestorId)) {
      appendEntity(descendantsByAncestorId, ancestorId, entity);
      visited.add(ancestorId);
      ancestorId = byId.get(ancestorId)?.parentId ?? null;
    }
  }

  const index: TravelKnowledgeIndex = {
    byId,
    bySlug,
    byType,
    childrenByParentId,
    descendantsByAncestorId,
  };
  indexCache.set(pack, index);
  return index;
};

export const getTravelKnowledgeChildren = (
  index: TravelKnowledgeIndex,
  parentId: string,
  type?: TravelEntityType,
): readonly TravelEntityCatalogItem[] => {
  const children = index.childrenByParentId.get(parentId) ?? [];
  return type ? children.filter((entity) => entity.entityType === type) : children;
};

export const getTravelKnowledgeDescendants = (
  index: TravelKnowledgeIndex,
  ancestorId: string,
  type?: TravelEntityType,
): readonly TravelEntityCatalogItem[] => {
  const descendants = index.descendantsByAncestorId.get(ancestorId) ?? [];
  return type ? descendants.filter((entity) => entity.entityType === type) : descendants;
};
