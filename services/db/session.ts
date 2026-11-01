import { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin } from '../simulatedLoginService';
import {
    DB_ENABLED,
    debugLog,
    isAnonymousSessionUser,
    isDebugEnabled,
    requireSupabase,
    type SessionUserLike,
} from './internal';

export { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin };

let cachedUserId: string | null = null;
let sessionPromise: Promise<string | null> | null = null;
let lastAuthAttemptAt = 0;
let debugAuthChecked = false;
let authBlockedUntil = 0;

const AUTH_COOLDOWN_MS = 3000;
const SESSION_POLL_MS = 200;
const SESSION_POLL_ATTEMPTS = 6;

const maybeLogAuthContext = async () => {
    if (!isDebugEnabled()) return;
    if (debugAuthChecked) return;
    debugAuthChecked = true;
    try {
        const client = requireSupabase();
        const { data, error } = await client.rpc('debug_auth_context');
        if (error) {
            debugLog('debug_auth_context:missing', { message: error.message });
            return;
        }
        debugLog('debug_auth_context', data);
    } catch (e) {
        debugLog('debug_auth_context:error', e);
    }
};

const maybeDisableSimulatedLoginForRealSession = (sessionUser: SessionUserLike | null | undefined): void => {
    if (!import.meta.env.DEV) return;
    if (!isSimulatedLoggedIn()) return;
    if (isAnonymousSessionUser(sessionUser ?? null)) return;
    setSimulatedLoggedIn(false);
    debugLog('simulatedLogin:autoDisabledForRealSession');
};

const pollForSessionUserId = async (
    client: ReturnType<typeof requireSupabase>
): Promise<string | null> => {
    for (let i = 0; i < SESSION_POLL_ATTEMPTS; i += 1) {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) {
            console.warn('Supabase session error', sessionError);
        }
        const sessionUserId = sessionData?.session?.user?.id ?? null;
        if (sessionUserId) {
            maybeDisableSimulatedLoginForRealSession(sessionData?.session?.user as SessionUserLike | undefined);
            debugLog('ensureDbSession:session', { userId: sessionUserId, expiresAt: sessionData?.session?.expires_at });
            return sessionUserId;
        }
        if (i < SESSION_POLL_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, SESSION_POLL_MS));
        }
    }
    return null;
};

export const ensureExistingDbSession = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const sessionUserId = await pollForSessionUserId(client);
    if (sessionUserId) {
        cachedUserId = sessionUserId;
        await maybeLogAuthContext();
        return cachedUserId;
    }
    cachedUserId = null;
    return null;
};

export const ensureDbSession = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    if (sessionPromise) return sessionPromise;
    const client = requireSupabase();
    sessionPromise = (async () => {
        try {
            debugLog('ensureDbSession:start');
            const existingSessionUserId = await pollForSessionUserId(client);
            if (existingSessionUserId) {
                cachedUserId = existingSessionUserId;
                await maybeLogAuthContext();
                return cachedUserId;
            }

            cachedUserId = null;
            const now = Date.now();
            if (authBlockedUntil && now < authBlockedUntil) {
                debugLog('ensureDbSession:blocked', { until: authBlockedUntil });
                return null;
            }
            if (now - lastAuthAttemptAt < AUTH_COOLDOWN_MS) {
                return null;
            }
            lastAuthAttemptAt = now;

            const { data, error } = await client.auth.signInAnonymously();
            if (error) {
                console.error('Supabase anonymous sign-in failed', error);
                if (error.status === 429 || /rate limit/i.test(error.message || '')) {
                    authBlockedUntil = Date.now() + 60000;
                }
                return null;
            }
            if (data?.session) {
                try {
                    await client.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                    });
                } catch (e) {
                    console.warn('Supabase setSession failed after anonymous sign-in', e);
                }
                if (data.session.user?.id) {
                    debugLog('ensureDbSession:signIn', { userId: data.session.user.id });
                    cachedUserId = data.session.user.id;
                    await maybeLogAuthContext();
                    return cachedUserId;
                }
            }
            const sessionAfterSignIn = await pollForSessionUserId(client);
            if (sessionAfterSignIn) {
                cachedUserId = sessionAfterSignIn;
                await maybeLogAuthContext();
                return cachedUserId;
            }
            return null;
        } finally {
            sessionPromise = null;
        }
    })();

    return sessionPromise;
};

export const dbGetAccessToken = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureExistingDbSession();
    const { data, error } = await client.auth.getSession();
    if (error) {
        console.error('Failed to read Supabase access token', error);
        return null;
    }
    return data?.session?.access_token ?? null;
};
