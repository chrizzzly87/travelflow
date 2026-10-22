import { describe, expect, it, vi } from 'vitest';
const purge = vi.hoisted(() => vi.fn());
vi.mock('@netlify/functions', () => ({ purgeCache: purge }));
import { refreshTripVideoMetadata } from '../../netlify/lib/trip-video-cache';
describe('trip sharing cache refresh', () => {
  it('purges only the current domain and trip tag', async () => {
    await refreshTripVideoMetadata('trip-id', 'https://feature--travelflowapp.netlify.app/.netlify/functions/worker');
    expect(purge).toHaveBeenCalledWith({ domain: 'feature--travelflowapp.netlify.app', tags: ['trip-og-trip-id'] });
  });
  it('keeps a completed video when cache invalidation is temporarily unavailable', async () => {
    purge.mockRejectedValueOnce(new Error('offline'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(refreshTripVideoMetadata('trip-id', 'https://feature.example.com')).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalled(); warning.mockRestore();
  });
});
