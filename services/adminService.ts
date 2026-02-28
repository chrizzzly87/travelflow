import type { PlanTierKey } from '../types';
import { dbGetAccessToken, ensureExistingDbSession } from './dbService';
import { normalizeProfileCountryCode } from './profileCountryService';
import { isSimulatedLoggedIn } from './simulatedLoginService';
import { supabase } from './supabaseClient';

export interface AdminUserRecord {
    user_id: string;
    email: string | null;
    is_anonymous?: boolean;
    auth_provider?: string | null;
    auth_providers?: string[] | null;
    activation_status?: 'activated' | 'invited' | 'pending' | 'anonymous' | null;
    last_sign_in_at?: string | null;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    gender?: string | null;
    country?: string | null;
    city?: string | null;
    preferred_language?: string | null;
    account_status?: 'active' | 'disabled' | 'deleted';
    disabled_at?: string | null;
    disabled_by?: string | null;
    active_trips?: number | null;
    total_trips?: number | null;
    system_role: 'admin' | 'user';
    tier_key: PlanTierKey;
    entitlements_override: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    onboarding_completed_at?: string | null;
}

export interface AdminTripRecord {
    trip_id: string;
    owner_id: string;
    owner_email: string | null;
    title: string | null;
    status: 'active' | 'archived' | 'expired';
    trip_expires_at: string | null;
    archived_at: string | null;
    source_kind: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminAuditRecord {
    id: string;
    actor_user_id: string | null;
    actor_email: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface AdminUserChangeRecord {
    id: string;
    owner_user_id: string;
    owner_email: string | null;
    action: string;
    source: string | null;
    target_type: string;
    target_id: string | null;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface AdminTripVersionSnapshotRecord {
    trip_id: string;
    before_version_id: string | null;
    after_version_id: string | null;
    before_snapshot: Record<string, unknown> | null;
    after_snapshot: Record<string, unknown> | null;
    before_view_settings: Record<string, unknown> | null;
    after_view_settings: Record<string, unknown> | null;
    before_label: string | null;
    after_label: string | null;
    before_created_at: string | null;
    after_created_at: string | null;
}

export interface AdminTierReapplyPreview {
    affected_users: number;
    affected_trips: number;
    active_trips: number;
    expired_trips: number;
    archived_trips: number;
    users_with_overrides: number;
}

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }
    return supabase;
};

const VALID_PROFILE_GENDERS = new Set(['female', 'male', 'non-binary', 'prefer-not']);

const normalizeProfileGender = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    return VALID_PROFILE_GENDERS.has(normalized) ? normalized : null;
};

const normalizeUsernameHandle = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase().replace(/^@+/, '');
    return normalized || null;
};

export const shouldUseAdminMockData = (
    isDevRuntime = import.meta.env.DEV,
    simulatedLoginEnabled = isSimulatedLoggedIn()
): boolean => isDevRuntime && simulatedLoginEnabled;

export const adminListUsers = async (
    options: {
        limit?: number;
        offset?: number;
        search?: string;
    } = {}
): Promise<AdminUserRecord[]> => {
    if (shouldUseAdminMockData()) {
        const now = new Date();
        const mockUsers: AdminUserRecord[] = Array.from({ length: 15 }).map((_, i) => ({
            user_id: `mock-user-${i}`,
            email: `user${i}@example.com`,
            system_role: i === 0 ? 'admin' : 'user',
            tier_key: i % 3 === 0 ? 'tier_premium' : 'tier_free',
            account_status: i === 14 ? 'disabled' : 'active',
            auth_provider: i % 2 === 0 ? 'email' : 'google',
            created_at: new Date(now.getTime() - i * 86400000 * 3).toISOString(),
            updated_at: new Date(now.getTime() - i * 3600000).toISOString(),
            entitlements_override: null,
            first_name: `TestName${i}`,
            last_name: `LastName${i}`,
        }));
        return mockUsers;
    }

    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_list_users', {
        p_limit: options.limit ?? 250,
        p_offset: options.offset ?? 0,
        p_search: options.search ?? null,
    });
    if (error) throw new Error(error.message || 'Could not load admin users.');
    return (Array.isArray(data) ? data : []) as AdminUserRecord[];
};

export const adminUpdateUserTier = async (userId: string, tierKey: PlanTierKey): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    const client = requireSupabase();
    const { error } = await client.rpc('admin_update_user_tier', {
        p_user_id: userId,
        p_tier_key: tierKey,
    });
    if (error) throw new Error(error.message || 'Could not update user tier.');
};

export const adminUpdateUserOverrides = async (userId: string, overrides: Record<string, unknown>): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    const client = requireSupabase();
    const { error } = await client.rpc('admin_update_user_overrides', {
        p_user_id: userId,
        p_overrides: overrides,
    });
    if (error) throw new Error(error.message || 'Could not update user overrides.');
};

