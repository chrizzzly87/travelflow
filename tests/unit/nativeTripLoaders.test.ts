import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTrip } from '../helpers/tripFixtures';
const mocks = vi.hoisted(() => ({
    db: true, state: 'online', local: vi.fn(), history: vi.fn(), queued: vi.fn(), decompress: vi.fn(),
    remote: vi.fn(), version: vi.fn(), shared: vi.fn(), sharedVersion: vi.fn(), access: vi.fn(), fetch: vi.fn(), save: vi.fn(), factory: vi.fn(), summary: vi.fn(),
}));
vi.mock('../../config/db', () => ({ get DB_ENABLED() { return mocks.db; } }));
vi.mock('../../services/supabaseHealthMonitor', () => ({ getConnectivitySnapshot: () => ({ state: mocks.state }) }));
vi.mock('../../services/storageService', () => ({ getTripById: mocks.local, saveTrip: mocks.save }));
vi.mock('../../services/historyService', () => ({ findHistoryEntryByUrl: mocks.history }));
vi.mock('../../services/offlineChangeQueue', () => ({ hasQueuedTripCommit: mocks.queued }));
vi.mock('../../services/dbApi', () => ({ dbGetTrip: mocks.remote, dbGetTripVersion: mocks.version, dbGetSharedTrip: mocks.shared, dbGetSharedTripVersion: mocks.sharedVersion }));
vi.mock('../../services/authService', () => ({ getCurrentAccessContext: mocks.access }));
vi.mock('../../utils', () => ({
    decompressTrip: mocks.decompress,
    buildTripUrl: (id: string, version?: string) => `/trip/${id}${version ? `?v=${version}` : ''}`,
    buildShareUrl: (id: string, version?: string) => `/s/${id}${version ? `?v=${version}` : ''}`,
    isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f-]+$/i.test(value),
}));
vi.mock('../../data/exampleTripTemplates/runtimeFactory', () => ({ loadExampleTemplateFactory: mocks.factory, getExampleTemplateSummary: mocks.summary }));
import { loadOwnedTrip } from '../../features/trips/loadOwnedTrip';
import { loadSharedTrip } from '../../features/trips/loadSharedTrip';
import { loadExampleTrip } from '../../features/trips/loadExampleTrip';
const trip = () => makeTrip({ id: 'trip-a', title: 'Current', updatedAt: 1000 });
const versionId = '12345678-abcd-abcd-abcd-123456789012';
const signal = () => new AbortController().signal;
const owned = (extra: Partial<Parameters<typeof loadOwnedTrip>[0]> = {}) => loadOwnedTrip({ tripId: 'trip-a', href: '/trip/trip-a', signal: signal(), ...extra });
const shared = (extra: Partial<Parameters<typeof loadSharedTrip>[0]> = {}) => loadSharedTrip({ token: 'token', signal: signal(), ...extra });
const target = async (promise: Promise<unknown>) => (await promise.catch(error => error)).options?.href;

beforeEach(() => {
    vi.clearAllMocks(); mocks.db = true; mocks.state = 'online';
    mocks.local.mockReturnValue(null); mocks.history.mockReturnValue(null); mocks.queued.mockReturnValue(false); mocks.decompress.mockReturnValue(null);
    mocks.remote.mockResolvedValue(null); mocks.version.mockResolvedValue(null); mocks.shared.mockResolvedValue(null); mocks.sharedVersion.mockResolvedValue(null); mocks.access.mockResolvedValue(null);
    mocks.fetch.mockResolvedValue({ ok: false }); vi.stubGlobal('fetch', mocks.fetch);
    mocks.factory.mockResolvedValue((startDate: string) => makeTrip({ startDate })); mocks.summary.mockReturnValue({ title: 'Japan', countries: [{ name: 'Japan' }] });
});

