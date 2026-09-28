import { describe, expect, it } from 'vitest';

import { buildTripAgentExamples } from '../../components/trip-agent/tripAgentExamples';

const t = ((key: string, options?: { city?: string }) => (
  options?.city ? `${key}|${options.city}` : key
)) as never;

const trip = {
  items: [
    { id: 'c1', type: 'city', title: 'Tokyo' },
    { id: 'c2', type: 'city', title: 'Kyoto' },
  ],
} as never;

describe('buildTripAgentExamples', () => {
  it('names the first stop as an @mention when nothing is selected', () => {
    const examples = buildTripAgentExamples({ t, trip, contextRefs: [] });
    expect(examples.map((example) => example.key)).toEqual(['activities', 'food', 'stays', 'dayTrip', 'review']);
    expect(examples[0].prompt).toBe('examples.activities.prompt|@Tokyo');
    expect(examples[4].prompt).toBe('examples.review.prompt');
  });

  it('prefers the city selected in the planner', () => {
    const examples = buildTripAgentExamples({
      t,
      trip,
      contextRefs: [{ kind: 'city', id: 'c2', label: 'Kyoto' }] as never,
    });
    expect(examples.find((example) => example.key === 'dayTrip')?.prompt).toBe('examples.dayTrip.prompt|@Kyoto');
  });

  it('offers only trip-wide examples for a trip without stops', () => {
    const examples = buildTripAgentExamples({ t, trip: { items: [] } as never, contextRefs: [] });
    expect(examples.map((example) => example.key)).toEqual(['review']);
  });
});
