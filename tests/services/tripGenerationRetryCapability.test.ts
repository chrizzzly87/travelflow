import { describe, expect, it } from 'vitest';
import {
  canTriggerTripGenerationAbortAndRetry,
  canTriggerTripGenerationRetry,
  type TripGenerationRetryCapabilityOptions,
} from '../../services/tripGenerationRetryCapability';

const editable: TripGenerationRetryCapabilityOptions = {
  canEdit: true,
  hasInputSnapshot: true,
  generationState: 'failed',
};

describe('trip generation retry capabilities', () => {
  it('permits retry of a failed editable trip with its input snapshot', () => {
    expect(canTriggerTripGenerationRetry(editable)).toBe(true);
    expect(canTriggerTripGenerationAbortAndRetry(editable)).toBe(true);
  });

  it.each([
    { canEdit: false },
    { hasInputSnapshot: false },
    { isRetryingGeneration: true },
  ])('blocks both actions for %j', (blocked) => {
    expect(canTriggerTripGenerationRetry({ ...editable, ...blocked })).toBe(false);
    expect(canTriggerTripGenerationAbortAndRetry({ ...editable, ...blocked })).toBe(false);
  });

  it('requires all three admin override conditions when the trip is not editable', () => {
    const override = { ...editable, canEdit: false, isAdminFallbackView: true, adminOverrideEnabled: true, canAdminWrite: true };
    expect(canTriggerTripGenerationRetry(override)).toBe(true);
    expect(canTriggerTripGenerationAbortAndRetry(override)).toBe(true);
    for (const condition of ['isAdminFallbackView', 'adminOverrideEnabled', 'canAdminWrite'] as const) {
      expect(canTriggerTripGenerationRetry({ ...override, [condition]: false })).toBe(false);
      expect(canTriggerTripGenerationAbortAndRetry({ ...override, [condition]: false })).toBe(false);
    }
  });

  it.each(['queued', 'running'] as const)('blocks ordinary retry while %s and only allows abort for a local request', (generationState) => {
    expect(canTriggerTripGenerationRetry({ ...editable, generationState })).toBe(false);
    expect(canTriggerTripGenerationAbortAndRetry({ ...editable, generationState })).toBe(true);
    expect(canTriggerTripGenerationAbortAndRetry({ ...editable, generationState, latestAttemptOrchestration: 'async_worker' })).toBe(false);
  });

  it('blocks ordinary retry of an unclaimed auth request without changing the existing abort guard', () => {
    const awaitingClaim = { ...editable, pendingAuthQueueRequestId: 'pending-request' };
    expect(canTriggerTripGenerationRetry(awaitingClaim)).toBe(false);
    expect(canTriggerTripGenerationAbortAndRetry(awaitingClaim)).toBe(true);
  });

  it('preserves public compatibility exports without creating a second implementation', async () => {
    const service = await import('../../services/tripGenerationRetryService');
    expect(service.canTriggerTripGenerationRetry).toBe(canTriggerTripGenerationRetry);
    expect(service.canTriggerTripGenerationAbortAndRetry).toBe(canTriggerTripGenerationAbortAndRetry);
  });
});
