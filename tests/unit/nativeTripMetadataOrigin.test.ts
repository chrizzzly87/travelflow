import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resolve: vi.fn(async (_request: Request) => ({ pageTitle: 'Shared trip' })) }));
vi.mock('@tanstack/react-start', () => ({
    createServerFn: () => ({ validator: (validate: (value: unknown) => string) => ({
        handler: (handle: (input: { data: string }) => unknown) => ({ data }: { data: unknown }) => handle({ data: validate(data) }),
    }) }),
}));
vi.mock('@tanstack/react-start/server', () => ({ getRequestUrl: () => new URL('https://feature.example.com/_server/metadata') }));
vi.mock('../../netlify/edge-functions/trip-og-meta', () => ({ resolveTripDocumentMetadata: mocks.resolve }));
import { getTripDocumentMetadata } from '../../src/server/tripMetadata';

afterEach(() => mocks.resolve.mockClear());

it('resolves public sharing media against the native request origin, including previews', async () => {
    expect(await getTripDocumentMetadata({ data: '/s/share-token?v=version-1' })).toEqual({ pageTitle: 'Shared trip' });
    const request = mocks.resolve.mock.calls[0]![0];
    expect(request.url).toBe('https://feature.example.com/s/share-token?v=version-1');
    expect(request.headers.has('authorization')).toBe(false);
    expect(request.headers.has('cookie')).toBe(false);
});

it.each(['https://other.example/trip/id', '//other.example/trip/id', '/admin/users'])('rejects a non-trip metadata target %s', async path => {
    expect(() => getTripDocumentMetadata({ data: path })).toThrow('Invalid trip metadata path');
    expect(mocks.resolve).not.toHaveBeenCalled();
});