export const adminUpdateUserProfile = async (
    userId: string,
    payload: {
        firstName?: string | null;
        lastName?: string | null;
        username?: string | null;
        gender?: string | null;
        country?: string | null;
        city?: string | null;
        preferredLanguage?: string | null;
        accountStatus?: 'active' | 'disabled' | 'deleted' | null;
        systemRole?: 'admin' | 'user' | null;
        tierKey?: PlanTierKey | null;
    }
): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    const normalizedCountry = typeof payload.country === 'string'
        ? normalizeProfileCountryCode(payload.country)
        : '';
    if (typeof payload.country === 'string' && payload.country.trim() && !normalizedCountry) {
        throw new Error('Country/Region must be a valid ISO 3166-1 alpha-2 country code.');
    }
    const client = requireSupabase();
    const rpcPayload = {
        p_user_id: userId,
        p_first_name: payload.firstName ?? null,
        p_last_name: payload.lastName ?? null,
        p_username: normalizeUsernameHandle(payload.username),
        p_gender: normalizeProfileGender(payload.gender),
        p_country: typeof payload.country === 'string'
            ? (normalizedCountry || null)
            : null,
        p_city: payload.city ?? null,
        p_preferred_language: payload.preferredLanguage ?? null,
        p_account_status: payload.accountStatus ?? null,
        p_system_role: payload.systemRole ?? null,
        p_tier_key: payload.tierKey ?? null,
    };

    let { error } = await client.rpc('admin_update_user_profile', {
        ...rpcPayload,
        p_bypass_username_cooldown: true,
    });

    if (error && /function/i.test(error.message || '') && /admin_update_user_profile/i.test(error.message || '')) {
        const fallback = await client.rpc('admin_update_user_profile', rpcPayload);
        error = fallback.error;
    }

    if (error) throw new Error(error.message || 'Could not update user profile.');
};

export const adminGetUserProfile = async (userId: string): Promise<AdminUserRecord | null> => {
    if (shouldUseAdminMockData()) {
        const now = new Date();
        return {
            user_id: userId,
            email: `user-mock@example.com`,
            system_role: 'user',
            tier_key: 'tier_free',
            account_status: 'active',
            auth_provider: 'email',
            created_at: new Date(now.getTime() - 86400000 * 3).toISOString(),
            updated_at: new Date(now.getTime() - 3600000).toISOString(),
            entitlements_override: null,
            first_name: `MockUser`,
            last_name: `Profile`,
        };
    }
    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_get_user_profile', {
        p_user_id: userId,
    });
    if (error) throw new Error(error.message || 'Could not load user profile.');
    const row = Array.isArray(data) ? data[0] : data;
    return row ? (row as AdminUserRecord) : null;
};

export const adminListTrips = async (
    options: {
        limit?: number;
        offset?: number;
        search?: string;
        ownerId?: string | null;
        status?: 'active' | 'archived' | 'expired' | 'all';
    } = {}
): Promise<AdminTripRecord[]> => {
    if (shouldUseAdminMockData()) {
        const now = new Date();
        const mockTrips: AdminTripRecord[] = Array.from({ length: 45 }).map((_, i) => ({
            trip_id: `mock-trip-${i}`,
            owner_id: `mock-user-${i % 15}`,
            owner_email: `user${i % 15}@example.com`,
            title: `Mock Trip to ${['Paris', 'Tokyo', 'London', 'New York', 'Rome'][i % 5]}`,
            status: i % 10 === 0 ? 'expired' : i % 8 === 0 ? 'archived' : 'active',
            trip_expires_at: null,
            archived_at: null,
            source_kind: null,
            created_at: new Date(now.getTime() - i * 86400000 * 1.5).toISOString(),
            updated_at: new Date(now.getTime() - i * 3600000).toISOString(),
        }));
        return mockTrips;
    }

    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_list_trips', {
        p_limit: options.limit ?? 300,
        p_offset: options.offset ?? 0,
        p_search: options.search ?? null,
        p_owner_id: options.ownerId ?? null,
        p_status: options.status && options.status !== 'all' ? options.status : null,
    });
    if (error) throw new Error(error.message || 'Could not load trips.');
    return (Array.isArray(data) ? data : []) as AdminTripRecord[];
};

