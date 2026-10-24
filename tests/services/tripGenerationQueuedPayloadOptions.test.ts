import { describe, expect, it } from 'vitest';

import { __tripGenerationQueueServiceInternals } from '../../services/tripGenerationQueueService';

const { parseQueuedPayload } = __tripGenerationQueueServiceInternals;

const basePayload = {
  version: 1,
  destinationLabel: 'Portugal',
  startDate: '2026-05-01',
  endDate: '2026-05-10',
};

// Regression: stored options were cast straight to the flow's option type, so a
// payload whose options lacked the destination field reached the prompt
// builders with `countries`/`country` undefined and crashed on `.map`/`.trim`.
describe('parseQueuedPayload option coercion', () => {
  it('gives wizard options without countries an empty list and keeps the rest', () => {
    const parsed = parseQueuedPayload('wizard', {
      ...basePayload,
      options: { budget: 'mid', countries: 'Portugal' },
    });

    expect(parsed.flow).toBe('wizard');
    expect(parsed.options).toEqual({ budget: 'mid', countries: [] });
  });

  it('keeps only string entries from stored wizard countries', () => {
    const parsed = parseQueuedPayload('wizard', {
      ...basePayload,
      options: { countries: ['Portugal', 7, null, 'Spain'] },
    });

    expect(parsed.options).toEqual({ countries: ['Portugal', 'Spain'] });
  });

  it('falls back to the destination label when surprise options lack a country', () => {
    const parsed = parseQueuedPayload('surprise', {
      ...basePayload,
      options: { notes: 'beaches', country: '   ' },
    });

    expect(parsed.flow).toBe('surprise');
    expect(parsed.options).toEqual({ notes: 'beaches', country: 'Portugal' });
  });

  it('keeps a valid stored surprise country', () => {
    const parsed = parseQueuedPayload('surprise', {
      ...basePayload,
      options: { country: 'Japan' },
    });

    expect(parsed.options).toEqual({ country: 'Japan' });
  });
});
