import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getFreePlanEntitlements } from '../config/planCatalog';
import type { PlanTierKey, SystemRole, UserAccessContext } from '../types';
import { trackEvent } from './analyticsService';
import { appendAuthTraceEntry } from './authTraceService';
import { supabase } from './supabaseClient';

export type OAuthProviderId = 'google' | 'apple' | 'facebook' | 'kakao';

export interface AuthFlowContext {
    flowId: string;
    attemptId: string;
}

interface LogAuthFlowOptions extends AuthFlowContext {
    step: string;
    result: 'start' | 'success' | 'error';
    provider?: string | null;
    errorCode?: string | null;
    metadata?: Record<string, unknown>;
    email?: string | null;
}

const FREE_ENTITLEMENTS = getFreePlanEntitlements();

const buildFlowId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `flow_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeErrorCode = (error: unknown): string => {
    if (!error || typeof error !== 'object') return 'unknown_error';
    const typed = error as { code?: unknown; status?: unknown; message?: unknown };
    if (typeof typed.code === 'string' && typed.code.trim()) return typed.code.trim();
    if (typeof typed.status === 'number') return `status_${typed.status}`;
    if (typeof typed.message === 'string' && typed.message.trim()) {
        return typed.message.trim().slice(0, 120);
    }
    return 'unknown_error';
};

const simpleHash = (value: string): string => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `h${(hash >>> 0).toString(16)}`;
};

const hashEmail = (email?: string | null): string | null => {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    return simpleHash(normalized);
};

const clearSupabaseAuthStorage = (): void => {
    if (typeof window === 'undefined') return;
    const shouldClear = (key: string): boolean => (
        key.startsWith('sb-') &&
        (
            key.includes('auth-token') ||
            key.includes('refresh-token') ||
            key.includes('code-verifier')
        )
    );
    try {
        const localKeys = Object.keys(window.localStorage);
        for (const key of localKeys) {
            if (shouldClear(key)) {
                window.localStorage.removeItem(key);
            }
        }
    } catch {
        // best effort
    }
    try {
        const sessionKeys = Object.keys(window.sessionStorage);
        for (const key of sessionKeys) {
            if (shouldClear(key)) {
                window.sessionStorage.removeItem(key);
            }
        }
    } catch {
        // best effort
    }
};

const isSessionNotFoundError = (error: { status?: number; code?: string; message?: string } | null | undefined): boolean => {
    if (!error) return false;
    const normalizedErrorCode = normalizeErrorCode(error).toLowerCase();
    const normalizedMessage = typeof error.message === 'string'
        ? error.message.toLowerCase()
        : '';
    return Boolean(
        error.status === 403
        || normalizedErrorCode.includes('session_not_found')
        || normalizedMessage.includes('session from session_id claim in jwt does not exist')
    );
};

const isLikelyStaleSessionError = (
    error: { status?: number; code?: string; message?: string; details?: string | null } | null | undefined
): boolean => {
    if (!error) return false;
    if (isSessionNotFoundError(error)) return true;
    const normalizedCode = typeof error.code === 'string' ? error.code.trim().toLowerCase() : '';
    const normalizedMessage = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    const normalizedDetails = typeof error.details === 'string' ? error.details.toLowerCase() : '';
    const combined = `${normalizedMessage} ${normalizedDetails}`;
    if (normalizedCode === 'pgrst301') return true;
    return (
        combined.includes('not authenticated')
        || combined.includes('invalid jwt')
        || combined.includes('jwt expired')
        || combined.includes('user from sub claim in jwt does not exist')
        || combined.includes('session from session_id claim in jwt does not exist')
    );
};

const isProfileQueryUnavailableError = (
    error: { code?: string; message?: string } | null | undefined
): boolean => {
    if (!error) return false;
    const normalizedCode = typeof error.code === 'string' ? error.code.trim().toLowerCase() : '';
    const normalizedMessage = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    return normalizedCode === '42p01'
        || normalizedCode === '42703'
        || normalizedCode === '42501'
        || normalizedMessage.includes('relation "profiles" does not exist')
        || normalizedMessage.includes('permission denied for table profiles');
};

type ProfileBindingState = 'present' | 'missing' | 'unknown';
const PROFILE_BINDING_RECHECK_DELAY_MS = 250;

const readProfileBindingState = async (userId: string): Promise<ProfileBindingState> => {
    if (!supabase) return 'unknown';
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        if (isProfileQueryUnavailableError(error)) return 'unknown';
        return 'unknown';
    }
    return data?.id ? 'present' : 'missing';
};

const resolveProfileBindingState = async (userId: string): Promise<ProfileBindingState> => {
    const firstCheck = await readProfileBindingState(userId);
    if (firstCheck !== 'missing') return firstCheck;
    await new Promise((resolve) => setTimeout(resolve, PROFILE_BINDING_RECHECK_DELAY_MS));
    return readProfileBindingState(userId);
};

const recoverLocalAuthState = async (): Promise<void> => {
    if (!supabase) return;
    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch {
        // best effort recovery
    }
    clearSupabaseAuthStorage();
};

const buildAuthFlow = (): AuthFlowContext => ({
    flowId: buildFlowId(),
    attemptId: buildFlowId(),
});

const getMetadataProviders = (session: Session | null): string[] => {
    const metadata = session?.user?.app_metadata as Record<string, unknown> | undefined;
    const provider = typeof metadata?.provider === 'string' ? metadata.provider.trim().toLowerCase() : '';
    const providers = Array.isArray(metadata?.providers)
        ? metadata.providers
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase())
        : [];
    return [provider, ...providers].filter(Boolean);
};

const hasNonAnonymousIdentity = (session: Session | null): boolean => {
    const metadataProviders = getMetadataProviders(session);
    if (metadataProviders.some((provider) => provider !== 'anonymous')) {
        return true;
    }

    const identities = (session?.user as { identities?: Array<{ provider?: string | null }> } | undefined)?.identities;
    if (!Array.isArray(identities)) return false;
    return identities.some((identity) => {
        const provider = typeof identity?.provider === 'string' ? identity.provider.trim().toLowerCase() : '';
        return Boolean(provider && provider !== 'anonymous');
    });
};

const getAnonymousFlag = (session: Session | null): boolean => {
    if (session?.user?.email || session?.user?.phone) return false;
    const metadata = session?.user?.app_metadata as Record<string, unknown> | undefined;
    if (hasNonAnonymousIdentity(session)) return false;
    return Boolean(metadata?.is_anonymous === true || getMetadataProviders(session).includes('anonymous'));
};

const defaultAccessContext = (session: Session | null): UserAccessContext => ({
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    isAnonymous: getAnonymousFlag(session),
    role: 'user',
    tierKey: 'tier_free',
    entitlements: FREE_ENTITLEMENTS,
    onboardingCompleted: true,
    accountStatus: 'active',
});

const logAuthFlow = async (options: LogAuthFlowOptions): Promise<void> => {
    const {
        flowId,
        attemptId,
        step,
        result,
        provider = null,
        errorCode = null,
        metadata,
        email,
    } = options;

    const eventName = `auth__${step}--${result}` as const;
    trackEvent(eventName, {
        flow_id: flowId,
        attempt_id: attemptId,
        provider: provider || null,
        error_code: errorCode || null,
    });

    appendAuthTraceEntry({
        ts: new Date().toISOString(),
        flowId,
        attemptId,
        step,
        result,
        provider,
        errorCode,
        metadata,
    });

    if (!supabase) return;
    try {
        await supabase.rpc('log_auth_flow', {
            p_flow_id: flowId,
            p_attempt_id: attemptId,
            p_step: step,
            p_result: result,
            p_provider: provider,
            p_error_code: errorCode,
            p_email_hash: hashEmail(email),
            p_ip_hash: null,
            p_ua_hash: typeof navigator !== 'undefined' ? simpleHash(navigator.userAgent || '') : null,
            p_metadata: metadata || {},
        });
    } catch {
        // best effort only
    }
};

export const getCurrentAccessContext = async (): Promise<UserAccessContext> => {
    if (!supabase) return defaultAccessContext(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    if (!session) return defaultAccessContext(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
        if (isLikelyStaleSessionError(authError)) {
            await recoverLocalAuthState();
            return defaultAccessContext(null);
        }
        return defaultAccessContext(session);
    }
    const authUser = authData?.user;
    if (!authUser) {
        await recoverLocalAuthState();
        return defaultAccessContext(null);
    }
    if (!getAnonymousFlag(session)) {
        const profileBindingState = await resolveProfileBindingState(authUser.id);
        if (profileBindingState === 'missing') {
            await recoverLocalAuthState();
            return defaultAccessContext(null);
        }
    }

    try {
        const { data, error } = await supabase.rpc('get_current_user_access');
        if (error) {
            if (isLikelyStaleSessionError(error)) {
                await recoverLocalAuthState();
                return defaultAccessContext(null);
            }
            return defaultAccessContext(session);
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return defaultAccessContext(session);

        const resolvedUserId = row.user_id || session.user.id || authUser.id || null;
        if (!resolvedUserId || resolvedUserId !== authUser.id) {
            await recoverLocalAuthState();
            return defaultAccessContext(null);
        }
        const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
        const metadataEmail = typeof metadata?.email === 'string' ? metadata.email : null;

        const role: SystemRole = row.system_role === 'admin' ? 'admin' : 'user';
        const tierKey: PlanTierKey = row.tier_key === 'tier_mid'
            ? 'tier_mid'
            : row.tier_key === 'tier_premium'
                ? 'tier_premium'
                : 'tier_free';

        return {
            userId: resolvedUserId,
            email: row.email || authUser.email || session.user.email || metadataEmail || null,
            isAnonymous: getAnonymousFlag(session),
            role,
            tierKey,
            entitlements: (row.entitlements || FREE_ENTITLEMENTS) as UserAccessContext['entitlements'],
            onboardingCompleted: Object.prototype.hasOwnProperty.call(row, 'onboarding_completed')
                ? Boolean(row.onboarding_completed)
                : true,
            accountStatus: row.account_status === 'disabled'
                ? 'disabled'
                : row.account_status === 'deleted'
                    ? 'deleted'
                    : 'active',
        };
    } catch {
        return defaultAccessContext(session);
    }
};

export const subscribeToAuthState = (
    callback: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) => {
    if (!supabase) return () => {};
    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
};

export const signInWithEmailPassword = async (
    email: string,
    password: string
) => {
    if (!supabase) {
        throw new Error('Supabase auth is not configured.');
    }
    const flow = buildAuthFlow();
    await logAuthFlow({ ...flow, step: 'login_password', result: 'start', provider: 'password', email });
    const attemptSignIn = async () => supabase.auth.signInWithPassword({ email, password });
    let { data, error } = await attemptSignIn();
    let recoveredFromSessionNotFound = false;
    if (error && isSessionNotFoundError(error)) {
        clearSupabaseAuthStorage();
        try {
            await supabase.auth.signOut({ scope: 'local' });
        } catch {
            // best effort before retry
        }
        const retry = await attemptSignIn();
        data = retry.data;
        error = retry.error;
        recoveredFromSessionNotFound = !retry.error;
    }
    if (error) {
        await logAuthFlow({
            ...flow,
            step: 'login_password',
            result: 'error',
            provider: 'password',
            errorCode: normalizeErrorCode(error),
            email,
        });
        return { data, error, ...flow };
    }
    await logAuthFlow({
        ...flow,
        step: 'login_password',
        result: 'success',
        provider: 'password',
        email,
        metadata: recoveredFromSessionNotFound ? { recoveredFromSessionNotFound: true } : undefined,
    });
    return { data, error: null, ...flow };
};

export const upgradeAnonymousUserWithEmailPassword = async (
    email: string,
    password: string
) => {
    if (!supabase) {
        throw new Error('Supabase auth is not configured.');
    }
    const flow = buildAuthFlow();
    await logAuthFlow({ ...flow, step: 'anonymous_upgrade_password', result: 'start', provider: 'password', email });
    const { data, error } = await supabase.auth.updateUser({
        email,
        password,
    });
    if (error) {
        await logAuthFlow({
            ...flow,
            step: 'anonymous_upgrade_password',
            result: 'error',
            provider: 'password',
            errorCode: normalizeErrorCode(error),
            email,
        });
        return { data, error, ...flow };
    }
    await logAuthFlow({
        ...flow,
        step: 'anonymous_upgrade_password',
        result: 'success',
        provider: 'password',
        email,
    });
    return { data, error: null, ...flow };
};

export const signUpWithEmailPassword = async (
    email: string,
    password: string,
    options?: { emailRedirectTo?: string }
) => {
    if (!supabase) {
        throw new Error('Supabase auth is not configured.');
    }
    const flow = buildAuthFlow();
    await logAuthFlow({ ...flow, step: 'signup_password', result: 'start', provider: 'password', email });

    const { data: sessionData } = await supabase.auth.getSession();
    const isAnonymousSession = getAnonymousFlag(sessionData?.session ?? null);

    if (isAnonymousSession) {
        const upgraded = await upgradeAnonymousUserWithEmailPassword(email, password);
        return upgraded;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: options?.emailRedirectTo,
        },
    });

    if (error) {
        await logAuthFlow({
            ...flow,
            step: 'signup_password',
            result: 'error',
            provider: 'password',
            errorCode: normalizeErrorCode(error),
            email,
        });
        return { data, error, ...flow };
    }

    await logAuthFlow({ ...flow, step: 'signup_password', result: 'success', provider: 'password', email });
    return { data, error: null, ...flow };
};

export const signInWithOAuth = async (
    provider: OAuthProviderId,
    options?: { redirectTo?: string }
) => {
    if (!supabase) {
        throw new Error('Supabase auth is not configured.');
    }

    const flow = buildAuthFlow();
    await logAuthFlow({ ...flow, step: 'oauth_start', result: 'start', provider });

    const startStandardOAuth = () => supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: options?.redirectTo },
    });

    // NOTE: OAuth identity-linking from anonymous sessions has produced
    // stale-session edge cases in this app (session_not_found after
    // logout -> immediate re-login). Prefer a clean OAuth sign-in flow
    // for reliability; queued work is resumed via request-claim flow.
    const response = await startStandardOAuth();

    if (response.error) {
        await logAuthFlow({
            ...flow,
            step: 'oauth_start',
            result: 'error',
            provider,
            errorCode: normalizeErrorCode(response.error),
        });
    }

    return { ...response, ...flow };
};

export const signOut = async () => {
    if (!supabase) return { error: null };
    const flow = buildAuthFlow();
    await logAuthFlow({ ...flow, step: 'logout', result: 'start', provider: 'supabase' });
    const response = await supabase.auth.signOut({ scope: 'local' });

    const isSessionNotFound = isSessionNotFoundError(response.error || null);

    // Supabase can return 403 session_not_found when local client state still
    // has a stale session id. Clear local auth storage so the app can continue
    // with a clean state instead of staying stuck until hard refresh.
    if (isSessionNotFound) {
        clearSupabaseAuthStorage();
        await logAuthFlow({
            ...flow,
            step: 'logout',
            result: 'success',
            provider: 'supabase',
            metadata: { recoveredFromSessionNotFound: true },
        });
        return { error: null };
    }

    if (response.error) {
        await logAuthFlow({
            ...flow,
            step: 'logout',
            result: 'error',
            provider: 'supabase',
            errorCode: normalizeErrorCode(response.error),
        });
        return response;
    }

    clearSupabaseAuthStorage();
    await logAuthFlow({ ...flow, step: 'logout', result: 'success', provider: 'supabase' });
    return response;
};

export const requestPasswordResetEmail = async (
    email: string,
    options?: { redirectTo?: string; intent?: 'forgot_password' | 'set_password' }
) => {
    if (!supabase) {
        throw new Error('Supabase auth is not configured.');
    }
    const flow = buildAuthFlow();
    const intent = options?.intent || 'forgot_password';
    await logAuthFlow({
        ...flow,
        step: 'password_reset_request',
        result: 'start',
        provider: 'password',
        email,
        metadata: { intent },
    });

    const response = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: options?.redirectTo,
    });

    if (response.error) {
        await logAuthFlow({
            ...flow,
            step: 'password_reset_request',
            result: 'error',
            provider: 'password',
            errorCode: normalizeErrorCode(response.error),
            email,
            metadata: { intent },
        });
        return { ...response, ...flow };
    }

    await logAuthFlow({
        ...flow,
        step: 'password_reset_request',
        result: 'success',
        provider: 'password',
        email,
        metadata: { intent },
    });
    return { ...response, ...flow };
};

export const updateCurrentUserPassword = async (
    password: string
) => {
    if (!supabase) {
        throw new Error('Supabase auth is not configured.');
    }
    const flow = buildAuthFlow();
    await logAuthFlow({
        ...flow,
        step: 'password_update',
        result: 'start',
        provider: 'password',
    });

    const response = await supabase.auth.updateUser({ password });

    if (response.error) {
        await logAuthFlow({
            ...flow,
            step: 'password_update',
            result: 'error',
            provider: 'password',
            errorCode: normalizeErrorCode(response.error),
        });
        return { ...response, ...flow };
    }

    await logAuthFlow({
        ...flow,
        step: 'password_update',
        result: 'success',
        provider: 'password',
    });
    return { ...response, ...flow };
};

export const getCurrentUser = async (): Promise<User | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
};
