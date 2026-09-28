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
    expect(examples.map((example) => example.key)).toEqual(['pace', 'stays', 'route', 'dayTrip', 'review']);
    expect(examples[0].prompt).toBe('tripAgent.examples.pace.prompt|@Tokyo');
    expect(examples[2].prompt).toBe('tripAgent.examples.route.prompt');
  });

  it('prefers the city selected in the planner', () => {
    const examples = buildTripAgentExamples({
      t,
      trip,
      contextRefs: [{ kind: 'city', id: 'c2', label: 'Kyoto' }] as never,
    });
    expect(examples.find((example) => example.key === 'dayTrip')?.prompt).toBe('tripAgent.examples.dayTrip.prompt|@Kyoto');
  });

  it('offers only trip-wide examples for a trip without stops', () => {
    const examples = buildTripAgentExamples({ t, trip: { items: [] } as never, contextRefs: [] });
    expect(examples.map((example) => example.key)).toEqual(['route', 'review']);
  });
});
