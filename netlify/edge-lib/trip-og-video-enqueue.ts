// Best effort only: a preview failure must never fail trip creation.
export const enqueueTripVideoFromWorker = async (origin: string, tripId: string, adminKey: string) => {
  if (!adminKey) return;
  try {
    await fetch(new URL(`/api/og/trip-video?trip=${encodeURIComponent(tripId)}`, origin), {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-tf-admin-key': adminKey },
      body: '{}', signal: AbortSignal.timeout(4000),
    });
  } catch { /* Media rendering is independent of generation success. */ }
};
