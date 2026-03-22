import { describe, expect, it } from 'vitest';
import {
  __airportGenerationInternals,
} from '../../scripts/generate-airports-reference.ts';
import {
  parseEnrichmentAirportCsv,
  parsePrimaryAirportCsv,
} from '../../shared/airportReferenceCatalog';

const PRIMARY_CSV = `"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"
1,"EDDB","large_airport","Berlin Brandenburg Airport",52.362247,13.500672,157,"EU","DE","DE-BE","Berlin","yes","EDDB","BER","EDDB","EDDB",,,
2,"EDAZ","small_airport","Schonhagen Airport",52.203056,13.156389,130,"EU","DE","DE-BB","Trebbin","yes","EDAZ","","EDAZ","EDAZ",,,
3,"DEAD","heliport","Skip Me",52.5,13.4,100,"EU","DE","DE-BE","Berlin","yes","DEAD","ZZZ","DEAD","DEAD",,,
4,"XNOP","medium_airport","No Code Airport",50.0,8.0,100,"EU","DE","DE-HE","Frankfurt","yes","","","XNOP","XNOP",,,
5,"CLOSED","medium_airport","Closed-ish",50.0,8.0,100,"EU","DE","DE-HE","Frankfurt","no","CLOS","CLS","CLOS","CLOS",,,`;

const ENRICHMENT_CSV = `"icao","iata","name","city","subd","country","elevation","lat","lon","tz","lid"
"EDDB","BER","Berlin Brandenburg Airport","Berlin","Berlin","DE",157,52.362247,13.500672,"Europe/Berlin","EDDB"
"EDAZ","","Schonhagen Airport","Trebbin","Brandenburg","DE",130,52.203056,13.156389,"Europe/Berlin","EDAZ"
"ZZZZ","BER","Ambiguous IATA","Somewhere","Elsewhere","DE",100,52.0,13.0,"Europe/Berlin","ZZZZ"`;

describe('scripts/generate-airports-reference', () => {
  it('parses the primary airport CSV into normalized records', () => {
    const records = parsePrimaryAirportCsv(PRIMARY_CSV);

    expect(records).toHaveLength(5);
    expect(records[0]).toMatchObject({
      ident: 'EDDB',
      airportType: 'large_airport',
      iataCode: 'BER',
      scheduledService: true,
    });
  });

  it('parses the enrichment CSV into timezone-ready records', () => {
    const records = parseEnrichmentAirportCsv(ENRICHMENT_CSV);

    expect(records).toHaveLength(3);
    expect(records[1]).toMatchObject({
      icaoCode: 'EDAZ',
      subdivisionName: 'Brandenburg',
      timezone: 'Europe/Berlin',
    });
  });

  it('merges both sources into a commercial-only snapshot', () => {
    const primary = parsePrimaryAirportCsv(PRIMARY_CSV);
    const enrichment = parseEnrichmentAirportCsv(ENRICHMENT_CSV);
    const merged = __airportGenerationInternals.mergeAirportSources(primary, enrichment);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      ident: 'EDDB',
      countryName: 'Germany',
      subdivisionName: 'Berlin',
      timezone: 'Europe/Berlin',
      commercialServiceTier: 'major',
      isMajorCommercial: true,
    });
    expect(merged[1]).toMatchObject({
      ident: 'EDAZ',
      iataCode: null,
      icaoCode: 'EDAZ',
      subdivisionName: 'Brandenburg',
      commercialServiceTier: 'local',
      isMajorCommercial: false,
    });
  });

  it('serializes a reset-and-insert SQL seed', () => {
    const sql = __airportGenerationInternals.serializeAirportSeedSql([
      {
        ident: 'EDDB',
        iataCode: 'BER',
        icaoCode: 'EDDB',
        name: 'Berlin Brandenburg Airport',
        municipality: 'Berlin',
        subdivisionName: 'Berlin',
        regionCode: 'DE-BE',
        countryCode: 'DE',
        countryName: 'Germany',
        latitude: 52.362247,
        longitude: 13.500672,
        timezone: 'Europe/Berlin',
        airportType: 'large_airport',
        scheduledService: true,
        isCommercial: true,
        commercialServiceTier: 'major',
        isMajorCommercial: true,
      },
    ], {
      dataVersion: '2026-03-21-1',
      generatedAt: '2026-03-21T16:18:17.917Z',
      commercialAirportCount: 1,
      sourceAirportCount: 5,
      sources: {
        primary: 'primary-url',
        mirror: 'mirror-url',
        enrichment: 'enrichment-url',
      },
    });

    expect(sql).toContain('delete from public.airports_reference;');
    expect(sql).toContain("'Berlin Brandenburg Airport'");
    expect(sql).toContain('insert into public.airports_reference');
    expect(sql).toContain('insert into public.airports_reference_metadata');
  });

  it('builds a stable data version string', () => {
    expect(__airportGenerationInternals.buildDataVersion('2026-03-21T16:18:17.917Z', 4086)).toBe('2026-03-21-4086');
  });
});
