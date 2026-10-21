import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn(), render: vi.fn(), purge: vi.fn(), store: null as any }));
vi.mock('../../netlify/lib/trip-video-access.ts', () => ({ loadTripForVideo: mocks.load }));
vi.mock('../../netlify/lib/trip-video-renderer.ts', () => ({ renderTripVideo: mocks.render }));
vi.mock('../../netlify/lib/trip-video-cache.ts', () => ({ refreshTripVideoMetadata: mocks.purge }));
vi.mock('../../netlify/lib/trip-video-store.ts', () => ({ videoStore: () => mocks.store, videoRevision: () => 'new-revision' }));
import handler from '../../netlify/functions/trip-og-video-background.mts';
const id = '4fee56dd-a79a-4130-bef0-cc7ffb552ea5';
const jobId = '11111111-1111-4111-8111-111111111111';
const attachment = { assetKey: 'old-job', revision: 'old-revision', mediaRevision: 'old-media', style: 'standard', requestedAt: 0 };
const request = () => new Request('https://feature.example.com/.netlify/functions/trip-og-video-background', { method: 'POST', headers: { 'x-tf-admin-key': 'key', 'content-type': 'application/json' }, body: JSON.stringify({ tripId: id, jobId }) });
let state: any, etag: number;
beforeEach(() => {
  vi.stubEnv('TF_ADMIN_API_KEY', 'key');
  state = { status: 'queued', jobId, revision: 'new-revision', style: 'standard', requestedAt: Date.now(), previousReady: attachment };
  etag = 1;
  mocks.store = {
    get: vi.fn(async () => []),
    getWithMetadata: vi.fn(async () => ({ data: state, etag: String(etag) })),
    setJSON: vi.fn(async (_key, next, options) => {
      if (options?.onlyIfMatch !== String(etag)) return { modified: false };
      state = next; etag++; return { modified: true };
    }),
    set: vi.fn(async () => {}), delete: vi.fn(async () => {}),
  };
  mocks.load.mockResolvedValue({ id, items: [] });
  mocks.render.mockResolvedValue({ video: Buffer.from('video'), poster: Buffer.from('poster') });
});
describe('atomic video replacement worker', () => {
  it('uploads immutable files and atomically publishes them before removing the previous pair', async () => {
    await handler(request());
    expect(mocks.store.set).toHaveBeenCalledWith(`${id}/media/${jobId}/video`, expect.any(ArrayBuffer));
    expect(mocks.store.setJSON.mock.calls[0][1]).toMatchObject({ status: 'rendering', previousReady: attachment });
    expect(state).toMatchObject({ status: 'ready', assetKey: jobId, previousReady: undefined });
    expect(mocks.store.delete).toHaveBeenCalledWith(`${id}/media/old-job/video`);
    expect(mocks.store.delete).toHaveBeenCalledWith(`${id}/media/old-job/poster`);
    const published = mocks.store.setJSON.mock.invocationCallOrder[1];
    expect(mocks.store.delete.mock.invocationCallOrder[0]).toBeGreaterThan(published);
  });
  it('retains the last successful attachment if encoding fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.render.mockRejectedValueOnce(new Error('encoder failed'));
    await handler(request());
    expect(state).toMatchObject({ status: 'failed', previousReady: attachment });
    expect(mocks.store.delete).not.toHaveBeenCalledWith(`${id}/media/old-job/video`);
    log.mockRestore();
  });
  it('never publishes files after another writer takes the lease', async () => {
    const setJSON = mocks.store.setJSON;
    setJSON.mockImplementation(async (_key, next) => {
      if (next.status === 'ready') return { modified: false };
      state = next; etag++; return { modified: true };
    });
    await handler(request());
    expect(state).toMatchObject({ status: 'rendering', previousReady: attachment });
    expect(mocks.store.delete).toHaveBeenCalledWith(`${id}/media/${jobId}/video`);
    expect(mocks.store.delete).not.toHaveBeenCalledWith(`${id}/media/old-job/video`);
  });
});