describe('native owned trip resolution', () => {
    it('opens encoded trips and preserves this device’s favorite without cloud work', async () => {
        mocks.decompress.mockReturnValue({ trip: trip(), view: { mapStyle: 'clean' } }); mocks.local.mockReturnValue({ ...trip(), isFavorite: true });
        const data = await owned();
        expect(data.trip.isFavorite).toBe(true); expect(data.view?.mapStyle).toBe('clean'); expect(mocks.remote).not.toHaveBeenCalled();
    });
    it('opens local trips without a configured backend', async () => {
        mocks.db = false; mocks.local.mockReturnValue(trip());
        expect((await owned()).trip.title).toBe('Current'); expect(mocks.remote).not.toHaveBeenCalled();
    });
    it('resolves offline history without overwriting the current saved trip', async () => {
        mocks.state = 'offline'; mocks.local.mockReturnValue(trip()); mocks.history.mockReturnValue({ snapshot: { trip: { ...trip(), title: 'Snapshot' }, view: { mapStyle: 'satellite' } } });
        const data = await owned({ versionId: 'local-version' });
        expect(data.trip.title).toBe('Snapshot'); expect(data.view?.mapStyle).toBe('satellite'); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.remote).not.toHaveBeenCalled();
    });
    it('distinguishes missing offline data from a missing local-only trip', async () => {
        mocks.state = 'offline'; expect(await target(owned())).toBe('/share-unavailable?reason=offline');
        mocks.db = false; expect(await target(owned())).toBe('/create-trip');
    });
    it('preserves queued edits only when the backend confirms owner access', async () => {
        mocks.local.mockReturnValue({ ...trip(), title: 'Queued', updatedAt: 2000 }); mocks.queued.mockReturnValue(true);
        mocks.remote.mockResolvedValue({ trip: trip(), access: { source: 'owner' } });
        expect((await owned()).trip.title).toBe('Queued');
        mocks.remote.mockResolvedValue({ trip: trip(), access: { source: 'public_read' } });
        const data = await owned(); expect(data.trip.title).toBe('Current'); expect(data.access?.source).toBe('public_read');
    });
    it('uses a newer cloud trip when there are no queued local edits', async () => {
        mocks.local.mockReturnValue(trip()); mocks.remote.mockResolvedValue({ trip: { ...trip(), title: 'Cloud', updatedAt: 3000 }, access: { source: 'owner' } });
        expect((await owned()).trip.title).toBe('Cloud');
    });
    it('resolves snapshot data with current access and never persists browsing reads', async () => {
        mocks.remote.mockResolvedValue({ trip: trip(), access: { source: 'admin_fallback' } }); mocks.version.mockResolvedValue({ trip: { ...trip(), title: 'Historical' }, view: null });
        const data = await owned({ versionId }); expect(data.trip.title).toBe('Historical'); expect(data.access?.source).toBe('admin_fallback'); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('keeps an unproven historical read read-only', async () => {
        mocks.version.mockResolvedValue({ trip: trip(), view: null });
        expect((await owned({ versionId })).access?.source).toBe('public_read');
    });
    it('falls back to cached local data on network rejection', async () => {
        mocks.local.mockReturnValue(trip()); mocks.remote.mockRejectedValue(new Error('unavailable'));
        expect((await owned()).trip.id).toBe('trip-a');
    });
    it('ignores a late response after native route cancellation', async () => {
        const abort = new AbortController(); mocks.remote.mockImplementation(async () => { abort.abort(); return { trip: trip(), access: { source: 'owner' } }; });
        await expect(owned({ signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('redirects unresolved anonymous links through a safe login return URL', async () => {
        expect(await target(owned({ href: '/trip/trip-a?tag=one&tag=two#day-2' }))).toBe('/login?next=%2Ftrip%2Ftrip-a%3Ftag%3Done%26tag%3Dtwo%23day-2');
    });
    it('resolves public share links while rejecting a foreign redirect origin', async () => {
        mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ path: '/s/safe?v=1' }) });
        expect(await target(owned())).toBe('/s/safe?v=1');
        mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ path: 'https://example.com/s/foreign' }) });
        expect(await target(owned())).toContain('/login?next=');
    });
});

describe('native shared trip resolution', () => {
    it('resolves access from the current token before considering any history', async () => {
        mocks.history.mockReturnValue({ snapshot: { trip: trip() } });
        expect(await target(shared({ versionId: 'local' }))).toBe('/share-unavailable'); expect(mocks.history).not.toHaveBeenCalled();
    });
    it('preserves token mode, copy permission and shared view settings', async () => {
        mocks.shared.mockResolvedValue({ trip: trip(), mode: 'view', allowCopy: false, shareView: { mapStyle: 'minimal' }, latestVersionId: 'latest' });
        const data = await shared(); expect(data.shareMode).toBe('view'); expect(data.allowCopy).toBe(false); expect(data.view?.mapStyle).toBe('minimal'); expect(data.sourceShareVersionId).toBe('latest');
    });
    it('rejects expired shares at the expiry boundary', async () => {
        mocks.shared.mockResolvedValue({ trip: { ...trip(), tripExpiresAt: new Date(Date.now() - 1).toISOString() }, mode: 'edit' });
        expect(await target(shared())).toBe('/share-unavailable');
    });
    it('keeps snapshot browsing read-only when the current token is read-only', async () => {
        mocks.shared.mockResolvedValue({ trip: trip(), mode: 'view', latestVersionId: 'newer' });
        mocks.sharedVersion.mockResolvedValue({ trip: { ...trip(), title: 'Snapshot' }, versionId, latestVersionId: 'newer', view: { mapStyle: 'satellite' } });
        const data = await shared({ versionId });
        expect(data.shareMode).toBe('view'); expect(data.trip.title).toBe('Snapshot'); expect(data.snapshotState).toEqual({ hasNewer: true, latestUrl: '/s/token' }); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('uses an authorized local snapshot without granting owner access', async () => {
        mocks.shared.mockResolvedValue({ trip: trip(), mode: 'view' }); mocks.history.mockReturnValue({ snapshot: { trip: { ...trip(), title: 'Local snapshot' } } });
        const data = await shared({ versionId: 'local' }); expect(data.trip.title).toBe('Local snapshot'); expect(data.shareMode).toBe('view'); expect(data.access).toBeNull();
    });
    it('rejects missing offline shares without issuing a network read', async () => {
        mocks.state = 'offline'; expect(await target(shared())).toBe('/share-unavailable?reason=offline'); expect(mocks.shared).not.toHaveBeenCalled();
    });
    it('does not publish stale shared data after cancellation', async () => {
        const abort = new AbortController(); mocks.shared.mockImplementation(async () => { abort.abort(); return { trip: trip(), mode: 'edit' }; });
        await expect(shared({ signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('native example trip resolution', () => {
    it('creates a complete preview without writing an owned trip', async () => {
        const data = await loadExampleTrip('japan-spring', signal());
        expect(data.trip).toMatchObject({ isExample: true, exampleTemplateId: 'japan-spring', sourceOwnerType: 'system_catalog' }); expect(data.countries).toEqual(['Japan']); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('uses native not-found behavior for an unknown template', async () => {
        mocks.factory.mockResolvedValue(null); await expect(loadExampleTrip('unknown', signal())).rejects.toMatchObject({ isNotFound: true });
    });
    it('cancels pending template work before constructing the trip', async () => {
        const factory = vi.fn(); const abort = new AbortController(); mocks.factory.mockImplementation(async () => { abort.abort(); return factory; });
        await expect(loadExampleTrip('japan-spring', abort.signal)).rejects.toMatchObject({ name: 'AbortError' }); expect(factory).not.toHaveBeenCalled();
    });
});
