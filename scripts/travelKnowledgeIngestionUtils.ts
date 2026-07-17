import { createHash } from 'node:crypto';
import type { TravelKnowledgeDatasetEntity } from './travelKnowledgeDatasetUtils';

export interface GeoNamesRecord {
  geonameId: string;
  name: string;
  asciiName: string;
  alternateNames: string[];
  latitude: number;
  longitude: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  admin1Code: string;
  admin2Code: string;
  population: number;
  timezone: string;
  modifiedAt: string;
}

export interface GeoNamesCountryRecord {
  countryCode: string;
  name: string;
  capital: string;
  currencyCode: string;
  languages: string[];
  geonameId: string;
}

export interface GeoNamesEntityMatch {
  entity: TravelKnowledgeDatasetEntity;
  record: GeoNamesRecord | GeoNamesCountryRecord;
  distanceKm: number | null;
  confidence: number;
  matchedName: string;
}

export interface WikidataIdentity {
  geonameId: string;
  wikidataId: string;
  label?: string;
  localLabel?: string;
  latitude?: number;
  longitude?: number;
  revisionId?: number;
}

export interface TravelKnowledgeChangeCandidateDraft {
  countryCode: string;
  targetKind: 'entity';
  targetKey: string;
  fieldPath: string;
  changeKind: 'add' | 'update';
  previousValue: unknown | null;
  proposedValue: unknown;
  extractionMethod: 'structured_import' | 'deterministic_transform';
  confidence: number;
  severity: 'low' | 'moderate' | 'high';
  validationFindings: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

interface WikidataSparqlBinding {
  item?: { value?: unknown };
  geonames?: { value?: unknown };
}

interface WikidataSparqlResponse {
  results?: { bindings?: WikidataSparqlBinding[] };
}

interface WikidataEntityResponse {
  entities?: Record<string, {
    id?: unknown;
    lastrevid?: unknown;
    labels?: Record<string, { value?: unknown }>;
    claims?: Record<string, Array<{
      mainsnak?: {
        datavalue?: {
          value?: { latitude?: unknown; longitude?: unknown };
        };
      };
    }>>;
  }>;
}

const EARTH_RADIUS_KM = 6371;

const asFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export const sha256Hex = (value: string | Uint8Array): string => (
  createHash('sha256').update(value).digest('hex')
);

export const normalizeTravelPlaceName = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en')
  .replace(/\bkoh\b/g, 'ko')
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export const haversineDistanceKm = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number => {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

export const parseGeoNamesDump = (value: string, countryCode: string): GeoNamesRecord[] => {
  const records: GeoNamesRecord[] = [];
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split('\t');
    if (columns.length < 19 || columns[8] !== countryCode) continue;
    const latitude = asFiniteNumber(columns[4]);
    const longitude = asFiniteNumber(columns[5]);
    if (latitude === null || longitude === null) continue;
    records.push({
      geonameId: columns[0] || '',
      name: columns[1] || '',
      asciiName: columns[2] || '',
      alternateNames: (columns[3] || '').split(',').map((name) => name.trim()).filter(Boolean),
      latitude,
      longitude,
      featureClass: columns[6] || '',
      featureCode: columns[7] || '',
      countryCode: columns[8] || '',
      admin1Code: columns[10] || '',
      admin2Code: columns[11] || '',
      population: Math.max(0, asFiniteNumber(columns[14]) ?? 0),
      timezone: columns[17] || '',
      modifiedAt: columns[18] || '',
    });
  }
  return records;
};

export const parseGeoNamesCountryInfo = (
  value: string,
  countryCode: string,
): GeoNamesCountryRecord | null => {
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const columns = line.split('\t');
    if (columns[0] !== countryCode || columns.length < 17) continue;
    return {
      countryCode,
      name: columns[4] || '',
      capital: columns[5] || '',
      currencyCode: columns[10] || '',
      languages: (columns[15] || '').split(',').map((language) => language.trim()).filter(Boolean),
      geonameId: columns[16] || '',
    };
  }
  return null;
};

const getEntityNames = (entity: TravelKnowledgeDatasetEntity): string[] => {
  const values = [
    entity.primaryName,
    entity.localName,
    ...(entity.names ?? []).filter((name) => name.nameKind !== 'historic').map((name) => name.name),
  ].filter((name): name is string => Boolean(name?.trim()));
  return [...new Set(values.map(normalizeTravelPlaceName).filter(Boolean))];
};

const featurePreferenceScore = (entity: TravelKnowledgeDatasetEntity, record: GeoNamesRecord): number => {
  const placeKind = asString(entity.attributes?.placeKind);
  if (placeKind === 'island') {
    if (record.featureCode === 'ISL' || record.featureCode === 'ISLS') return 3;
    if (record.featureClass === 'P') return 1.5;
    return 0;
  }
  if (placeKind === 'island_province') {
    if (record.featureCode === 'ADM1') return 3;
    if (record.featureCode === 'ISL' || record.featureCode === 'ISLS') return 2.5;
    if (record.featureClass === 'P') return 1;
    return 0;
  }
  return record.featureClass === 'P' ? 3 : 0;
};

