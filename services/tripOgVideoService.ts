import { supabase } from './supabaseClient';
import type { TripVideoState, TripVideoAttachment, TripVideoStyle, TripVideoRouteMode } from '../shared/tripOgVideo';

export interface TripVideoPreviewState extends Omit<TripVideoState, 'status'> {
  status: TripVideoState['status'] | 'missing';
  stale?: boolean;
  attached?: TripVideoAttachment & { stale?: boolean };
  limited?: boolean;
}

const videoRequest = async (tripId: string, query: string, init?: RequestInit) => {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Sign in to manage trip previews.');
  const response = await fetch(`/api/og/trip-video?trip=${encodeURIComponent(tripId)}${query}`, {
    ...init, signal: AbortSignal.timeout(15_000), headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Could not load trip preview.');
  }
  return response;
};
export const getTripVideoState = async (tripId: string): Promise<TripVideoPreviewState> => (await videoRequest(tripId, '&status=1')).json();
export const requestTripVideo = async (tripId: string, options: { style?: TripVideoStyle; routeMode?: TripVideoRouteMode; force?: boolean } = {}): Promise<TripVideoPreviewState> =>
  (await videoRequest(tripId, '', { method: 'POST', body: JSON.stringify(options) })).json();
export const getTripVideoAsset = async (tripId: string, asset: 'poster' | 'video'): Promise<Blob> =>
  (await videoRequest(tripId, asset === 'poster' ? '&asset=poster' : '')).blob();

const requestedRevisions = new Map<string, number>();
export const enqueueTripVideoBestEffort = (tripId: string): void => {
  // Memory only, bounded: autosaves never repeatedly call the endpoint in one session.
  const previous = requestedRevisions.get(tripId) || 0;
  if (Date.now() - previous < 60 * 60_000) return;
  if (requestedRevisions.size >= 100) requestedRevisions.delete(requestedRevisions.keys().next().value!);
  requestedRevisions.set(tripId, Date.now());
  void requestTripVideo(tripId).catch(() => { requestedRevisions.delete(tripId); });
};

export const setTripVideoImageSource = async (tripId: string, posterAsImage: boolean): Promise<TripVideoPreviewState> =>
  (await videoRequest(tripId, '', { method: 'PATCH', body: JSON.stringify({ posterAsImage }) })).json();
