import { describe, expect, it } from 'vitest';

import { beginMapDrawSession } from '../../components/ItineraryMap';

describe('components/ItineraryMap draw session guard', () => {
  it('marks older draw sessions inactive when a new draw starts', () => {
    const tokenRef = { current: 0 };
    const firstSession = beginMapDrawSession(tokenRef);
    expect(firstSession.isActive()).toBe(true);

    const secondSession = beginMapDrawSession(tokenRef);
    expect(firstSession.isActive()).toBe(false);
    expect(secondSession.isActive()).toBe(true);
    expect(tokenRef.current).toBe(2);
  });

  it('invalidates the active draw session on dispose', () => {
    const tokenRef = { current: 0 };
    const session = beginMapDrawSession(tokenRef);

    expect(session.isActive()).toBe(true);
    session.dispose();
    expect(session.isActive()).toBe(false);
    expect(tokenRef.current).toBe(2);
  });

  it('does not override newer sessions when an older one disposes later', () => {
    const tokenRef = { current: 0 };
    const staleSession = beginMapDrawSession(tokenRef);
    const activeSession = beginMapDrawSession(tokenRef);

    staleSession.dispose();
    expect(activeSession.isActive()).toBe(true);
    expect(tokenRef.current).toBe(2);
  });
});