export const adminListUserTrips = async (
    userId: string,
    options: { limit?: number; offset?: number; status?: 'active' | 'archived' | 'expired' | 'all' } = {}
): Promise<AdminTripRecord[]> => {
    if (shouldUseAdminMockData()) {
        const now = new Date();
        return Array.from({ length: 3 }).map((_, i) => ({
            trip_id: `mock-trip-${i}`,
            owner_id: userId,
            owner_email: `user-mock@example.com`,
            title: `User's Mock Trip ${i}`,
            status: 'active',
            trip_expires_at: null,
            archived_at: null,
            source_kind: null,
            created_at: new Date(now.getTime() - i * 86400000).toISOString(),
            updated_at: new Date(now.getTime() - 3600000).toISOString(),
        }));
    }
    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_list_user_trips', {
        p_user_id: userId,
        p_limit: options.limit ?? 200,
        p_offset: options.offset ?? 0,
        p_status: options.status && options.status !== 'all' ? options.status : null,
    });
    if (error) throw new Error(error.message || 'Could not load user trips.');
    return (Array.isArray(data) ? data : []) as AdminTripRecord[];
};

export const adminUpdateTrip = async (
    tripId: string,
    patch: {
        status?: 'active' | 'archived' | 'expired' | null;
        tripExpiresAt?: string | null;
        ownerId?: string | null;
    }
): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    const client = requireSupabase();
    const { error } = await client.rpc('admin_update_trip', {
        p_trip_id: tripId,
        p_status: patch.status ?? null,
        p_trip_expires_at: patch.tripExpiresAt ?? null,
        p_owner_id: patch.ownerId ?? null,
        p_apply_status: Object.prototype.hasOwnProperty.call(patch, 'status'),
        p_apply_trip_expires_at: Object.prototype.hasOwnProperty.call(patch, 'tripExpiresAt'),
        p_apply_owner_id: Object.prototype.hasOwnProperty.call(patch, 'ownerId'),
    });
    if (error) throw new Error(error.message || 'Could not update trip.');
};

export const adminHardDeleteTrip = async (tripId: string): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    const client = requireSupabase();
    const { error } = await client.rpc('admin_hard_delete_trip', {
        p_trip_id: tripId,
    });
    if (error) throw new Error(error.message || 'Could not hard-delete trip.');
};

export const adminUpdatePlanEntitlements = async (
    tierKey: PlanTierKey,
    entitlements: Record<string, unknown>
): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    const client = requireSupabase();
    const { error } = await client.rpc('admin_update_plan_entitlements', {
        p_tier_key: tierKey,
        p_entitlements: entitlements,
    });
    if (error) throw new Error(error.message || 'Could not update plan entitlements.');
};

export const adminReapplyTierToUsers = async (
    tierKey: PlanTierKey
): Promise<{ affected_users: number; affected_trips: number }> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { affected_users: 10, affected_trips: 15 };
    }
    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_reapply_tier_to_users', {
        p_tier_key: tierKey,
        p_apply_expiration_backfill: true,
    });
    if (error) throw new Error(error.message || 'Could not reapply tier changes.');
    const row = Array.isArray(data) ? data[0] : data;
    return row as { affected_users: number; affected_trips: number };
};

export const adminPreviewTierReapply = async (tierKey: PlanTierKey): Promise<AdminTierReapplyPreview> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
            affected_users: 100,
            affected_trips: 150,
            active_trips: 50,
            expired_trips: 50,
            archived_trips: 50,
            users_with_overrides: 5,
        };
    }
    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_preview_tier_reapply', {
        p_tier_key: tierKey,
    });
    if (error) throw new Error(error.message || 'Could not preview tier reapply.');
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        return {
            affected_users: 0,
            affected_trips: 0,
            active_trips: 0,
            expired_trips: 0,
            archived_trips: 0,
            users_with_overrides: 0,
        };
    }
    return row as AdminTierReapplyPreview;
};

export const adminListAuditLogs = async (
    options: {
        limit?: number;
        offset?: number;
        action?: string;
        targetType?: string;
        actorUserId?: string;
    } = {}
): Promise<AdminAuditRecord[]> => {
    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_list_audit_logs', {
        p_limit: options.limit ?? 200,
        p_offset: options.offset ?? 0,
        p_action: options.action ?? null,
        p_target_type: options.targetType ?? null,
        p_actor_user_id: options.actorUserId ?? null,
    });
    if (error) throw new Error(error.message || 'Could not load audit logs.');
    return (Array.isArray(data) ? data : []) as AdminAuditRecord[];
};

export const adminListUserChangeLogs = async (
    options: {
        limit?: number;
        offset?: number;
        action?: string;
        ownerUserId?: string;
    } = {}
): Promise<AdminUserChangeRecord[]> => {
    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_list_user_change_logs', {
        p_limit: options.limit ?? 200,
        p_offset: options.offset ?? 0,
        p_action: options.action ?? null,
        p_owner_user_id: options.ownerUserId ?? null,
    });
    if (error) throw new Error(error.message || 'Could not load user change logs.');
    return (Array.isArray(data) ? data : []) as AdminUserChangeRecord[];
};

