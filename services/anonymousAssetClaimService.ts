import { dbClaimAnonymousAssets, dbExpireStaleAnonymousAssetClaims } from './dbApi';

export interface AnonymousAssetClaimOutcome {
    claimId: string;
    status: string;
    transferredTrips: number;
    transferredTripEvents: number;
    transferredProfileEvents: number;
    transferredTripVersions: number;
    transferredTripShares: number;
    transferredCollaborators: number;
    deduplicatedCollaborators: number;
}

const isClaimNotFoundError = (message: string): boolean => (
    message.includes('not found')
    || message.includes('missing')
    || message.includes('already processed')
);

const isClaimExpiredError = (message: string): boolean => (
    message.includes('expired')
    || message.includes('no longer active')
);

export const resolveAnonymousAssetClaimErrorCode = (error: unknown): 'missing' | 'expired' | 'default' => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message) return 'default';
    if (isClaimNotFoundError(message)) return 'missing';
    if (isClaimExpiredError(message)) return 'expired';
    return 'default';
};

export const runOpportunisticAnonymousAssetClaimCleanup = async (): Promise<void> => {
    try {
        await dbExpireStaleAnonymousAssetClaims();
    } catch {
        // non-blocking maintenance
    }
};

export const processAnonymousAssetClaimAfterAuth = async (
    claimId: string
): Promise<AnonymousAssetClaimOutcome | null> => {
    const result = await dbClaimAnonymousAssets(claimId);
    if (!result) return null;
    return {
        claimId: result.claimId,
        status: result.status,
        transferredTrips: result.transferredTrips,
        transferredTripEvents: result.transferredTripEvents,
        transferredProfileEvents: result.transferredProfileEvents,
        transferredTripVersions: result.transferredTripVersions,
        transferredTripShares: result.transferredTripShares,
        transferredCollaborators: result.transferredCollaborators,
        deduplicatedCollaborators: result.deduplicatedCollaborators,
    };
};
