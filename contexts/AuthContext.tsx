import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { OAuthProviderId } from '../services/authService';
import {
    getCurrentAccessContext,
    requestPasswordResetEmail,
    signInWithEmailPassword,
    signInWithOAuth,
    signOut,
    signUpWithEmailPassword,
    subscribeToAuthState,
    updateCurrentUserPassword,
} from '../services/authService';
import { trackEvent } from '../services/analyticsService';
import { appendAuthTraceEntry } from '../services/authTraceService';
import { supabase } from '../services/supabaseClient';
import type { UserAccessContext } from '../types';

interface AuthContextValue {
    session: Session | null;
    access: UserAccessContext | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAnonymous: boolean;
    isAdmin: boolean;
    refreshAccess: () => Promise<void>;
    loginWithPassword: (email: string, password: string) => Promise<Awaited<ReturnType<typeof signInWithEmailPassword>>>;
    registerWithPassword: (
        email: string,
        password: string,
        options?: { emailRedirectTo?: string }
    ) => Promise<Awaited<ReturnType<typeof signUpWithEmailPassword>>>;
    loginWithOAuth: (provider: OAuthProviderId, redirectTo?: string) => Promise<Awaited<ReturnType<typeof signInWithOAuth>>>;
    sendPasswordResetEmail: (
        email: string,
        options?: { redirectTo?: string; intent?: 'forgot_password' | 'set_password' }
    ) => Promise<Awaited<ReturnType<typeof requestPasswordResetEmail>>>;
    updatePassword: (password: string) => Promise<Awaited<ReturnType<typeof updateCurrentUserPassword>>>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [access, setAccess] = useState<UserAccessContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const logAuthStateEvent = useCallback((event: string, hasSession: boolean) => {
        const flowId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `auth-${Date.now()}`;
        const attemptId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `attempt-${Date.now()}`;
        trackEvent('auth__state--change', {
            flow_id: flowId,
            attempt_id: attemptId,
            auth_event: event,
            has_session: hasSession,
        });
        appendAuthTraceEntry({
            ts: new Date().toISOString(),
            flowId,
            attemptId,
            step: `state_${event.toLowerCase()}`,
            result: hasSession ? 'success' : 'start',
            provider: 'supabase',
            metadata: { hasSession },
        });
    }, []);

