import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('../../services/e2eAuthSandboxService', () => ({ shouldEnableE2EAuthSandbox: () => false, getE2EAuthSandboxSnapshot: vi.fn() }));
vi.mock('../../services/authService', () => ({ getCurrentAccessContext: mocks.access }));
import { requireRouteAccess } from '../../features/auth/routeAccess';

describe('native account route guards', () => {
    beforeEach(() => mocks.access.mockReset());
    it('redirects signed-out visitors with a URL preserving the locale, repeated search and anchor', async () => {
        mocks.access.mockResolvedValue(null);
        const result = await requireRouteAccess('/de/profile?tag=one&tag=two#settings').catch(error => error);
        expect(result.options.href).toBe('/de/login?next=%2Fde%2Fprofile%3Ftag%3Done%26tag%3Dtwo%23settings');
        expect(result.options.replace).toBe(true);
    });
    it('redirects members from admin separately from expired or disabled accounts', async () => {
        mocks.access.mockResolvedValue({ userId: 'member', isAnonymous: false, role: 'user', accountStatus: 'active' });
        expect((await requireRouteAccess('/admin/users', true).catch(error => error)).options.href).toBe('/admin/access-denied');
        mocks.access.mockResolvedValue({ userId: 'member', isAnonymous: false, role: 'admin', accountStatus: 'disabled' });
        expect((await requireRouteAccess('/admin/users', true).catch(error => error)).options.href).toBe('/login?next=%2Fadmin%2Fusers');
    });
    it('returns verified access for the native route context', async () => {
        const access = { userId: 'admin', isAnonymous: false, role: 'admin', accountStatus: 'active' };
        mocks.access.mockResolvedValue(access);
        expect(await requireRouteAccess('/admin/users', true)).toEqual({ access });
    });
});
