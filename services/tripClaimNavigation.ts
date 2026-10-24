export const TRIP_CLAIM_CONFLICT_QUERY_KEY = 'claim_conflict';
export const TRIP_CLAIM_CONFLICT_ALREADY_CLAIMED = 'already_claimed';

const LOCAL_BASE_URL = 'https://travelflow.local';

const parseRelativePath = (path: string): URL => new URL(path || '/', LOCAL_BASE_URL);

const buildRelativePath = (url: URL): string => `${url.pathname}${url.search}${url.hash}`;

export const readTripClaimConflictQuery = (search: string): string | null => {
    const value = new URLSearchParams(search).get(TRIP_CLAIM_CONFLICT_QUERY_KEY);
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
};

export const buildTripClaimConflictPath = (path: string): string => {
    const url = parseRelativePath(path);
    url.searchParams.delete('claim');
    url.searchParams.set(TRIP_CLAIM_CONFLICT_QUERY_KEY, TRIP_CLAIM_CONFLICT_ALREADY_CLAIMED);
    return buildRelativePath(url);
};

export const buildTripClaimLoginReturnPath = (path: string, claimId?: string | null): string => {
    const url = parseRelativePath(path);
    url.searchParams.delete(TRIP_CLAIM_CONFLICT_QUERY_KEY);
    if (claimId) {
        url.searchParams.set('claim', claimId);
    } else {
        url.searchParams.delete('claim');
    }
    return buildRelativePath(url);
};
