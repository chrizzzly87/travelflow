import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { trackEvent } from '../services/analyticsService';
import { appendAuthTraceEntry } from '../services/authTraceService';
import type { UserAccessContext } from '../types';
import { stripLocalePrefix } from '../config/routes';

type AuthServiceModule = typeof import('../services/authService');
type OAuthProviderId = 'google' | 'apple' | 'facebook' | 'kakao';

let authServicePromise: Promise<AuthServiceModule> | null = null;

const loadAuthService = async (): Promise<AuthServiceModule> => {
    if (!authServicePromise) {
        authServicePromise = import('../services/authService');
    }
    return authServicePromise;
};

const loadSupabaseClient = async () => {
    const { supabase } = await import('../services/supabaseClient');
    return supabase;
};

const isAuthBootstrapCriticalPath = (pathname: string): boolean => {
    const normalizedPath = stripLocalePrefix(pathname || '/');
    if (normalizedPath === '/login') return true;
    if (normalizedPath.startsWith('/auth/')) return true;
    if (normalizedPath.startsWith('/profile')) return true;
    if (normalizedPath.startsWith('/admin')) return true;
    if (normalizedPath.startsWith('/trip')) return true;
    if (normalizedPath.startsWith('/create-trip')) return true;
    return false;
};

const hasAuthCallbackPayload = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        window.location.hash.includes('access_token=') ||
        window.location.search.includes('code=')
    );
};

interface AuthContextValue {
    session: Session | null;
    access: UserAccessContext | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAnonymous: boolean;
    isAdmin: boolean;
    refreshAccess: () => Promise<void>;
    loginWithPassword: (email: string, password: string) => Promise<Awaited<ReturnType<AuthServiceModule['signInWithEmailPassword']>>>;
    registerWithPassword: (
        email: string,
        password: string,
        options?: { emailRedirectTo?: string }
    ) => Promise<Awaited<ReturnType<AuthServiceModule['signUpWithEmailPassword']>>>;
    loginWithOAuth: (provider: OAuthProviderId, redirectTo?: string) => Promise<Awaited<ReturnType<AuthServiceModule['signInWithOAuth']>>>;
    sendPasswordResetEmail: (
        email: string,
        options?: { redirectTo?: string; intent?: 'forgot_password' | 'set_password' }
    ) => Promise<Awaited<ReturnType<AuthServiceModule['requestPasswordResetEmail']>>>;
    updatePassword: (password: string) => Promise<Awaited<ReturnType<AuthServiceModule['updateCurrentUserPassword']>>>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [access, setAccess] = useState<UserAccessContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const hasBootstrappedRef = useRef(false);
    const isBootstrappingRef = useRef(false);

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
        const authService = await loadAuthService();
        const nextAccess = await authService.getCurrentAccessContext();
        setAccess(nextAccess);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) = () => {};

        const isAnonymousSession = (value: Session | null): boolean => {
            const metadata = value?.user?.app_metadata as Record<string, unknown> | undefined;
            return Boolean(metadata?.is_anonymous === true);
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

        const clearDeferredBootstrapTriggers = (): void => {
            if (typeof window === 'undefined') return;
            window.removeEventListener('pointerdown', triggerBootstrap, true);
            window.removeEventListener('keydown', triggerBootstrap, true);
            window.removeEventListener('touchstart', triggerBootstrap, true);
        };

        const bootstrap = async () => {
            try {
                const [authService, supabase] = await Promise.all([
                    loadAuthService(),
                    loadSupabaseClient(),
                ]);
                if (cancelled) return;

                if (!supabase) {
                    if (!cancelled) {
                        setSession(null);
                        setAccess(null);
                        setIsLoading(false);
                    }
                    hasBootstrappedRef.current = true;
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
                if (cancelled) return;

                unsubscribe = authService.subscribeToAuthState((_event, nextSession) => {
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

                hasBootstrappedRef.current = true;
            } catch (error) {
                if (!cancelled) {
                    setIsLoading(false);
                }
                authDebug('bootstrap:error', error);
            } finally {
                isBootstrappingRef.current = false;
            }
        };

        const triggerBootstrap = (): void => {
            if (cancelled) return;
            if (hasBootstrappedRef.current || isBootstrappingRef.current) return;
            isBootstrappingRef.current = true;
            clearDeferredBootstrapTriggers();
            setIsLoading(true);
            void bootstrap();
        };

        if (typeof window === 'undefined') {
            triggerBootstrap();
            return () => {
                cancelled = true;
                unsubscribe();
            };
        }

        const shouldBootstrapImmediately = hasAuthCallbackPayload() || isAuthBootstrapCriticalPath(window.location.pathname);
        if (shouldBootstrapImmediately) {
            triggerBootstrap();
        } else {
            setIsLoading(false);
            window.addEventListener('pointerdown', triggerBootstrap, true);
            window.addEventListener('keydown', triggerBootstrap, true);
            window.addEventListener('touchstart', triggerBootstrap, true);
        }

        return () => {
            cancelled = true;
            clearDeferredBootstrapTriggers();
            unsubscribe();
        };
    }, [logAuthStateEvent, refreshAccess]);

    const loginWithPassword = useCallback(async (email: string, password: string) => {
        const authService = await loadAuthService();
        const response = await authService.signInWithEmailPassword(email, password);
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
        const authService = await loadAuthService();
        const response = await authService.signUpWithEmailPassword(email, password, options);
        if (!response.error) {
            await refreshAccess();
        }
        return response;
    }, [refreshAccess]);

    const loginWithOAuth = useCallback(async (provider: OAuthProviderId, redirectTo?: string) => {
        const authService = await loadAuthService();
        return authService.signInWithOAuth(provider, { redirectTo });
    }, []);

    const sendPasswordResetEmail = useCallback(async (
        email: string,
        options?: { redirectTo?: string; intent?: 'forgot_password' | 'set_password' }
    ) => {
        const authService = await loadAuthService();
        return authService.requestPasswordResetEmail(email, options);
    }, []);

    const updatePassword = useCallback(async (password: string) => {
        const authService = await loadAuthService();
        return authService.updateCurrentUserPassword(password);
    }, []);

    const logout = useCallback(async () => {
        const authService = await loadAuthService();
        await authService.signOut();
        setAccess(null);
        setSession(null);
    }, []);

    const value = useMemo<AuthContextValue>(() => {
        const isAuthenticated = Boolean(session?.user && access && !access.isAnonymous);
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
