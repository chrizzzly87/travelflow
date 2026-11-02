import { redirect } from '@tanstack/react-router';
import type { UserAccessContext } from '../../types';
import { buildLoginPathWithNext } from '../../services/authNavigationService';

export const getRouteAccessDecision = (access: UserAccessContext | null, requireAdmin = false): 'allow' | 'login' | 'denied' => {
    if (!access?.userId || access.isAnonymous || access.accountStatus !== 'active') return 'login';
    return requireAdmin && access.role !== 'admin' ? 'denied' : 'allow';
};
const DEV_ADMIN_BYPASS_DISABLED_STORAGE_KEY = 'tf_dev_admin_bypass_disabled';

/**
 * The local dev admin bypass (`VITE_DEV_ADMIN_BYPASS=true`, dev builds only),
 * mirrored from AuthContext so the `/_admin` guard lets the dev-admin session
 * through instead of redirecting it to login before the context can supply it.
 * Never applies to a production build.
 */
export const resolveDevAdminBypassAccess = (
    pathname: string,
    env: { isDev: boolean; flag: string | undefined; disabled: boolean },
): UserAccessContext | null => {
    if (!env.isDev || env.flag !== 'true' || env.disabled) return null;
    if (!/^\/admin(\/|$)/.test(pathname)) return null;
    return {
        userId: 'dev-admin-id',
        role: 'admin',
        accountStatus: 'active',
        isAnonymous: false,
        tierKey: 'tier_free',
        entitlements: {},
    } as unknown as UserAccessContext;
};

const readDevAdminBypassDisabled = (): boolean => {
    try {
        return typeof window !== 'undefined' && window.sessionStorage.getItem(DEV_ADMIN_BYPASS_DISABLED_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

/** Client route protection supplements independently authorized backend endpoints. */
export const requireRouteAccess = async (href: string, requireAdmin = false) => {
    const devBypassAccess = resolveDevAdminBypassAccess(new URL(href, 'https://travelflow.invalid').pathname, {
        isDev: import.meta.env.DEV,
        flag: import.meta.env.VITE_DEV_ADMIN_BYPASS,
        disabled: readDevAdminBypassDisabled(),
    });
    if (devBypassAccess) return { access: devBypassAccess };

    const { shouldEnableE2EAuthSandbox, getE2EAuthSandboxSnapshot } = await import('../../services/e2eAuthSandboxService');
    const access = shouldEnableE2EAuthSandbox()
        ? getE2EAuthSandboxSnapshot().access
        : await (await import('../../services/authService')).getCurrentAccessContext();
    const decision = getRouteAccessDecision(access, requireAdmin);
    if (decision === 'login') {
        const target = new URL(href, 'https://travelflow.invalid');
        const { loginTarget } = buildLoginPathWithNext({ pathname: target.pathname, search: target.search, hash: target.hash });
        throw redirect({ href: loginTarget, replace: true });
    }
    if (decision === 'denied') throw redirect({ href: '/admin/access-denied', replace: true });
    return { access };
};
