import type { Config, Context } from '@netlify/functions';
import { loadTripForVideo } from '../lib/trip-video-access.ts';
import { videoRevision, videoStore } from '../lib/trip-video-store.ts';
import { renderTripVideo } from '../lib/trip-video-renderer.ts';
import { isTripVideoId, type TripVideoState } from '../../shared/tripOgVideo.ts';

export default async (request: Request, context?: Context) => {
  if (request.method !== 'POST' || !process.env.TF_ADMIN_API_KEY || request.headers.get('x-tf-admin-key') !== process.env.TF_ADMIN_API_KEY) return;
  const { tripId, jobId } = await request.json();
  if (!isTripVideoId(tripId) || typeof jobId !== 'string') return;
  const store = videoStore(context?.deploy);
  const previous = await store.getWithMetadata(`${tripId}/state`, { type: 'json' });
  // Atomic lease also makes Netlify background retries and duplicated deliveries harmless.
  if (!previous || previous.data.jobId !== jobId || previous.data.status !== 'queued') return;
  const state = { ...previous.data, status: 'rendering' as const };
  if (!(await store.setJSON(`${tripId}/state`, state, { onlyIfMatch: previous.etag })).modified) return;
  try {
    const trip = await loadTripForVideo(tripId);
    if (!trip || videoRevision(trip, state.style) !== state.revision) throw new Error('Trip changed before rendering.');
    const { video, poster } = await renderTripVideo(trip, state.style);
    // A timed-out job must never overwrite a newer lease.
    const current = await store.get(`${tripId}/state`, { type: 'json' });
    if (current?.jobId !== jobId) return;
    await store.set(`${tripId}/video`, new Uint8Array(video).buffer);
    await store.set(`${tripId}/poster`, new Uint8Array(poster).buffer);
    await store.setJSON(`${tripId}/state`, { ...state, status: 'ready', bytes: video.length });
  } catch (error) {
    console.error('[trip-og-video] render failed', { tripId, message: error instanceof Error ? error.message : 'unknown' });
    const current = await store.get(`${tripId}/state`, { type: 'json' });
    if (current?.jobId === jobId) await store.setJSON(`${tripId}/state`, { ...state, status: 'failed', error: 'Video could not be rendered. Check the mapped cities and try again after the cooldown.' });
  }
};

export const config: Config = { background: true };
