import type { Config } from '@netlify/functions';
import { claimRenderBudget, claimVideo, videoRevision, videoStore } from '../lib/trip-video-store.ts';
import { canManageTripVideo, loadTripForVideo, resolvePublicVideoTrip } from '../lib/trip-video-access.ts';
import { isTripVideoId, normalizeTripVideoStyle, parseVideoRange, TRIP_VIDEO, type TripVideoState } from '../../shared/tripOgVideo.ts';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });

export default async (request: Request) => {
  try {
    const url = new URL(request.url);
    const tripId = url.searchParams.get('trip');
    if (tripId && !isTripVideoId(tripId)) return json({ error: 'Invalid trip ID.' }, 400);
    if (!['GET', 'HEAD', 'POST', 'PATCH'].includes(request.method)) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD, POST, PATCH' } });
    const internalKey = process.env.TF_ADMIN_API_KEY;
    const internal = Boolean(internalKey && request.headers.get('x-tf-admin-key') === internalKey);
    const manager = internal || (Boolean(tripId) && await canManageTripVideo(request, tripId!));
    if (['POST', 'PATCH'].includes(request.method) && !manager) return json({ error: 'Trip owner or admin access required.' }, 403);
    const trip = manager && tripId ? await loadTripForVideo(tripId) : await resolvePublicVideoTrip(url);
    if (!trip?.id || !isTripVideoId(trip.id)) return json({ error: 'Trip preview unavailable.' }, 404);
    const store = videoStore();
    let state = await store.get(`${trip.id}/state`, { type: 'json' });
    if (request.method === 'PATCH') {
      const text = await request.text();
      if (text.length > 1024) return json({ error: 'Request too large.' }, 413);
      const options = JSON.parse(text);
      if (typeof options.posterAsImage !== 'boolean') return json({ error: 'Choose an image source.' }, 400);
      const current = await store.getWithMetadata(`${trip.id}/state`, { type: 'json' });
      if (!current || current.data.status !== 'ready' || current.data.revision !== videoRevision(trip, current.data.style)) return json({ error: 'Generate an up-to-date video before changing the image source.' }, 409);
      const next = { ...current.data, posterAsImage: options.posterAsImage };
      if (!(await store.setJSON(`${trip.id}/state`, next, { onlyIfMatch: current.etag })).modified) return json({ error: 'Preview changed. Refresh and try again.' }, 409);
      return json(next);
    }
    if (request.method === 'POST') {
      if (!internalKey) return json({ error: 'Video generation is not configured.' }, 503);
      if (Number(request.headers.get('content-length') || 0) > 2048) return json({ error: 'Request too large.' }, 413);
      const body = await request.text();
      if (body.length > 2048) return json({ error: 'Request too large.' }, 413);
      const options = body ? JSON.parse(body) : {};
      const style = normalizeTripVideoStyle(options.style ?? state?.style);
      if (!trip.items?.some(item => item.type === 'city' && item.coordinates)) return json({ error: 'Trip needs mapped cities before rendering.' }, 422);
      const result = await claimVideo(store, trip.id, videoRevision(trip, style), style, options.force === true);
      state = result.state || null;
      if (!result.claimed) return json({ ...state, limited: result.limited || false, ...(result.limited ? { error: 'A video can be generated once per trip per hour. Try again after the cooldown.' } : {}) }, result.limited ? 429 : 200);
      if (!await claimRenderBudget(store)) {
        state = { ...state!, status: 'failed', error: 'Hourly render budget reached. Try again next hour.' };
        await store.setJSON(`${trip.id}/state`, state);
        return json(state, 429);
      }
      try {
        const worker = new URL('/.netlify/functions/trip-og-video-background', url.origin);
        const response = await fetch(worker, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tf-admin-key': internalKey },
          body: JSON.stringify({ tripId: trip.id, jobId: state!.jobId }), signal: AbortSignal.timeout(8000) });
        if (response.status !== 202) throw new Error('Worker did not accept the render.');
      } catch {
        state = { ...state!, status: 'failed', error: 'Could not start the video worker. Try again after the cooldown.' };
        await store.setJSON(`${trip.id}/state`, state);
        return json(state, 503);
      }
      return json(state, 202);
    }
    const stale = Boolean(state && state.revision !== videoRevision(trip, state.style));
    if (url.searchParams.get('status') === '1') return json({ ...state, status: state?.status || 'missing', stale, spec: TRIP_VIDEO });
    if (state?.status !== 'ready' || (!manager && stale) || (url.searchParams.has('r') && url.searchParams.get('r') !== state.revision)) return json({ error: 'Video preview is not ready.' }, 404);
    const poster = url.searchParams.get('asset') === 'poster';
    const entry = await store.getWithMetadata(`${trip.id}/${poster ? 'poster' : 'video'}`, { type: 'arrayBuffer' });
    if (!entry) return json({ error: 'Video preview unavailable.' }, 404);
    const bytes = new Uint8Array(entry.data);
    const range = poster ? null : parseVideoRange(request.headers.get('range'), bytes.byteLength);
    const headers = new Headers({ 'content-type': poster ? 'image/jpeg' : 'video/mp4', 'cache-control': 'private, no-store',
      'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff', etag: entry.etag });
    if (range === 'invalid') { headers.set('content-range', `bytes */${bytes.byteLength}`); return new Response(null, { status: 416, headers }); }
    if (range) headers.set('content-range', `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
    const body = range ? bytes.slice(range.start, range.end + 1) : bytes;
    headers.set('content-length', String(body.byteLength));
    return new Response(request.method === 'HEAD' ? null : body, { status: range ? 206 : 200, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid request JSON.' }, 400);
    console.error('[trip-og-video] request failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Video preview temporarily unavailable.' }, 503);
  }
};

export const config: Config = { path: '/api/og/trip-video', rateLimit: { action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 120 } };
