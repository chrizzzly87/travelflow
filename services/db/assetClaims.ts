import { isUuid } from '../../utils';
import { DB_ENABLED, requireSupabase } from './internal';
import { ensureDbSession } from './session';

export interface DbAnonymousAssetClaimResult {
    claimId: string;
    status: 'pending' | 'claimed' | 'expired' | 'failed' | 'revoked';
    expiresAtIso: string;
}

export interface DbClaimAnonymousAssetsResult {
    claimId: string;
    status: string;
    targetUserId: string | null;
    anonUserId: string | null;
    transferredTrips: number;
    transferredTripEvents: number;
    transferredProfileEvents: number;
    transferredTripVersions: number;
    transferredTripShares: number;
    transferredCollaborators: number;
    deduplicatedCollaborators: number;
}

const normalizeClaimStatus = (value: unknown): DbAnonymousAssetClaimResult['status'] => {
    if (value === 'claimed' || value === 'expired' || value === 'failed' || value === 'revoked') return value;
    return 'pending';
};

export const dbCreateAnonymousAssetClaim = async (
    expiresMinutes = 60
): Promise<DbAnonymousAssetClaimResult | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();
    const { data, error } = await client.rpc('create_anonymous_asset_claim', {
        p_expires_minutes: Math.max(5, Math.floor(expiresMinutes)),
    });

    if (error) {
        console.error('Failed to create anonymous asset claim', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const claimId = typeof row?.claim_id === 'string' ? row.claim_id : null;
    const expiresAtIso = typeof row?.expires_at === 'string' ? row.expires_at : null;
    if (!claimId || !expiresAtIso) return null;

    return {
        claimId,
        status: normalizeClaimStatus(row?.status),
        expiresAtIso,
    };
};

const asFiniteCount = (value: unknown): number => (
    typeof value === 'number' && Number.isFinite(value)
        ? value
        : (typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : 0)
);

export const dbClaimAnonymousAssets = async (
    claimId: string
): Promise<DbClaimAnonymousAssetsResult | null> => {
    if (!DB_ENABLED) return null;
    if (!isUuid(claimId)) return null;
    const client = requireSupabase();
    await ensureDbSession();
    const { data, error } = await client.rpc('claim_anonymous_assets', {
        p_claim_id: claimId,
    });

    if (error) {
        throw new Error(error.message || 'Could not claim anonymous assets.');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.claim_id !== 'string') return null;

    return {
        claimId: row.claim_id,
        status: typeof row.status === 'string' ? row.status : 'claimed',
        targetUserId: typeof row.target_user_id === 'string' ? row.target_user_id : null,
        anonUserId: typeof row.anon_user_id === 'string' ? row.anon_user_id : null,
        transferredTrips: asFiniteCount(row.transferred_trips),
        transferredTripEvents: asFiniteCount(row.transferred_trip_events),
        transferredProfileEvents: asFiniteCount(row.transferred_profile_events),
        transferredTripVersions: asFiniteCount(row.transferred_trip_versions),
        transferredTripShares: asFiniteCount(row.transferred_trip_shares),
        transferredCollaborators: asFiniteCount(row.transferred_collaborators),
        deduplicatedCollaborators: asFiniteCount(row.deduplicated_collaborators),
    };
};

export const dbExpireStaleAnonymousAssetClaims = async (): Promise<number> => {
    if (!DB_ENABLED) return 0;
    const client = requireSupabase();
    const { data, error } = await client.rpc('expire_stale_anonymous_asset_claims');
    if (error) {
        console.error('Failed to expire stale anonymous asset claims', error);
        return 0;
    }
    if (typeof data === 'number' && Number.isFinite(data)) return data;
    const row = Array.isArray(data) ? data[0] : data;
    if (typeof row === 'number' && Number.isFinite(row)) return row;
    if (row && typeof row.expire_stale_anonymous_asset_claims === 'number') {
        return row.expire_stale_anonymous_asset_claims;
    }
    return 0;
};
