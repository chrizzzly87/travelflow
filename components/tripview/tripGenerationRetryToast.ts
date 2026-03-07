interface QueuedTripGenerationRetryToastOptions {
  tone: 'neutral';
  title: string;
  disableDefaultUndo: true;
}

export const buildQueuedTripGenerationRetryToastOptions = (
  title: string,
): QueuedTripGenerationRetryToastOptions => ({
  tone: 'neutral',
  title,
  disableDefaultUndo: true,
});