const scoreGeoNamesMatch = (
  entity: TravelKnowledgeDatasetEntity,
  record: GeoNamesRecord,
): { score: number; distanceKm: number; matchedName: string } | null => {
  const entityNames = new Set(getEntityNames(entity));
  const primaryNames = [record.name, record.asciiName].map(normalizeTravelPlaceName);
  const alternateNames = record.alternateNames.map(normalizeTravelPlaceName);
  const matchedName = primaryNames.find((name) => entityNames.has(name))
    ?? alternateNames.find((name) => entityNames.has(name));
  if (!matchedName || entity.latitude === undefined || entity.longitude === undefined) return null;

  const distanceKm = haversineDistanceKm(
    entity.latitude,
    entity.longitude,
    record.latitude,
    record.longitude,
  );
  if (distanceKm > 100) return null;

  const primaryMatch = primaryNames.includes(matchedName);
  const featureScore = featurePreferenceScore(entity, record);
  const score = (primaryMatch ? 5 : 4)
    + featureScore
    + Math.max(0, 2 - distanceKm / 25)
    + Math.min(1, Math.log10(record.population + 1) / 7);
  return { score, distanceKm, matchedName };
};

export const matchGeoNamesEntities = (
  entities: TravelKnowledgeDatasetEntity[],
  records: GeoNamesRecord[],
  countryRecord: GeoNamesCountryRecord | null,
): { matches: GeoNamesEntityMatch[]; unmatchedEntitySlugs: string[] } => {
  const matches: GeoNamesEntityMatch[] = [];
  const unmatchedEntitySlugs: string[] = [];

  for (const entity of entities) {
    if (entity.entityType === 'country') {
      if (!countryRecord || !countryRecord.geonameId) {
        unmatchedEntitySlugs.push(entity.canonicalSlug);
      } else {
        matches.push({
          entity,
          record: countryRecord,
          distanceKm: null,
          confidence: 0.99,
          matchedName: countryRecord.name,
        });
      }
      continue;
    }

    const candidates = records
      .map((record) => ({ record, result: scoreGeoNamesMatch(entity, record) }))
      .filter((candidate): candidate is { record: GeoNamesRecord; result: NonNullable<ReturnType<typeof scoreGeoNamesMatch>> } => Boolean(candidate.result))
      .sort((left, right) => right.result.score - left.result.score || left.result.distanceKm - right.result.distanceKm);
    const winner = candidates[0];
    if (!winner) {
      unmatchedEntitySlugs.push(entity.canonicalSlug);
      continue;
    }

    matches.push({
      entity,
      record: winner.record,
      distanceKm: winner.result.distanceKm,
      confidence: winner.result.distanceKm <= 15 && featurePreferenceScore(entity, winner.record) >= 2.5 ? 0.98 : 0.9,
      matchedName: winner.result.matchedName,
    });
  }

  return { matches, unmatchedEntitySlugs };
};

const getExternalId = (entity: TravelKnowledgeDatasetEntity, key: string): unknown => {
  const externalIds = entity.attributes?.externalIds;
  if (!externalIds || typeof externalIds !== 'object' || Array.isArray(externalIds)) return null;
  return (externalIds as Record<string, unknown>)[key] ?? null;
};

export const buildGeoNamesCandidateDrafts = (
  matches: GeoNamesEntityMatch[],
): TravelKnowledgeChangeCandidateDraft[] => matches.flatMap((match) => {
  const geonameId = match.record.geonameId;
  const previousValue = getExternalId(match.entity, 'geonames');
  if (String(previousValue ?? '') === geonameId) return [];
  const geoRecord = 'latitude' in match.record ? match.record : null;
  return [{
    countryCode: match.entity.countryCode,
    targetKind: 'entity' as const,
    targetKey: match.entity.canonicalSlug,
    fieldPath: 'attributes.externalIds.geonames',
    changeKind: previousValue === null ? 'add' as const : 'update' as const,
    previousValue,
    proposedValue: geonameId,
    extractionMethod: 'deterministic_transform' as const,
    confidence: match.confidence,
    severity: 'low' as const,
    validationFindings: geoRecord && match.distanceKm !== null ? [{
      code: 'coordinate_distance_km',
      value: Number(match.distanceKm.toFixed(3)),
      sourceLatitude: geoRecord.latitude,
      sourceLongitude: geoRecord.longitude,
    }] : [],
    metadata: {
      source: 'geonames',
      matchedName: match.matchedName,
      featureClass: geoRecord?.featureClass ?? 'A',
      featureCode: geoRecord?.featureCode ?? 'PCLI',
      modifiedAt: geoRecord?.modifiedAt ?? null,
    },
  }];
});

