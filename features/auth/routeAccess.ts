import { redirect } from '@tanstack/react-router';
import type { UserAccessContext } from '../../types';
import { buildLoginPathWithNext } from '../../services/authNavigationService';

export const getRouteAccessDecision = (access: UserAccessContext | null, requireAdmin = false): 'allow' | 'login' | 'denied' => {
    if (!access?.userId || access.isAnonymous || access.accountStatus !== 'active') return 'login';
    return requireAdmin && access.role !== 'admin' ? 'denied' : 'allow';
};
/** Client route protection supplements independently authorized backend endpoints. */
export const requireRouteAccess = async (href: string, requireAdmin = false) => {
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
