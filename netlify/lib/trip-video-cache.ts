import { purgeCache } from '@netlify/functions';

// Scope purges to this hostname and trip, including share links tagged by the
// underlying trip ID. A feature deploy must not invalidate production's cache.
export const refreshTripVideoMetadata = async (tripId: string, origin: string) => {
  try {
    await purgeCache({ domain: new URL(origin).hostname, tags: [`trip-og-${tripId}`] });
  } catch (error) {
    // A purge failure must not discard an already rendered video. Existing HTML
    // cache TTLs remain the fallback; versioned media URLs prevent byte reuse.
    console.warn('[trip-og-video] metadata cache purge failed', error instanceof Error ? error.message : 'unknown');
  }
};
