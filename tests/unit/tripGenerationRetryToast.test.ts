import { describe, expect, it } from 'vitest';
import { buildQueuedTripGenerationRetryToastOptions } from '../../components/tripview/tripGenerationRetryToast';

describe('components/tripview/tripGenerationRetryToast', () => {
  it('disables the default undo action for queued retry toasts', () => {
    expect(
      buildQueuedTripGenerationRetryToastOptions('Retry started'),
    ).toEqual({
      tone: 'neutral',
      title: 'Retry started',
      disableDefaultUndo: true,
    });
  });
});