export const buildWikidataSparqlQuery = (geonameIds: string[]): string => {
  const safeIds = [...new Set(geonameIds)].filter((id) => /^\d+$/.test(id)).slice(0, 50);
  if (!safeIds.length) throw new Error('At least one numeric GeoNames id is required.');
  const values = safeIds.map((id) => `"${id}"`).join(' ');
  return [
    'SELECT ?item ?geonames WHERE {',
    `  VALUES ?geonames { ${values} }`,
    '  ?item wdt:P1566 ?geonames .',
    '}',
    'ORDER BY ?geonames ?item',
  ].join('\n');
};

export const parseWikidataIdentities = (
  sparqlPayload: unknown,
  entityPayload: unknown,
): WikidataIdentity[] => {
  const sparql = (sparqlPayload ?? {}) as WikidataSparqlResponse;
  const entityResponse = (entityPayload ?? {}) as WikidataEntityResponse;
  const byGeonameId = new Map<string, string[]>();
  for (const binding of sparql.results?.bindings ?? []) {
    const geonameId = asString(binding.geonames?.value);
    const itemUrl = asString(binding.item?.value);
    const wikidataId = itemUrl.match(/\/entity\/(Q\d+)$/)?.[1] ?? '';
    if (!geonameId || !wikidataId) continue;
    const ids = byGeonameId.get(geonameId) ?? [];
    ids.push(wikidataId);
    byGeonameId.set(geonameId, ids);
  }

  const identities: WikidataIdentity[] = [];
  for (const [geonameId, wikidataIds] of byGeonameId) {
    const uniqueIds = [...new Set(wikidataIds)];
    if (uniqueIds.length !== 1) continue;
    const wikidataId = uniqueIds[0]!;
    const entity = entityResponse.entities?.[wikidataId];
    const coordinate = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    const latitude = asFiniteNumber(coordinate?.latitude);
    const longitude = asFiniteNumber(coordinate?.longitude);
    const revisionId = asFiniteNumber(entity?.lastrevid);
    identities.push({
      geonameId,
      wikidataId,
      label: asString(entity?.labels?.en?.value) || undefined,
      localLabel: asString(entity?.labels?.th?.value) || undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      revisionId: revisionId === null ? undefined : Math.round(revisionId),
    });
  }
  return identities;
};

export const buildWikidataCandidateDrafts = (
  matches: GeoNamesEntityMatch[],
  identities: WikidataIdentity[],
): TravelKnowledgeChangeCandidateDraft[] => {
  const identityByGeonameId = new Map(identities.map((identity) => [identity.geonameId, identity]));
  const duplicateWikidataIds = new Set<string>();
  const ownerByWikidataId = new Map<string, string>();
  for (const match of matches) {
    const identity = identityByGeonameId.get(match.record.geonameId);
    if (!identity) continue;
    const existingOwner = ownerByWikidataId.get(identity.wikidataId);
    if (existingOwner && existingOwner !== match.entity.canonicalSlug) duplicateWikidataIds.add(identity.wikidataId);
    ownerByWikidataId.set(identity.wikidataId, match.entity.canonicalSlug);
  }

  return matches.flatMap((match) => {
    const identity = identityByGeonameId.get(match.record.geonameId);
    if (!identity || duplicateWikidataIds.has(identity.wikidataId)) return [];
    const previousValue = getExternalId(match.entity, 'wikidata');
    if (String(previousValue ?? '') === identity.wikidataId) return [];
    const findings: Array<Record<string, unknown>> = [];
    if (
      identity.latitude !== undefined
      && identity.longitude !== undefined
      && match.entity.latitude !== undefined
      && match.entity.longitude !== undefined
    ) {
      findings.push({
        code: 'coordinate_distance_km',
        value: Number(haversineDistanceKm(
          match.entity.latitude,
          match.entity.longitude,
          identity.latitude,
          identity.longitude,
        ).toFixed(3)),
        sourceLatitude: identity.latitude,
        sourceLongitude: identity.longitude,
      });
    }
    return [{
      countryCode: match.entity.countryCode,
      targetKind: 'entity' as const,
      targetKey: match.entity.canonicalSlug,
      fieldPath: 'attributes.externalIds.wikidata',
      changeKind: previousValue === null ? 'add' as const : 'update' as const,
      previousValue,
      proposedValue: identity.wikidataId,
      extractionMethod: 'structured_import' as const,
      confidence: Math.min(0.99, match.confidence + 0.01),
      severity: 'low' as const,
      validationFindings: findings,
      metadata: {
        source: 'wikidata',
        geonameId: identity.geonameId,
        label: identity.label ?? null,
        localLabel: identity.localLabel ?? null,
        revisionId: identity.revisionId ?? null,
      },
    }];
  });
};
