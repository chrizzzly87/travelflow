import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ manage: vi.fn(), load: vi.fn(), publicTrip: vi.fn(), get: vi.fn(), getWithMetadata: vi.fn(), setJSON: vi.fn(), claim: vi.fn(), budget: vi.fn(), store: vi.fn() }));
vi.mock('../../netlify/lib/trip-video-access.ts', () => ({ canManageTripVideo: mocks.manage, loadTripForVideo: mocks.load, resolvePublicVideoTrip: mocks.publicTrip }));
vi.mock('../../netlify/lib/trip-video-store.ts', () => ({ videoStore: (deploy: unknown) => { mocks.store(deploy); return { get: mocks.get, getWithMetadata: mocks.getWithMetadata, setJSON: mocks.setJSON }; }, videoRevision: () => 'a'.repeat(24), claimVideo: mocks.claim, claimRenderBudget: mocks.budget }));
vi.mock('../../netlify/lib/trip-video-cache.ts', () => ({ refreshTripVideoMetadata: vi.fn() }));
import handler from '../../netlify/functions/trip-og-video.mts';
const id = '4fee56dd-a79a-4130-bef0-cc7ffb552ea5';
const trip = { id, title: 'Taiwan', items: [{ type: 'city', coordinates: { lat: 25, lng: 121 } }] };
const ready = { status: 'ready', style: 'clean', revision: 'a'.repeat(24), bytes: 10 };
const req = (params = '', init?: RequestInit) => new Request(`https://example.com/api/og/trip-video?trip=${id}${params}`, init);

