import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../services/analyticsService';
import { appendAuthTraceEntry } from '../services/authTraceService';
import type { UserAccessContext } from '../types';
import { stripLocalePrefix } from '../config/routes';
import { isSimulatedLoggedIn, setSimulatedLoggedIn } from '../services/simulatedLoginService';
import type { UserProfileRecord } from '../services/profileService';

type AuthServiceModule = typeof import('../services/authService');
type ProfileServiceModule = typeof import('../services/profileService');
type OAuthProviderId = 'google' | 'apple' | 'facebook' | 'kakao';

let authServicePromise: Promise<AuthServiceModule> | null = null;
let profileServicePromise: Promise<ProfileServiceModule> | null = null;

const loadAuthService = async (): Promise<AuthServiceModule> => {
    if (!authServicePromise) {
        authServicePromise = import('../services/authService');
    }
    return authServicePromise;
};

const loadProfileService = async (): Promise<ProfileServiceModule> => {
    if (!profileServicePromise) {
        profileServicePromise = import('../services/profileService');
    }
    return profileServicePromise;
};

const loadSupabaseClient = async () => {
    const { supabase } = await import('../services/supabaseClient');
    return supabase;
};

export const isAuthBootstrapCriticalPath = (pathname: string): boolean => {
    const normalizedPath = stripLocalePrefix(pathname || '/');
    if (normalizedPath === '/login') return true;
    if (normalizedPath.startsWith('/auth/')) return true;
    if (normalizedPath.startsWith('/profile')) return true;
    if (normalizedPath.startsWith('/u/')) return true;
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

const DEV_ADMIN_BYPASS_DISABLED_STORAGE_KEY = 'tf_dev_admin_bypass_disabled';
const DEV_ADMIN_BYPASS_USER_ID = 'dev-admin-id';

export const shouldEnableDevAdminBypass = (
    isDevRuntime = import.meta.env.DEV,
    bypassEnvValue = import.meta.env.VITE_DEV_ADMIN_BYPASS,
    bypassDisabled = false,
    pathname = '/'
): boolean => {
    const normalizedPath = stripLocalePrefix(pathname || '/');
    const isAdminRoute = normalizedPath.startsWith('/admin');
    return isDevRuntime && bypassEnvValue === 'true' && !bypassDisabled && isAdminRoute;
};

export const shouldAutoClearSimulatedLoginOnRealSession = (
    access: Pick<UserAccessContext, 'role' | 'isAnonymous'> | null,
    sessionUserId: string | null | undefined
): boolean => (
    Boolean(sessionUserId)
    && access?.isAnonymous !== true
    && sessionUserId !== DEV_ADMIN_BYPASS_USER_ID
);

export const shouldUseDevAdminBypassSession = (
    bypassEnabled: boolean,
    sessionUserId: string | null | undefined
): boolean => (
    bypassEnabled
    && (!sessionUserId || sessionUserId === DEV_ADMIN_BYPASS_USER_ID)
);

interface AuthContextValue {
    session: Session | null;
    access: UserAccessContext | null;
    profile: UserProfileRecord | null;
    isLoading: boolean;
    isProfileLoading: boolean;
    isAuthenticated: boolean;
    isAnonymous: boolean;
    isAdmin: boolean;
    refreshAccess: () => Promise<void>;
    refreshProfile: () => Promise<void>;
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
    const location = useLocation();
    const [session, setSession] = useState<Session | null>(null);
    const [access, setAccess] = useState<UserAccessContext | null>(null);
    const [profile, setProfile] = useState<UserProfileRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [isDevAdminBypassDisabled, setIsDevAdminBypassDisabled] = useState<boolean>(() => {
        if (!shouldEnableDevAdminBypass(import.meta.env.DEV, import.meta.env.VITE_DEV_ADMIN_BYPASS, false, '/admin')) return false;
        if (typeof window === 'undefined') return false;
        try {
            return window.sessionStorage.getItem(DEV_ADMIN_BYPASS_DISABLED_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });
    const hasBootstrappedRef = useRef(false);
    const isBootstrappingRef = useRef(false);
    const profileLoadRequestIdRef = useRef(0);

    const resetProfileState = useCallback(() => {
        profileLoadRequestIdRef.current += 1;
        setProfile(null);
        setIsProfileLoading(false);
    }, []);

    useEffect(() => {
        if (!shouldEnableDevAdminBypass(import.meta.env.DEV, import.meta.env.VITE_DEV_ADMIN_BYPASS, false, '/admin')) return;
        if (typeof window === 'undefined') return;
        try {
            if (isDevAdminBypassDisabled) {
                window.sessionStorage.setItem(DEV_ADMIN_BYPASS_DISABLED_STORAGE_KEY, '1');
                return;
            }
            window.sessionStorage.removeItem(DEV_ADMIN_BYPASS_DISABLED_STORAGE_KEY);
        } catch {
            // ignore storage write failures
        }
    }, [isDevAdminBypassDisabled]);

    useEffect(() => {
        const sessionUserId = session?.user?.id;
        if (!shouldAutoClearSimulatedLoginOnRealSession(access, sessionUserId)) return;
        if (!isSimulatedLoggedIn()) return;
        setSimulatedLoggedIn(false);
    }, [access, session?.user?.id]);

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

    const refreshProfile = useCallback(async () => {
        const requestId = profileLoadRequestIdRef.current + 1;
        profileLoadRequestIdRef.current = requestId;
        setIsProfileLoading(true);

        try {
            const profileService = await loadProfileService();
            const nextProfile = await profileService.getCurrentUserProfile();
            if (profileLoadRequestIdRef.current !== requestId) return;
            setProfile(nextProfile);
        } catch {
            if (profileLoadRequestIdRef.current !== requestId) return;
            setProfile(null);
        } finally {
            if (profileLoadRequestIdRef.current === requestId) {
                setIsProfileLoading(false);
            }
        }
    }, []);

    const refreshAccess = useCallback(async () => {
        const authService = await loadAuthService();
        const nextAccess = await authService.getCurrentAccessContext();
        setAccess(nextAccess);
        if (nextAccess?.userId && !nextAccess.isAnonymous) {
            await refreshProfile();
            return;
        }
        resetProfileState();
    }, [refreshProfile, resetProfileState]);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) = () => {};

        const isAnonymousSession = (value: Session | null): boolean => {
            const user = value?.user as (Session['user'] & { is_anonymous?: boolean }) | undefined;
            if (!user) return false;
            const email = typeof user.email === 'string' ? user.email.trim() : '';
            const phone = typeof user.phone === 'string' ? user.phone.trim() : '';
            if (email || phone) return false;
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
                        resetProfileState();
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
                    resetProfileState();
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
                    resetProfileState();
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
            setIsLoading(true);
            void bootstrap();
        };

        if (typeof window === 'undefined') {
            triggerBootstrap();
            return () => {
                cancelled = true;
                // React Strict Mode re-runs effects in dev. If a bootstrap run was
                // cancelled during that cycle, allow the next effect pass to start it.
                if (!hasBootstrappedRef.current) {
                    isBootstrappingRef.current = false;
                }
                unsubscribe();
            };
        }

        const shouldBootstrapImmediately = hasAuthCallbackPayload() || isAuthBootstrapCriticalPath(window.location.pathname);
        if (!shouldBootstrapImmediately) {
            appendAuthTraceEntry({
                ts: new Date().toISOString(),
                flowId: 'auth-bootstrap',
                attemptId: 'immediate-bootstrap',
                step: 'bootstrap_non_critical_path',
                result: 'success',
                provider: 'supabase',
                metadata: {
                    pathname: window.location.pathname,
                    reason: 'always_initialize_on_page_load',
                },
            });
        }
        triggerBootstrap();

        return () => {
            cancelled = true;
            // React Strict Mode re-runs effects in dev. If a bootstrap run was
            // cancelled during that cycle, allow the next effect pass to start it.
            if (!hasBootstrappedRef.current) {
                isBootstrappingRef.current = false;
            }
            unsubscribe();
        };
    }, [logAuthStateEvent, refreshAccess, resetProfileState]);

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
        try {
            await authService.signOut();
        } finally {
            if (shouldEnableDevAdminBypass(import.meta.env.DEV, import.meta.env.VITE_DEV_ADMIN_BYPASS, false, location.pathname)) {
                setIsDevAdminBypassDisabled(true);
            }
            setAccess(null);
            setSession(null);
            resetProfileState();
        }
    }, [location.pathname, resetProfileState]);

    const value = useMemo<AuthContextValue>(() => {
        const bypassEnabled = shouldEnableDevAdminBypass(
            import.meta.env.DEV,
            import.meta.env.VITE_DEV_ADMIN_BYPASS,
            isDevAdminBypassDisabled,
            location.pathname
        );
        const useDevAdminBypass = shouldUseDevAdminBypassSession(bypassEnabled, session?.user?.id);
        // Development bypass for local admin testing.
        if (useDevAdminBypass) {
            return {
                session: {
                    access_token: 'dev-bypass-token',
                    refresh_token: 'dev-bypass-refresh-token',
                    expires_in: 3600,
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    token_type: 'bearer',
                    user: {
                        id: DEV_ADMIN_BYPASS_USER_ID,
                        app_metadata: { provider: 'email', providers: ['email'] },
                        user_metadata: {},
                        aud: 'authenticated',
                        created_at: new Date().toISOString(),
                    } as any,
                },
                access: {
                    userId: DEV_ADMIN_BYPASS_USER_ID,
                    role: 'admin',
                    accountStatus: 'active',
                    isAnonymous: false,
                    tierKey: 'free',
                    entitlements: {},
                } as any,
                profile: null,
                isLoading: false,
                isProfileLoading: false,
                isAuthenticated: true,
                isAnonymous: false,
                isAdmin: true,
                refreshAccess,
                refreshProfile,
                loginWithPassword,
                registerWithPassword,
                loginWithOAuth,
                sendPasswordResetEmail,
                updatePassword,
                logout,
            };
        }

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
            profile,
            isLoading,
            isProfileLoading,
            isAuthenticated,
            isAnonymous,
            isAdmin,
            refreshAccess,
            refreshProfile,
            loginWithPassword,
            registerWithPassword,
            loginWithOAuth,
            sendPasswordResetEmail,
            updatePassword,
            logout,
        };
    }, [
        access,
        profile,
        isDevAdminBypassDisabled,
        isLoading,
        isProfileLoading,
        location.pathname,
        loginWithOAuth,
        loginWithPassword,
        logout,
        refreshAccess,
        refreshProfile,
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
