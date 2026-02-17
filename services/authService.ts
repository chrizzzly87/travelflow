import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getFreePlanEntitlements } from '../config/planCatalog';
import type { PlanTierKey, SystemRole, UserAccessContext } from '../types';
import { trackEvent } from './analyticsService';
import { appendAuthTraceEntry } from './authTraceService';
import { supabase } from './supabaseClient';

export type OAuthProviderId = 'google' | 'apple' | 'facebook';

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

const buildAuthFlow = (): AuthFlowContext => ({
    flowId: buildFlowId(),
    attemptId: buildFlowId(),
});

const getAnonymousFlag = (session: Session | null): boolean => {
    const metadata = session?.user?.app_metadata as Record<string, unknown> | undefined;
    return Boolean(metadata?.is_anonymous === true);
};

const defaultAccessContext = (session: Session | null): UserAccessContext => ({
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    isAnonymous: getAnonymousFlag(session),
    role: 'user',
    tierKey: 'tier_free',
    entitlements: FREE_ENTITLEMENTS,
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

    try {
        const { data, error } = await supabase.rpc('get_current_user_access');
        if (error) return defaultAccessContext(session);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return defaultAccessContext(session);

        const role: SystemRole = row.system_role === 'admin' ? 'admin' : 'user';
        const tierKey: PlanTierKey = row.tier_key === 'tier_mid'
            ? 'tier_mid'
            : row.tier_key === 'tier_premium'
                ? 'tier_premium'
                : 'tier_free';

        return {
            userId: row.user_id || session.user.id,
            email: row.email || session.user.email || null,
            isAnonymous: Boolean(row.is_anonymous),
            role,
            tierKey,
            entitlements: (row.entitlements || FREE_ENTITLEMENTS) as UserAccessContext['entitlements'],
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
    await logAuthFlow({ ...flow, step: 'login_password', result: 'success', provider: 'password', email });
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

    const { data: sessionData } = await supabase.auth.getSession();
    const isAnonymousSession = getAnonymousFlag(sessionData?.session ?? null);
    const authAny = supabase.auth as unknown as {
        linkIdentity?: (params: { provider: OAuthProviderId; options?: { redirectTo?: string } }) => Promise<{
            data: unknown;
            error: { message?: string; code?: string; status?: number } | null;
        }>;
    };

    const response = isAnonymousSession && authAny.linkIdentity
        ? await authAny.linkIdentity({
            provider,
            options: { redirectTo: options?.redirectTo },
        })
        : await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: options?.redirectTo },
        });

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
    const response = await supabase.auth.signOut();
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
