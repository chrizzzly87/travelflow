import { escapeHtml } from './trip-og-data.ts';

export const buildTripVideoMetaTags = (videoUrl?: string): string[] => videoUrl ? [
  `<meta property="og:video" content="${escapeHtml(videoUrl)}" />`,
  `<meta property="og:video:secure_url" content="${escapeHtml(videoUrl)}" />`,
  '<meta property="og:video:type" content="video/mp4" />',
  '<meta property="og:video:width" content="1200" />',
  '<meta property="og:video:height" content="630" />',
] : [];

export const resolveReadyTripVideoMedia = async (origin: string, target: { token?: string; tripId?: string; versionId: string | null }): Promise<{ videoUrl: string; posterUrl?: string } | undefined> => {
  if (target.versionId) return undefined;
  try {
    const url = new URL('/api/og/trip-video', origin);
    if (target.token) url.searchParams.set('s', target.token);
    else if (target.tripId) url.searchParams.set('trip', target.tripId);
    else return undefined;
    url.searchParams.set('status', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return undefined;
    const state = await response.json();
    if (state.status !== 'ready' || state.stale || !/^[a-f0-9]{24}$/.test(state.revision)) return undefined;
    url.searchParams.delete('status');
    url.searchParams.set('r', state.revision);
    const videoUrl = url.toString();
    url.searchParams.set('asset', 'poster');
    return { videoUrl, posterUrl: state.posterAsImage ? url.toString() : undefined };
  } catch { return undefined; }
};
