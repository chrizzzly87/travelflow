import { describe, expect, it } from 'vitest';
import {
  deepMergeDestinationContent,
  mapDestinationOverrideRow,
  validateDestinationOverridePatch,
} from '../../shared/destinationContentOverrides';

describe('destination content overrides', () => {
  it('deep-merges objects and replaces arrays', () => {
    const result = deepMergeDestinationContent(
      { summary: 'Base', seasonality: { idealMonths: [1], avoidMonths: [8] } },
      { summary: 'Edited', seasonality: { idealMonths: [2, 3] } },
    );
    expect(result).toEqual({
      summary: 'Edited',
      seasonality: { idealMonths: [2, 3], avoidMonths: [8] },
    });
  });

  it('rejects identity and provenance fields', () => {
    expect(validateDestinationOverridePatch('guide', { slug: 'changed' })).toEqual({
      ok: false,
      error: 'Unsupported override fields: slug.',
    });
    expect(validateDestinationOverridePatch('country_profile', { originUrl: 'https://example.test' }).ok).toBe(false);
  });

  it('maps valid database rows', () => {
    expect(mapDestinationOverrideRow({
      id: 'override-1', target_kind: 'guide', target_id: 'country:thailand', status: 'draft',
      patch: { summary: 'Draft' }, note: null, updated_at: '2026-08-17T12:00:00Z', updated_by: null,
    })).toMatchObject({ targetKind: 'guide', targetId: 'country:thailand', status: 'draft' });
  });
});
