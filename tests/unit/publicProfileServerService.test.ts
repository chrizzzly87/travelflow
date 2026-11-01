import { describe, expect, it, vi } from 'vitest';
import { loadPublicProfilePageData, type PublicProfileReader } from '../../services/publicProfileServerService';
import { normalizePublicProfileHandle } from '../../shared/publicProfile';

// Every column the handle resolver returns, plus private ones a row must never leak.
const resolverRow = (overrides: Record<string, unknown> = {}) => ({
    status: 'found',
    canonical_username: 'traveler',
    id: 'user-1',
    display_name: 'Traveler One',
    first_name: 'Traveler',
    last_name: 'One',
    username: 'traveler',
    username_display: 'TrAveler',
    bio: 'Slow travel fan',
    country: 'de',
    city: 'Hamburg',
    preferred_language: 'de',
    public_profile_enabled: true,
    account_status: 'active',
    username_changed_at: '2026-01-05T00:00:00Z',
    email: 'traveler@example.com',
    gender: 'female',
    onboarding_completed_at: '2026-01-01T00:00:00Z',
    ...overrides,
});

const tripRow = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    status: 'active',
    trip_expires_at: null,
    source_kind: null,
    source_template_id: null,
    show_on_public_profile: true,
    data: { id, title: `Trip ${id}`, items: [], startDate: '2026-05-01', createdAt: 1, updatedAt: 1 },
    ...overrides,
});

const makeReader = (resolved: { data: unknown; error: { message?: string } | null }, trips: { data: unknown; error: { message?: string } | null } = { data: [], error: null }) => {
    const reader: PublicProfileReader = {
        resolveHandle: vi.fn(async () => resolved),
        listPublicTrips: vi.fn(async () => trips),
    };
    return reader;
};

describe('public profile server loader', () => {
    it('returns only public profile fields and the first page of public trips', async () => {
        const reader = makeReader({ data: [resolverRow()], error: null }, { data: [tripRow('t1'), tripRow('t2')], error: null });
        const result = await loadPublicProfilePageData('traveler', reader);

        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.profile).toEqual({
            id: 'user-1',
            username: 'traveler',
            usernameDisplay: 'TrAveler',
            displayName: 'Traveler One',
            firstName: 'Traveler',
            lastName: 'One',
            bio: 'Slow travel fan',
            country: 'DE',
            city: 'Hamburg',
        });
        const serialized = JSON.stringify(result);
        for (const secret of ['traveler@example.com', 'female', 'preferred', 'account_status', 'onboarding', '2026-01-05']) {
            expect(serialized).not.toContain(secret);
        }
        expect(result.tripsPage.trips.map(trip => trip.id)).toEqual(['t1', 't2']);
        expect(result.tripsPage).toMatchObject({ hasMore: false, nextOffset: 2 });
        expect(result.tripsFailed).toBe(false);
        expect(reader.resolveHandle).toHaveBeenCalledWith('traveler');
        expect(reader.listPublicTrips).toHaveBeenCalledWith('user-1', 0, 9);
    });

    it('drops trips that are archived or hidden from the profile even if a row slips through', async () => {
        const reader = makeReader({ data: [resolverRow()], error: null }, {
            data: [tripRow('visible'), tripRow('archived', { status: 'archived' }), tripRow('hidden', { show_on_public_profile: false })],
            error: null,
        });
        const result = await loadPublicProfilePageData('traveler', reader);
        expect(result.status === 'found' && result.tripsPage.trips.map(trip => trip.id)).toEqual(['visible']);
    });

    it('reports more trips when the first page is full', async () => {
        const rows = Array.from({ length: 9 }, (_, index) => tripRow(`t${index}`));
        const result = await loadPublicProfilePageData('traveler', makeReader({ data: [resolverRow()], error: null }, { data: rows, error: null }));
        expect(result.status === 'found' && result.tripsPage).toMatchObject({ hasMore: true, nextOffset: 9 });
    });

    it('keeps the profile when its trips cannot load', async () => {
        const result = await loadPublicProfilePageData('traveler', makeReader({ data: [resolverRow()], error: null }, { data: null, error: { message: 'boom' } }));
        expect(result).toMatchObject({ status: 'found', tripsFailed: true, tripsPage: { trips: [], hasMore: false } });
    });

    it('masks a private profile to a first name, a last initial and the handle', async () => {
        const reader = makeReader({ data: [resolverRow({ status: 'private', public_profile_enabled: false })], error: null });
        const result = await loadPublicProfilePageData('traveler', reader);

        expect(result).toEqual({
            status: 'private',
            preview: { username: 'traveler', usernameDisplay: 'TrAveler', displayName: 'Traveler O.', firstName: 'Traveler', lastInitial: 'O' },
        });
        const serialized = JSON.stringify(result);
        for (const secret of ['user-1', 'Slow travel fan', 'Hamburg', 'One', 'traveler@example.com']) {
            expect(serialized).not.toContain(secret);
        }
        expect(reader.listPublicTrips).not.toHaveBeenCalled();
    });

    it('returns not found for an unknown handle, and never queries for an invalid one', async () => {
        const unknown = makeReader({ data: [{ status: 'not_found', id: null }], error: null });
        expect(await loadPublicProfilePageData('nobody', unknown)).toEqual({ status: 'not_found' });

        const invalid = makeReader({ data: [resolverRow()], error: null });
        expect(await loadPublicProfilePageData(normalizePublicProfileHandle('x'), invalid)).toEqual({ status: 'not_found' });
        expect(await loadPublicProfilePageData(normalizePublicProfileHandle('../admin'), invalid)).toEqual({ status: 'not_found' });
        expect(invalid.resolveHandle).not.toHaveBeenCalled();
    });

    it('returns not found when Supabase is not configured', async () => {
        expect(await loadPublicProfilePageData('traveler', null)).toEqual({ status: 'not_found' });
    });

    it('points an old handle at the canonical one', async () => {
        const reader = makeReader({ data: [resolverRow({ status: 'redirect', username: 'traveler-new', canonical_username: 'traveler-new' })], error: null });
        expect(await loadPublicProfilePageData('traveler-old', reader)).toEqual({ status: 'redirect', canonicalUsername: 'traveler-new' });
        expect(reader.listPublicTrips).not.toHaveBeenCalled();
    });

    it('marks a backend failure as unavailable instead of not found', async () => {
        expect(await loadPublicProfilePageData('traveler', makeReader({ data: null, error: { message: 'timeout' } }))).toEqual({ status: 'unavailable' });
        const throwing: PublicProfileReader = { resolveHandle: () => Promise.reject(new Error('network')), listPublicTrips: vi.fn() };
        expect(await loadPublicProfilePageData('traveler', throwing)).toEqual({ status: 'unavailable' });
    });
});

describe('public profile handle validation', () => {
    it.each([
        ['traveler', 'traveler'],
        ['  TrAvEler ', 'traveler'],
        ['@traveler_1', 'traveler_1'],
        ['ab', null],
        ['a'.repeat(41), null],
        ['bad handle', null],
        ['../etc', null],
        ['x'.repeat(300), null],
        [42, null],
        [undefined, null],
    ])('normalizes %j to %j', (input, expected) => {
        expect(normalizePublicProfileHandle(input)).toBe(expected);
    });
});
