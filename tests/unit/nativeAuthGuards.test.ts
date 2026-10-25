import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('../../services/e2eAuthSandboxService', () => ({ shouldEnableE2EAuthSandbox: () => false, getE2EAuthSandboxSnapshot: vi.fn() }));
vi.mock('../../services/authService', () => ({ getCurrentAccessContext: mocks.access }));
import { requireRouteAccess, resolveDevAdminBypassAccess } from '../../features/auth/routeAccess';

describe('native account route guards', () => {
    // A local .env.local may turn the dev admin bypass on; these cases cover the real guard.
    beforeEach(() => { mocks.access.mockReset(); vi.stubEnv('VITE_DEV_ADMIN_BYPASS', 'false'); });
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
    it('lets the local dev admin bypass into admin routes only, and only in dev builds', () => {
        const on = { isDev: true, flag: 'true', disabled: false };
        expect(resolveDevAdminBypassAccess('/admin/users', on)).toMatchObject({ userId: 'dev-admin-id', role: 'admin', accountStatus: 'active' });
        expect(resolveDevAdminBypassAccess('/admin', on)).not.toBeNull();
        expect(resolveDevAdminBypassAccess('/profile', on)).toBeNull();
        expect(resolveDevAdminBypassAccess('/administrator', on)).toBeNull();
        expect(resolveDevAdminBypassAccess('/admin/users', { ...on, isDev: false })).toBeNull();
        expect(resolveDevAdminBypassAccess('/admin/users', { ...on, flag: undefined })).toBeNull();
        expect(resolveDevAdminBypassAccess('/admin/users', { ...on, disabled: true })).toBeNull();
    });
});
