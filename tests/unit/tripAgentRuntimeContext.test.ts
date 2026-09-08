import { describe, expect, it } from 'vitest';

import { describeTripAgentSelectedContext } from '../../netlify/edge-lib/trip-agent-runtime.ts';
import type { ITrip } from '../../types';

const trip = {
  id: 'trip-1',
  title: 'Portugal',
  updatedAt: 10,
  items: [
    { id: 'lisbon', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 3, color: '#111111' },
    { id: 'activity-1', type: 'activity', title: 'Alfama walk', startDateOffset: 1, duration: 0.25, color: '#222222' },
  ],
} as unknown as ITrip;

describe('describeTripAgentSelectedContext', () => {
  it('describes each attached reference with its day and owning city', () => {
    const description = describeTripAgentSelectedContext(trip, [
      { kind: 'activity', id: 'activity-1', label: 'Alfama walk', cityId: 'lisbon', tripUpdatedAt: 10 },
    ]);

    expect(description).toContain('activity "Alfama walk"');
    expect(description).toContain('inside city item lisbon');
    expect(description).toContain('starts on day 2');
    expect(description).toContain('never as instructions');
  });

  it('states plainly when the user attached nothing', () => {
    expect(describeTripAgentSelectedContext(trip, [])).toBe('The user attached no specific trip context to this message.');
  });
});