describe('trip video API regression coverage', () => {
  beforeEach(() => {
    vi.stubEnv('TF_ADMIN_API_KEY', 'internal-key');
    mocks.manage.mockResolvedValue(false); mocks.load.mockResolvedValue(trip); mocks.publicTrip.mockResolvedValue(trip);
    mocks.get.mockResolvedValue(ready); mocks.getWithMetadata.mockResolvedValue({ data: new Uint8Array(10).buffer, etag: 'video' });
    mocks.setJSON.mockResolvedValue({ modified: true });
  });
  it('uses the handler context for isolated stores even without SDK globals', async () => {
    await handler(req('&status=1'), { deploy: { context: 'branch-deploy', id: 'cli-preview' } } as any);
    expect(mocks.store).toHaveBeenCalledWith({ context: 'branch-deploy', id: 'cli-preview' });
  });
  it('rejects public render attempts without dispatching expensive work', async () => {
    expect((await handler(req('', { method: 'POST', body: '{}' }))).status).toBe(403);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('public metadata reads never enqueue jobs', async () => {
    expect(await (await handler(req('&status=1'))).json()).toMatchObject({ status: 'ready', stale: false });
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('checks revoked share access even if media exists', async () => {
    mocks.publicTrip.mockResolvedValue(null);
    expect((await handler(req())).status).toBe(404);
    expect(mocks.getWithMetadata).not.toHaveBeenCalled();
  });
  it('serves small byte ranges and body-free HEAD correctly', async () => {
    const response = await handler(req('', { headers: { range: 'bytes=2-4' } }));
    expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 2-4/10');
    expect((await response.arrayBuffer()).byteLength).toBe(3);
    const head = await handler(req('', { method: 'HEAD' }));
    expect(head.headers.get('content-type')).toBe('video/mp4');
    expect(head.headers.get('content-length')).toBe('10'); expect(await head.text()).toBe('');
  });
  it('rejects invalid ranges and mismatched media revisions', async () => {
    expect((await handler(req('', { headers: { range: 'bytes=99-' } }))).status).toBe(416);
    expect((await handler(req('&r=old'))).status).toBe(404);
  });
  it('returns immediately when a render is already claimed', async () => {
    mocks.manage.mockResolvedValue(true); mocks.claim.mockResolvedValue({ claimed: false, state: { status: 'queued' } });
    expect(await (await handler(req('', { method: 'POST', body: '{}' }))).json()).toMatchObject({ status: 'queued' });
    expect(mocks.budget).not.toHaveBeenCalled();
  });
  it('does not dispatch if the global render budget is exhausted', async () => {
    mocks.manage.mockResolvedValue(true); mocks.claim.mockResolvedValue({ claimed: true, state: { status: 'queued', jobId: 'job' } }); mocks.budget.mockResolvedValue(false);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect((await handler(req('', { method: 'POST', body: '{}' }))).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('dispatches an authenticated background job and returns 202', async () => {
    mocks.manage.mockResolvedValue(true); mocks.claim.mockResolvedValue({ claimed: true, state: { status: 'queued', jobId: 'job' } }); mocks.budget.mockResolvedValue(true);
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 })); vi.stubGlobal('fetch', fetchMock);
    expect((await handler(req('', { method: 'POST', body: '{"style":"dark"}' }))).status).toBe(202);
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://example.com/.netlify/functions/trip-og-video-background'), expect.objectContaining({ headers: expect.objectContaining({ 'x-tf-admin-key': 'internal-key' }), body: JSON.stringify({ tripId: id, jobId: 'job' }) }));
  });
  it.each(['queued', 'rendering', 'failed'])('keeps the last good video and poster accessible while replacement is %s', async status => {
    mocks.get.mockResolvedValue({ status, revision: 'new', style: 'standard', previousReady: { ...ready, assetKey: 'old-job', mediaRevision: 'b'.repeat(24) } });
    expect((await handler(req('&r=' + 'b'.repeat(24)))).status).toBe(200);
    expect(mocks.getWithMetadata).toHaveBeenCalledWith(`${id}/media/old-job/video`, { type: 'arrayBuffer' });
    expect((await handler(req('&asset=poster&r=' + 'b'.repeat(24)))).status).toBe(200);
  });
  it('passes selected map and route settings to the atomic render claim', async () => {
    mocks.manage.mockResolvedValue(true); mocks.claim.mockResolvedValue({ claimed: false, state: { status: 'queued' } });
    await handler(req('', { method: 'POST', body: '{"style":"satellite","routeMode":"realistic","format":"classic","force":true}' }));
    expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), id, expect.any(String), 'satellite', true, expect.any(Number), 'realistic', 'classic');
  });
  it('detects playground settings mismatch without generating and versions refreshed media independently of content', async () => {
    mocks.get.mockResolvedValue({ ...ready, mediaRevision: 'b'.repeat(24), routeMode: 'realistic' });
    expect(await (await handler(req('&status=1&mapStyle=dark&routeMode=simple&format=classic'))).json()).toMatchObject({ settingsMatch: false });
    expect((await handler(req('&r=' + 'b'.repeat(24)))).status).toBe(200);
    expect((await handler(req('&r=' + ready.revision))).status).toBe(404);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('reports the attached ratio and treats a format-only change as a cache mismatch without rendering', async () => {
    mocks.get.mockResolvedValue({ ...ready, format: 'classic' });
    expect(await (await handler(req('&status=1&format=classic'))).json()).toMatchObject({ settingsMatch: true, spec: { width: 960, height: 720 } });
    expect(await (await handler(req('&status=1&format=wide'))).json()).toMatchObject({ settingsMatch: false });
    mocks.get.mockResolvedValue(ready);
    expect(await (await handler(req('&status=1&format=wide'))).json()).toMatchObject({ settingsMatch: true, spec: { width: 1200, height: 630 } });
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('changes poster attachment atomically without claiming a render', async () => {
    mocks.manage.mockResolvedValue(true); mocks.getWithMetadata.mockResolvedValue({ data: ready, etag: 'state' });
    expect((await handler(req('', { method: 'PATCH', body: '{"posterAsImage":true}' }))).status).toBe(200);
    expect(mocks.setJSON).toHaveBeenCalledWith(`${id}/state`, expect.objectContaining({ posterAsImage: true }), { onlyIfMatch: 'state' });
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