export const adminGetTripVersionSnapshots = async (
    payload: {
        tripId: string;
        afterVersionId?: string | null;
        beforeVersionId?: string | null;
    }
): Promise<AdminTripVersionSnapshotRecord | null> => {
    const tripId = payload.tripId.trim();
    if (!tripId) return null;

    if (shouldUseAdminMockData()) {
        return {
            trip_id: tripId,
            before_version_id: payload.beforeVersionId ?? 'mock-before',
            after_version_id: payload.afterVersionId ?? 'mock-after',
            before_snapshot: { id: tripId, title: 'Before snapshot', items: [] },
            after_snapshot: { id: tripId, title: 'After snapshot', items: [] },
            before_view_settings: { mapStyle: 'minimal', timelineView: 'vertical' },
            after_view_settings: { mapStyle: 'clean', timelineView: 'horizontal' },
            before_label: 'Mock before',
            after_label: 'Mock after',
            before_created_at: new Date(Date.now() - 60_000).toISOString(),
            after_created_at: new Date().toISOString(),
        };
    }

    const client = requireSupabase();
    const { data, error } = await client.rpc('admin_get_trip_version_snapshots', {
        p_trip_id: tripId,
        p_after_version_id: payload.afterVersionId ?? null,
        p_before_version_id: payload.beforeVersionId ?? null,
    });
    if (error) throw new Error(error.message || 'Could not load trip version snapshots.');
    const row = Array.isArray(data) ? data[0] : data;
    return row ? (row as AdminTripVersionSnapshotRecord) : null;
};

const callAdminIdentityApi = async (
    body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> => {
    await ensureExistingDbSession();
    const token = await dbGetAccessToken();
    if (!token) {
        throw new Error('No active access token found for admin operation.');
    }

    const response = await fetch('/api/internal/admin/iam', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text().catch(() => '');
    const payload = responseText
        ? (() => {
            try {
                return JSON.parse(responseText);
            } catch {
                return {};
            }
        })()
        : {};
    if (!response.ok || payload?.ok === false) {
        const looksLikeViteNotFoundPage = response.status === 404
            && /<\s*html|<\s*!doctype\s+html/i.test(responseText);
        const payloadError =
            typeof payload?.error === 'string'
                ? payload.error
                : typeof payload?.message === 'string'
                    ? payload.message
                    : payload?.error && typeof payload.error === 'object' && typeof payload.error.message === 'string'
                        ? payload.error.message
                        : null;
        const fallbackText = responseText.trim();
        const normalizedFallback = fallbackText && fallbackText.length <= 280 ? fallbackText : null;
        const devNotFoundMessage = looksLikeViteNotFoundPage && import.meta.env.DEV
            ? 'Admin identity route is unavailable in Vite-only dev. Run `pnpm dev:netlify` (or run it in a second terminal while `pnpm dev` is active) to test admin delete/invite/create actions.'
            : null;
        const looksLikeViteProxyFailure = import.meta.env.DEV
            && response.status === 500
            && !payloadError
            && (!normalizedFallback || normalizedFallback === 'Internal Server Error');
        const devProxyFailureMessage = looksLikeViteProxyFailure
            ? 'Vite could not reach Netlify dev for admin identity actions (connection refused on localhost:8888). Start `pnpm dev:netlify` before testing delete/invite/create.'
            : null;
        const reason = payloadError
            || devNotFoundMessage
            || devProxyFailureMessage
            || normalizedFallback
            || response.statusText
            || 'Admin identity API request failed.';
        const errorMessage = `Admin identity API request failed (${response.status}): ${reason}`;
        throw new Error(errorMessage);
    }
    return payload as { ok: boolean; error?: string; data?: Record<string, unknown> };
};

export const adminCreateUserInvite = async (payload: {
    email: string;
    firstName?: string;
    lastName?: string;
    tierKey?: PlanTierKey;
    redirectTo?: string;
}): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    await callAdminIdentityApi({
        action: 'invite',
        email: payload.email,
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        tierKey: payload.tierKey ?? 'tier_free',
        redirectTo: payload.redirectTo ?? null,
    });
};

export const adminCreateUserDirect = async (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    tierKey?: PlanTierKey;
}): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    await callAdminIdentityApi({
        action: 'create',
        email: payload.email,
        password: payload.password,
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        tierKey: payload.tierKey ?? 'tier_free',
    });
};

export const adminHardDeleteUser = async (userId: string): Promise<void> => {
    if (shouldUseAdminMockData()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    }
    await callAdminIdentityApi({
        action: 'delete',
        userId,
    });
};
