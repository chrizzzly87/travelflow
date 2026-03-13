import type { Session } from '@supabase/supabase-js';

import { getFreePlanEntitlements } from '../config/planCatalog';
import type { UserAccessContext } from '../types';
import {
    readLocalStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';

export const E2E_AUTH_SANDBOX_STORAGE_KEY = 'tf_e2e_auth_sandbox_v1';
export const E2E_AUTH_SANDBOX_EVENT = 'tf:e2e-auth-sandbox';

const FREE_ENTITLEMENTS = getFreePlanEntitlements();
const E2E_TERMS_VERSION = 'e2e-sandbox-v1';

interface E2EAuthSandboxUser {
    id: string;
    email: string;
    password: string;
    createdAt: string;
}

interface E2EAuthSandboxState {
    activeUserId: string | null;
    users: E2EAuthSandboxUser[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const createSandboxState = (): E2EAuthSandboxState => ({
    activeUserId: null,
    users: [],
});

const readSandboxState = (): E2EAuthSandboxState => {
    if (typeof window === 'undefined') return createSandboxState();
    try {
        const raw = readLocalStorageItem(E2E_AUTH_SANDBOX_STORAGE_KEY);
        if (!raw) return createSandboxState();
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) return createSandboxState();

        const activeUserId = typeof parsed.activeUserId === 'string' && parsed.activeUserId.trim().length > 0
            ? parsed.activeUserId.trim()
            : null;
        const users = Array.isArray(parsed.users)
            ? parsed.users
                .map((entry) => {
                    if (!isRecord(entry)) return null;
                    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
                    const email = typeof entry.email === 'string' ? normalizeEmail(entry.email) : '';
                    const password = typeof entry.password === 'string' ? entry.password : '';
                    const createdAt = typeof entry.createdAt === 'string' && entry.createdAt.trim().length > 0
                        ? entry.createdAt
                        : new Date(0).toISOString();
                    if (!id || !email || !password) return null;
                    return { id, email, password, createdAt } satisfies E2EAuthSandboxUser;
                })
                .filter((entry): entry is E2EAuthSandboxUser => Boolean(entry))
            : [];

        return {
            activeUserId,
            users,
        };
    } catch {
        return createSandboxState();
    }
};

const writeSandboxState = (state: E2EAuthSandboxState): void => {
    if (typeof window === 'undefined') return;
    writeLocalStorageItem(E2E_AUTH_SANDBOX_STORAGE_KEY, JSON.stringify(state));
};

const dispatchSandboxEvent = (): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(E2E_AUTH_SANDBOX_EVENT));
};

const buildUserId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `e2e-user-${crypto.randomUUID()}`;
    }
    return `e2e-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildSession = (user: E2EAuthSandboxUser): Session => {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 3600;
    return {
        access_token: `e2e-access-${user.id}`,
        refresh_token: `e2e-refresh-${user.id}`,
        expires_in: 3600,
        expires_at: expiresAt,
        token_type: 'bearer',
        user: {
            id: user.id,
            email: user.email,
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            aud: 'authenticated',
            created_at: user.createdAt,
        } as Session['user'],
    };
};

const buildAccess = (user: E2EAuthSandboxUser): UserAccessContext => ({
    userId: user.id,
    email: user.email,
    isAnonymous: false,
    role: 'user',
    tierKey: 'tier_free',
    entitlements: FREE_ENTITLEMENTS,
    onboardingCompleted: true,
    accountStatus: 'active',
    termsCurrentVersion: E2E_TERMS_VERSION,
    termsRequiresReaccept: false,
    termsAcceptedVersion: E2E_TERMS_VERSION,
    termsAcceptedAt: new Date().toISOString(),
    termsAcceptanceRequired: false,
    termsNoticeRequired: false,
});

const resolveActiveUser = (state: E2EAuthSandboxState): E2EAuthSandboxUser | null => (
    state.users.find((entry) => entry.id === state.activeUserId) || null
);

export const shouldEnableE2EAuthSandbox = (): boolean => (
    import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH_SANDBOX === 'true'
);

export const getE2EAuthSandboxSnapshot = (): {
    session: Session | null;
    access: UserAccessContext | null;
} => {
    const state = readSandboxState();
    const user = resolveActiveUser(state);
    if (!user) {
        return {
            session: null,
            access: null,
        };
    }

    return {
        session: buildSession(user),
        access: buildAccess(user),
    };
};

export const subscribeToE2EAuthSandbox = (callback: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => undefined;
    const handleStorage = (event: StorageEvent) => {
        if (event.key && event.key !== E2E_AUTH_SANDBOX_STORAGE_KEY) return;
        callback();
    };
    const handleSandboxEvent = () => callback();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(E2E_AUTH_SANDBOX_EVENT, handleSandboxEvent);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(E2E_AUTH_SANDBOX_EVENT, handleSandboxEvent);
    };
};

const successResponse = (user: E2EAuthSandboxUser) => {
    const session = buildSession(user);
    return {
        data: {
            session,
            user: session.user,
        },
        error: null,
    };
};

const errorResponse = (message: string) => ({
    data: {
        session: null,
        user: null,
    },
    error: new Error(message),
});

export const registerWithE2EAuthSandbox = async (
    email: string,
    password: string,
): Promise<ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>> => {
    const normalizedEmail = normalizeEmail(email);
    const trimmedPassword = password.trim();
    const state = readSandboxState();
    const existing = state.users.find((entry) => entry.email === normalizedEmail);
    if (existing) {
        return errorResponse('User already registered');
    }

    const user: E2EAuthSandboxUser = {
        id: buildUserId(),
        email: normalizedEmail,
        password: trimmedPassword,
        createdAt: new Date().toISOString(),
    };

    const nextState: E2EAuthSandboxState = {
        activeUserId: user.id,
        users: [...state.users, user],
    };
    writeSandboxState(nextState);
    dispatchSandboxEvent();
    return successResponse(user);
};

export const loginWithE2EAuthSandbox = async (
    email: string,
    password: string,
): Promise<ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>> => {
    const normalizedEmail = normalizeEmail(email);
    const state = readSandboxState();
    const user = state.users.find((entry) => entry.email === normalizedEmail);
    if (!user || user.password !== password.trim()) {
        return errorResponse('Invalid login credentials');
    }

    const nextState: E2EAuthSandboxState = {
        ...state,
        activeUserId: user.id,
    };
    writeSandboxState(nextState);
    dispatchSandboxEvent();
    return successResponse(user);
};

export const logoutFromE2EAuthSandbox = async (): Promise<void> => {
    const state = readSandboxState();
    writeSandboxState({
        ...state,
        activeUserId: null,
    });
    dispatchSandboxEvent();
};

export const clearE2EAuthSandbox = (): void => {
    if (typeof window === 'undefined') return;
    removeLocalStorageItem(E2E_AUTH_SANDBOX_STORAGE_KEY);
    dispatchSandboxEvent();
};

export const acceptCurrentTermsInE2EAuthSandbox = (): { termsVersion: string; acceptedAt: string } => ({
    termsVersion: E2E_TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
});
