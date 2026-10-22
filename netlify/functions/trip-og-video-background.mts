import { refreshTripVideoMetadata } from '../lib/trip-video-cache.ts';
import type { Config, Context } from '@netlify/functions';
import { loadTripForVideo } from '../lib/trip-video-access.ts';
import { videoRevision, videoStore } from '../lib/trip-video-store.ts';
import { renderTripVideo } from '../lib/trip-video-renderer.ts';
import type { TripVideoRouteCache } from '../lib/trip-video-map.ts';
import { isTripVideoId, tripVideoAssetPath } from '../../shared/tripOgVideo.ts';

export default async (request: Request, context?: Context) => {
  if (request.method !== 'POST' || !process.env.TF_ADMIN_API_KEY || request.headers.get('x-tf-admin-key') !== process.env.TF_ADMIN_API_KEY) return;
  const { tripId, jobId } = await request.json();
  if (!isTripVideoId(tripId) || typeof jobId !== 'string') return;
  const store = videoStore(context?.deploy);
  const previous = await store.getWithMetadata(`${tripId}/state`, { type: 'json' });
  if (!previous || previous.data.jobId !== jobId || previous.data.status !== 'queued') return;
  const state = { ...previous.data, status: 'rendering' as const };
  if (!(await store.setJSON(`${tripId}/state`, state, { onlyIfMatch: previous.etag })).modified) return;
  let routeCache: TripVideoRouteCache = [];
  const next = { ...state, status: 'ready' as const, assetKey: jobId, mediaRevision: jobId.replaceAll('-', '').slice(0, 24), previousReady: undefined };
  const discard = async () => {
    await Promise.allSettled(['video', 'poster'].map(asset => store.delete(tripVideoAssetPath(tripId, next, asset as 'video' | 'poster'))));
  };
  try {
    const savedRoutes = await store.get(`${tripId}/routes`, { type: 'json' });
    if (Array.isArray(savedRoutes)) routeCache = savedRoutes;
    const trip = await loadTripForVideo(tripId);
    if (!trip || videoRevision(trip, state.style, state.routeMode, state.format) !== state.revision) throw new Error('Trip changed before rendering.');
    const { video, poster } = await renderTripVideo(trip, state.style, state.routeMode, routeCache, state.format);
    const current = await store.getWithMetadata(`${tripId}/state`, { type: 'json' });
    if (current?.data.jobId !== jobId) return;
    // Immutable job paths keep the previous ready pair intact during uploads.
    // Publishing one manifest atomically switches both video and poster together.
    await store.set(tripVideoAssetPath(tripId, next, 'video'), new Uint8Array(video).buffer);
    await store.set(tripVideoAssetPath(tripId, next, 'poster'), new Uint8Array(poster).buffer);
    if (!(await store.setJSON(`${tripId}/state`, { ...next, bytes: video.length }, { onlyIfMatch: current.etag })).modified) {
      await discard(); return;
    }
    if (state.previousReady) {
      await Promise.allSettled(['video', 'poster'].map(asset => store.delete(tripVideoAssetPath(tripId, state.previousReady!, asset as 'video' | 'poster'))));
    }
    await refreshTripVideoMetadata(tripId, request.url);
  } catch (error) {
    await discard();
    console.error('[trip-og-video] render failed', { tripId, message: error instanceof Error ? error.message : 'unknown' });
    const current = await store.getWithMetadata(`${tripId}/state`, { type: 'json' });
    if (current?.data.jobId === jobId) await store.setJSON(`${tripId}/state`, { ...state, status: 'failed', error: 'Video could not be rendered. Your previous preview is still attached. Retry after the cooldown.' }, { onlyIfMatch: current.etag });
  } finally {
    // Geometry survives style changes and failed encodes, within a fixed bound.
    if (routeCache.length) await store.setJSON(`${tripId}/routes`, routeCache).catch(() => {});
  }
};

export const config: Config = { background: true };
