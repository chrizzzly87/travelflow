export const TRIP_VIDEO = {
  width: 1200, height: 630, fps: 12, seconds: 6, maxBytes: 2 * 1024 * 1024,
  maxStops: 30, cooldownMs: 60 * 60 * 1000, refreshCooldownMs: 5 * 60_000, renderTimeoutMs: 90_000,
  leaseMs: 5 * 60_000, hourlyRenderLimit: 20, rendererVersion: 3,
} as const;

export type TripVideoStyle = 'clean' | 'minimal' | 'standard' | 'dark' | 'satellite';
export type TripVideoRouteMode = 'simple' | 'realistic';
export const normalizeTripVideoRouteMode = (value: unknown): TripVideoRouteMode => value === 'realistic' ? 'realistic' : 'simple';
export const normalizeTripVideoStyle = (style: unknown): TripVideoStyle => ['clean', 'minimal', 'standard', 'dark', 'satellite'].includes(String(style)) ? style as TripVideoStyle : 'standard';
export const isTripVideoId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export interface TripVideoState {
  status: 'queued' | 'rendering' | 'ready' | 'failed';
  jobId: string;
  revision: string;
  style: TripVideoStyle;
  routeMode?: TripVideoRouteMode;
  mediaRevision?: string;
  requestedAt: number;
  bytes?: number;
  posterAsImage?: boolean;
  error?: string;
  assetKey?: string;
  previousReady?: TripVideoAttachment;
}

export type TripVideoAttachment = Pick<TripVideoState, 'revision' | 'style' | 'routeMode' | 'requestedAt' | 'bytes' | 'posterAsImage' | 'mediaRevision' | 'assetKey'>;
export const tripVideoAttachment = (state: TripVideoState | null | undefined): TripVideoAttachment | null => {
  if (!state) return null;
  if (state.status !== 'ready') return state.previousReady || null;
  const { revision, style, routeMode, requestedAt, bytes, posterAsImage, mediaRevision, assetKey } = state;
  return { revision, style, routeMode, requestedAt, bytes, posterAsImage, mediaRevision, assetKey };
};
export const tripVideoAssetPath = (tripId: string, media: TripVideoAttachment, asset: 'video' | 'poster') =>
  media.assetKey ? `${tripId}/media/${media.assetKey}/${asset}` : `${tripId}/${asset}`;

// Single ranges only; never allocate an attacker-controlled buffer or serve beyond EOF.
export const parseVideoRange = (header: string | null, size: number): { start: number; end: number } | null | 'invalid' => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return 'invalid';
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end || start < 0) return 'invalid';
  return { start, end };
};

export const tripVideoLeaseExpired = (state: Pick<TripVideoState, 'status' | 'requestedAt'>, now = Date.now()): boolean =>
  ['queued', 'rendering'].includes(state.status) && now - state.requestedAt >= TRIP_VIDEO.leaseMs;