    const refreshAccess = useCallback(async () => {
        const nextAccess = await getCurrentAccessContext();
        setAccess(nextAccess);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const isAnonymousSession = (value: Session | null): boolean => {
            const user = value?.user as (Session['user'] & { is_anonymous?: boolean }) | undefined;
            if (!user) return false;
            if (user.is_anonymous === true) return true;
            const metadata = user.app_metadata as Record<string, unknown> | undefined;
            const provider = typeof metadata?.provider === 'string' ? metadata.provider.trim().toLowerCase() : '';
            const providersFromMetadata = Array.isArray(metadata?.providers)
                ? metadata.providers
                    .filter((entry): entry is string => typeof entry === 'string')
                    .map((entry) => entry.trim().toLowerCase())
                : [];
            const providersFromIdentities = Array.isArray((user as { identities?: Array<{ provider?: string | null }> }).identities)
                ? ((user as { identities?: Array<{ provider?: string | null }> }).identities || [])
                    .map((identity) => (typeof identity?.provider === 'string' ? identity.provider.trim().toLowerCase() : ''))
                    .filter(Boolean)
                : [];
            const providers = [provider, ...providersFromMetadata, ...providersFromIdentities].filter(Boolean);
            if (metadata?.is_anonymous === true) return true;
            return providers.includes('anonymous');
        };

        const isAuthDebugEnabled = (): boolean => {
            if (typeof window === 'undefined') return false;
            try {
                return window.localStorage.getItem('tf_debug_auth') === '1';
            } catch {
                return false;
            }
        };

        const authDebug = (...args: unknown[]): void => {
            if (!isAuthDebugEnabled()) return;
            console.log('[auth]', ...args);
        };

        const stripAuthHash = (): void => {
            if (typeof window === 'undefined') return;
            if (!window.location.hash.includes('access_token=')) return;
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        };

        const captureHashTokens = (): { accessToken: string; refreshToken: string } | null => {
            if (typeof window === 'undefined') return null;
            const hash = window.location.hash.substring(1);
            if (!hash) return null;
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (!accessToken || !refreshToken) return null;
            return { accessToken, refreshToken };
        };

        const bootstrap = async () => {
            if (!supabase) {
                if (!cancelled) {
                    setSession(null);
                    setAccess(null);
                    setIsLoading(false);
                }
                return;
            }

            authDebug('bootstrap:start', {
                pathname: typeof window !== 'undefined' ? window.location.pathname : null,
                search: typeof window !== 'undefined' ? window.location.search : null,
                hasHash: typeof window !== 'undefined' ? window.location.hash.length > 0 : false,
            });

            // Capture hash tokens BEFORE getSession()/onAuthStateChange can
            // strip or consume them, so we have a reliable fallback.
            const savedHashTokens = captureHashTokens();

            const { data: sessionData } = await supabase.auth.getSession();
            if (cancelled) return;
            let activeSession = sessionData?.session ?? null;
            authDebug('bootstrap:getSession', {
                hasSession: Boolean(activeSession),
                userId: activeSession?.user?.id ?? null,
                isAnonymous: isAnonymousSession(activeSession),
                hasSavedHashTokens: Boolean(savedHashTokens),
            });

            // If callback hash tokens exist, prefer them over an anonymous
            // session. Otherwise OAuth callback can be lost while the app
            // remains on the pre-existing anonymous session.
            const shouldApplyHashSession = Boolean(
                savedHashTokens && (!activeSession || isAnonymousSession(activeSession))
            );

            if (shouldApplyHashSession && savedHashTokens) {
                const { data, error } = await supabase.auth.setSession({
                    access_token: savedHashTokens.accessToken,
                    refresh_token: savedHashTokens.refreshToken,
                });
                if (!error && data?.session) {
                    activeSession = data.session;
                }
                authDebug('bootstrap:setSessionFromHash', {
                    success: !error && Boolean(data?.session),
                    error: error?.message ?? null,
                    userId: data?.session?.user?.id ?? null,
                });
                if (cancelled) return;
            }

            stripAuthHash();

            setSession(activeSession);
            logAuthStateEvent('INITIAL_SESSION', Boolean(activeSession));
            if (activeSession) {
                await refreshAccess();
            } else {
                setAccess(null);
            }
            if (!cancelled) setIsLoading(false);
        };

        void bootstrap();

        const unsubscribe = subscribeToAuthState((_event, nextSession) => {
            logAuthStateEvent(_event, Boolean(nextSession));
            authDebug('stateChange', {
                event: _event,
                hasSession: Boolean(nextSession),
                userId: nextSession?.user?.id ?? null,
                isAnonymous: isAnonymousSession(nextSession),
                hasHash: typeof window !== 'undefined' ? window.location.hash.includes('access_token=') : false,
            });
            setSession(nextSession);
            if (nextSession) {
                // Only strip auth hash once a real session exists, so the
                // bootstrap fallback can still read the tokens if needed.
                stripAuthHash();
                void refreshAccess();
                return;
            }
            setAccess(null);
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [logAuthStateEvent, refreshAccess]);

    const loginWithPassword = useCallback(async (email: string, password: string) => {
        const response = await signInWithEmailPassword(email, password);
        if (!response.error) {
            await refreshAccess();
        }
        return response;
    }, [refreshAccess]);

    const registerWithPassword = useCallback(async (
        email: string,
        password: string,
        options?: { emailRedirectTo?: string }
    ) => {
        const response = await signUpWithEmailPassword(email, password, options);
        if (!response.error) {
            await refreshAccess();
        }
        return response;
    }, [refreshAccess]);

    const loginWithOAuth = useCallback(async (provider: OAuthProviderId, redirectTo?: string) => {
        return signInWithOAuth(provider, { redirectTo });
    }, []);

    const sendPasswordResetEmail = useCallback(async (
        email: string,
        options?: { redirectTo?: string; intent?: 'forgot_password' | 'set_password' }
    ) => {
        return requestPasswordResetEmail(email, options);
    }, []);

    const updatePassword = useCallback(async (password: string) => {
        return updateCurrentUserPassword(password);
    }, []);

    const logout = useCallback(async () => {
        await signOut();
        setAccess(null);
        setSession(null);
    }, []);

    const value = useMemo<AuthContextValue>(() => {
        const hasValidBoundAccess = Boolean(
            session?.user
            && access
            && access.userId
            && access.userId === session.user.id
        );
        const isAuthenticated = Boolean(
            hasValidBoundAccess
            && !access?.isAnonymous
            && access?.accountStatus === 'active'
        );
        const isAnonymous = Boolean(session?.user && access?.isAnonymous);
        const isAdmin = access?.role === 'admin';
        return {
            session,
            access,
            isLoading,
            isAuthenticated,
            isAnonymous,
            isAdmin,
            refreshAccess,
            loginWithPassword,
            registerWithPassword,
            loginWithOAuth,
            sendPasswordResetEmail,
            updatePassword,
            logout,
        };
    }, [
        access,
        isLoading,
        loginWithOAuth,
        loginWithPassword,
        logout,
        refreshAccess,
        registerWithPassword,
        sendPasswordResetEmail,
        session,
        updatePassword,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within AuthProvider.');
    }
    return context;
};
