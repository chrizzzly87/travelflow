import { describe, expect, it } from 'vitest';
import {
  normalizeAtobeachCountryRecord,
  validateAtobeachSourceDocument,
  type AtobeachCountrySourceDocument,
} from '../../shared/atobeachCountrySource';

const sourceRecord = {
  provider: 'atobeach' as const,
  sourceRecordId: '63',
  originUrl: 'https://atobeach.com/api/countries/indonesia/',
  fetchedAt: '2026-08-17T12:00:00.000Z',
  payloadHash: 'a'.repeat(64),
  payload: {
    id: 63,
    name: 'Indonesia',
    code: 'ID',
    slug: 'indonesia',
    region: 'Asia',
    description: 'A diverse archipelago.',
    latitude: '-0.7893',
    longitude: '113.9213',
    recent_updates: [{ timestamp: '2026-08-16T08:00:00Z' }],
    cities: [{ name: 'Denpasar', slug: 'denpasar' }],
    esim_plan: {
      purchase_url: 'https://saily.com/plans/indonesia/?utm_source=atobeach&utm_medium=referral&plan=10gb',
    },
  },
};

describe('AtoBeach country source normalization', () => {
  it('retains origin attribution while stripping and recording referral tracking parameters', () => {
    const result = normalizeAtobeachCountryRecord(sourceRecord, '00000000-0000-0000-0000-000000000001');
    expect(result.sourceRow.origin_url).toBe(sourceRecord.originUrl);
    expect(result.profileRow.origin_url).toBe(sourceRecord.originUrl);
    expect(result.profileRow.latitude).toBe(-0.7893);
    expect(result.referralRows).toEqual([
      expect.objectContaining({
        canonical_url: 'https://saily.com/plans/indonesia/?plan=10gb',
        is_referral: true,
        removed_tracking_parameters: ['utm_medium', 'utm_source'],
        origin_url: sourceRecord.originUrl,
        source_provider: 'atobeach',
        is_active: true,
      }),
    ]);
    expect((result.sourceRow.payload as typeof sourceRecord.payload).esim_plan.purchase_url)
      .toBe('https://saily.com/plans/indonesia/?plan=10gb');
  });

  it('rejects duplicate countries and malformed origin URLs', () => {
    const document: AtobeachCountrySourceDocument = {
      schemaVersion: 1,
      provider: 'atobeach',
      listOriginUrl: 'https://atobeach.com/api/countries/',
      generatedAt: sourceRecord.fetchedAt,
      recordCount: 2,
      records: [sourceRecord, { ...sourceRecord, originUrl: 'https://example.com/indonesia' }],
    };
    expect(validateAtobeachSourceDocument(document)).toEqual(expect.arrayContaining([
      '63: invalid originUrl',
      'duplicate country code: ID',
      'duplicate slug: indonesia',
    ]));
  });
});
