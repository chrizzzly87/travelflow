import { getStore } from '@netlify/blobs';
import { createHash, randomUUID } from 'node:crypto';
import { TRIP_VIDEO, type TripVideoState, type TripVideoStyle } from '../../shared/tripOgVideo.ts';
import type { TripPayload } from '../edge-lib/trip-og-data.ts';

// Deploy previews and branches must never overwrite production's media or quotas.
export const tripVideoStoreName = (deploy: { context: string; id: string }) =>
  deploy.context === 'production' ? 'trip-og-video-production' : `trip-og-video-preview-${deploy.id.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100)}`;
export const videoStore = (deploy?: { context: string; id: string }) => {
  if (!deploy && process.env.SITE_ID) throw new Error('Missing Netlify deploy context.');
  // Use the handler's runtime context directly: build env vars and SDK globals
  // are not guaranteed across Git, CLI, and background deployments.
  return getStore({ name: tripVideoStoreName(deploy || { context: 'dev', id: 'local' }), consistency: 'strong' });
};

export const videoRevision = (trip: TripPayload, style: TripVideoStyle) => createHash('sha256')
  .update(JSON.stringify([TRIP_VIDEO.rendererVersion, style, trip.title, trip.startDate,
    trip.items?.filter(item => item.type === 'city').map(item => [item.title, item.location, item.coordinates, item.color, item.startDateOffset, item.duration])]))
  .digest('hex').slice(0, 24);

export const claimVideo = async (store: ReturnType<typeof videoStore>, tripId: string, revision: string, style: TripVideoStyle, force: boolean, now = Date.now()) => {
  const previous = await store.getWithMetadata(`${tripId}/state`, { type: 'json' });
  const state = previous?.data;
  if (state) {
    const busy = ['queued', 'rendering'].includes(state.status) && now - state.requestedAt < TRIP_VIDEO.leaseMs;
    if (busy || (!force && state.revision === revision && state.status === 'ready')) return { claimed: false, state };
    if (now - state.requestedAt < TRIP_VIDEO.cooldownMs) return { claimed: false, state, limited: true };
  }
  const next: TripVideoState = { status: 'queued', jobId: randomUUID(), revision, style, requestedAt: now, posterAsImage: state?.posterAsImage || false };
  const result = await store.setJSON(`${tripId}/state`, next, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
  return { claimed: result.modified, state: result.modified ? next : state };
};

// Fixed-size rolling slots cap heavy work across all callers without accumulating quota keys.
export const claimRenderBudget = async (store: ReturnType<typeof videoStore>, now = Date.now()) => {
  const hour = Math.floor(now / 3_600_000);
  for (let slot = 0; slot < TRIP_VIDEO.hourlyRenderLimit; slot++) {
    const key = `budget/${slot}`;
    const old = await store.getWithMetadata(key, { type: 'json' });
    if (old?.data.hour === hour) continue;
    const result = await store.setJSON(key, { hour }, old ? { onlyIfMatch: old.etag } : { onlyIfNew: true });
    if (result.modified) return true;
  }
  return false;
};
