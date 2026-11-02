import { tripVideoDimensions, tripVideoMetadata } from '../../shared/tripOgVideo.ts';
import { escapeHtml } from './trip-og-data.ts';

export const buildTripVideoMetaTags = (videoUrl?: string, dimensions = tripVideoDimensions()): string[] =>
  tripVideoMetadata(videoUrl, dimensions).map(({ property, content }) => `<meta property="${property}" content="${escapeHtml(content)}" />`);

export const resolveReadyTripVideoMedia = async (origin: string, target: { token?: string; tripId?: string; versionId: string | null }): Promise<{ videoUrl: string; posterUrl?: string; dimensions: { width: number; height: number } } | undefined> => {
  if (target.versionId) return undefined;
  try {
    const url = new URL('/api/og/trip-video', origin);
    if (target.token) url.searchParams.set('s', target.token);
    else if (target.tripId) url.searchParams.set('trip', target.tripId);
    else return undefined;
    url.searchParams.set('status', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const result = await response.json();
    const state = result.status === 'ready' ? result : result.attached ? { ...result.attached, status: 'ready' } : result;
    if (state.status !== 'ready' || state.stale || !/^[a-f0-9]{24}$/.test(state.revision)) return undefined;
    url.searchParams.delete('status');
    const mediaRevision = state.mediaRevision || state.revision;
    if (!/^[a-f0-9]{24}$/.test(mediaRevision)) return undefined;
    url.searchParams.set('r', mediaRevision);
    const videoUrl = url.toString();
    url.pathname = '/api/og/trip-poster.jpg';
    return { videoUrl, dimensions: tripVideoDimensions(state.format), posterUrl: state.posterAsImage ? url.toString() : undefined };
  } catch { return undefined; }
};
