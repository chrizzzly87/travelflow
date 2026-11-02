import { fetchSharedTrip, fetchSharedTripByTripId, type TripPayload } from '../edge-lib/trip-og-data.ts';

const dbFetch = (path: string, authorization: string, init?: RequestInit) => fetch(`${process.env.VITE_SUPABASE_URL}${path}`, {
  ...init, signal: AbortSignal.timeout(8000), headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || '', authorization, 'content-type': 'application/json' },
});

export const loadTripForVideo = async (tripId: string): Promise<TripPayload | null> => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=id,data,status,trip_expires_at,owner_id`, {
    headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const row = (await response.json())[0];
  if (!row || row.status === 'archived' || row.status === 'expired' || (row.trip_expires_at && Date.parse(row.trip_expires_at) <= Date.now())) return null;
  return row.data ? { ...row.data, id: row.id } : null;
};

export const canManageTripVideo = async (request: Request, tripId: string): Promise<boolean> => {
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer .+/.test(authorization)) return false;
  const userResponse = await dbFetch('/auth/v1/user', authorization);
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  if (!user.id) return false;
  const owned = await dbFetch(`/rest/v1/trips?id=eq.${tripId}&owner_id=eq.${encodeURIComponent(user.id)}&select=id`, authorization);
  if (owned.ok && (await owned.json()).length > 0) return true;
  const access = await dbFetch('/rest/v1/rpc/get_current_user_access', authorization, { method: 'POST', body: '{}' });
  if (!access.ok) return false;
  const data = await access.json();
  return (Array.isArray(data) ? data[0] : data)?.system_role === 'admin';
};

export const resolvePublicVideoTrip = async (url: URL) => {
  // Version snapshots stay image-only: never attach today's video to a past itinerary.
  if (url.searchParams.has('v')) return null;
  const token = url.searchParams.get('s');
  if (token) return (await fetchSharedTrip(token, null))?.trip || null;
  const tripId = url.searchParams.get('trip');
  return tripId ? (await fetchSharedTripByTripId(tripId, null))?.sharedTrip.trip || null : null;
};
