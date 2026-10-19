import { afterEach, describe, expect, it } from 'vitest';
import {
  abortActiveTripGenerationRequest,
  registerActiveGenerationAbortController,
} from '../../services/tripGenerationRuntime';

const releases: Array<() => void> = [];
const register = (identity: { tripId?: string; requestId?: string }, controller: AbortController) => {
  const release = registerActiveGenerationAbortController(identity, controller);
  releases.push(release);
  return release;
};

afterEach(() => {
  releases.splice(0).forEach((release) => release());
});

describe('trip generation runtime', () => {
  it('lets the existing AI service export abort a controller registered by the lightweight runtime', async () => {
    const aiService = await import('../../services/aiService');
    const controller = new AbortController();
    register({ tripId: 'shared-trip', requestId: 'shared-request' }, controller);
    expect(aiService.abortActiveTripGenerationRequest).toBe(abortActiveTripGenerationRequest);
    expect(aiService.abortActiveTripGenerationRequest({ requestId: 'shared-request' })).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe('user_abort');
  });

  it('uses the specific request before a conflicting trip identity', () => {
    const requestController = new AbortController();
    const tripController = new AbortController();
    register({ requestId: 'request-a' }, requestController);
    register({ tripId: 'trip-b' }, tripController);
    expect(abortActiveTripGenerationRequest({ requestId: 'request-a', tripId: 'trip-b', reason: ' user_abort_retry ' })).toBe(true);
    expect(requestController.signal.reason).toBe('user_abort_retry');
    expect(tripController.signal.aborted).toBe(false);
  });

  it('falls back to the trip when the requested id is not registered', () => {
    const controller = new AbortController();
    register({ tripId: ' trip ' }, controller);
    expect(abortActiveTripGenerationRequest({ requestId: 'missing', tripId: ' trip ' })).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  it.each(['tripId', 'requestId'] as const)('supersedes a controller registered under the same %s', (key) => {
    const oldController = new AbortController();
    const replacement = new AbortController();
    const identity = { [key]: 'same-id' };
    const releaseOld = register(identity, oldController);
    register(identity, replacement);
    expect(oldController.signal.reason).toBe('superseded');
    expect(replacement.signal.aborted).toBe(false);
    releaseOld();
    expect(abortActiveTripGenerationRequest(identity)).toBe(true);
    expect(replacement.signal.reason).toBe('user_abort');
  });

  it('releases both indexes without deleting a newer trip request', () => {
    const first = new AbortController();
    const second = new AbortController();
    const releaseFirst = register({ tripId: 'trip', requestId: 'first' }, first);
    const releaseSecond = register({ tripId: 'trip', requestId: 'second' }, second);
    releaseFirst();
    expect(abortActiveTripGenerationRequest({ requestId: 'first' })).toBe(false);
    expect(abortActiveTripGenerationRequest({ tripId: 'trip' })).toBe(true);
    releaseSecond();
    releaseSecond();
    expect(abortActiveTripGenerationRequest({ tripId: 'trip', requestId: 'second' })).toBe(false);
  });

  it('does not abort when the same controller is registered under both indexes again', () => {
    const controller = new AbortController();
    register({ tripId: 'trip', requestId: 'request' }, controller);
    register({ tripId: 'trip', requestId: 'request' }, controller);
    expect(controller.signal.aborted).toBe(false);
  });

  it('ignores registrations without an identity or controller', () => {
    const controller = new AbortController();
    register({ tripId: ' ', requestId: '' }, controller);
    registerActiveGenerationAbortController({ tripId: 'null-controller' }, null)();
    registerActiveGenerationAbortController(undefined, controller)();
    expect(abortActiveTripGenerationRequest({ tripId: ' ', requestId: '' })).toBe(false);
    expect(abortActiveTripGenerationRequest({ tripId: 'null-controller' })).toBe(false);
    expect(controller.signal.aborted).toBe(false);
  });
});
