import { describe, expect, it } from 'vitest';
import type { TravelKnowledgeDatasetEntity } from '../../scripts/travelKnowledgeDatasetUtils';
import {
  buildGeoNamesCandidateDrafts,
  buildWikidataCandidateDrafts,
  buildWikidataSparqlQuery,
  matchGeoNamesEntities,
  normalizeTravelPlaceName,
  parseGeoNamesCountryInfo,
  parseGeoNamesDump,
  parseWikidataIdentities,
} from '../../scripts/travelKnowledgeIngestionUtils';

const city = (overrides: Partial<TravelKnowledgeDatasetEntity> = {}): TravelKnowledgeDatasetEntity => ({
  canonicalSlug: 'th-koh-tao',
  entityType: 'city',
  countryCode: 'TH',
  primaryName: 'Koh Tao',
  localName: 'เกาะเต่า',
  latitude: 10.0956,
  longitude: 99.8404,
  popularityScore: 70,
  hiddenGemScore: 30,
  tourismIntensityScore: 60,
  attributes: { placeKind: 'island' },
  ...overrides,
});

const geoLine = (input: {
  id: string;
  name: string;
  alternateNames?: string;
  latitude: number;
  longitude: number;
  featureClass: string;
  featureCode: string;
  population?: number;
}) => [
  input.id,
  input.name,
  input.name,
  input.alternateNames ?? '',
  input.latitude,
  input.longitude,
  input.featureClass,
  input.featureCode,
  'TH',
  '',
  '84',
  '',
  '',
  '',
  input.population ?? 0,
  '',
  '',
  'Asia/Bangkok',
  '2026-07-01',
].join('\t');

describe('travel knowledge source ingestion', () => {
  it('normalizes Koh/Ko spellings without losing Thai names', () => {
    expect(normalizeTravelPlaceName('Koh  Tao')).toBe('ko tao');
    expect(normalizeTravelPlaceName('Ko Tao')).toBe('ko tao');
    expect(normalizeTravelPlaceName('เกาะเต่า')).toBe('เกาะเต่า');
  });

  it('parses GeoNames records and prefers an island identity over a nearby settlement', () => {
    const records = parseGeoNamesDump([
      geoLine({
        id: '1150389',
        name: 'Ko Tao',
        latitude: 10.09166,
        longitude: 99.83774,
        featureClass: 'T',
        featureCode: 'ISL',
      }),
      geoLine({
        id: '6698659',
        name: 'Koh Tao',
        latitude: 10.09808,
        longitude: 99.83809,
        featureClass: 'P',
        featureCode: 'PPL',
        population: 1382,
      }),
    ].join('\n'), 'TH');
    const result = matchGeoNamesEntities([city()], records, null);
    expect(result.unmatchedEntitySlugs).toEqual([]);
    expect(result.matches[0]?.record.geonameId).toBe('1150389');
    expect(result.matches[0]?.confidence).toBe(0.98);
  });

  it('parses the country identity and drafts review-only external id changes', () => {
    const countryInfo = parseGeoNamesCountryInfo(
      'TH\tTHA\t764\tTH\tThailand\tBangkok\t513120\t69950850\tAS\t.th\tTHB\tBaht\t66\t#####\t^([0-9]{5})$\tth,en\t1605651\tMM,LA,KH,MY',
      'TH',
    );
    const country = city({
      canonicalSlug: 'thailand',
      entityType: 'country',
      primaryName: 'Thailand',
      latitude: 15.87,
      longitude: 100.9925,
      attributes: { isoAlpha2: 'TH' },
    });
    const matches = matchGeoNamesEntities([country], [], countryInfo);
    const drafts = buildGeoNamesCandidateDrafts(matches.matches);
    expect(countryInfo?.geonameId).toBe('1605651');
    expect(drafts).toMatchObject([{
      targetKey: 'thailand',
      fieldPath: 'attributes.externalIds.geonames',
      changeKind: 'add',
      proposedValue: '1605651',
    }]);
  });

  it('reconciles a bounded Wikidata response through the GeoNames id', () => {
    const records = parseGeoNamesDump(geoLine({
      id: '1150389',
      name: 'Ko Tao',
      latitude: 10.09166,
      longitude: 99.83774,
      featureClass: 'T',
      featureCode: 'ISL',
    }), 'TH');
    const matches = matchGeoNamesEntities([city()], records, null).matches;
    const identities = parseWikidataIdentities({
      results: {
        bindings: [{
          item: { value: 'http://www.wikidata.org/entity/Q207569' },
          geonames: { value: '1150389' },
        }],
      },
    }, {
      entities: {
        Q207569: {
          lastrevid: 123,
          labels: { en: { value: 'Ko Tao' }, th: { value: 'เกาะเต่า' } },
          claims: {
            P625: [{ mainsnak: { datavalue: { value: { latitude: 10.09, longitude: 99.84 } } } }],
          },
        },
      },
    });
    const drafts = buildWikidataCandidateDrafts(matches, identities);
    expect(identities).toMatchObject([{ geonameId: '1150389', wikidataId: 'Q207569', revisionId: 123 }]);
    expect(drafts).toMatchObject([{
      targetKey: 'th-koh-tao',
      fieldPath: 'attributes.externalIds.wikidata',
      proposedValue: 'Q207569',
    }]);
    const query = buildWikidataSparqlQuery(['1150389', '1150389', 'invalid']);
    expect(query).toContain('VALUES ?geonames { "1150389" }');
    expect(query).not.toContain('invalid');
  });

  it('drops ambiguous Wikidata identities rather than guessing', () => {
    const identities = parseWikidataIdentities({
      results: {
        bindings: [
          { item: { value: 'http://www.wikidata.org/entity/Q1' }, geonames: { value: '1150389' } },
          { item: { value: 'http://www.wikidata.org/entity/Q2' }, geonames: { value: '1150389' } },
        ],
      },
    }, {});
    expect(identities).toEqual([]);
  });
});
