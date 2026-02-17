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

        const bootstrap = async () => {
            if (!supabase) {
                if (!cancelled) {
                    setSession(null);
                    setAccess(null);
                    setIsLoading(false);
                }
                return;
            }

            const { data: sessionData } = await supabase.auth.getSession();
            if (cancelled) return;
            const activeSession = sessionData?.session ?? null;
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
            setSession(nextSession);
            if (nextSession) {
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
