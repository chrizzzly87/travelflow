/** Lightweight queue outcome identity shared by viewing, auth and execution. */
export class QueuedTripGenerationError extends Error {
    tripId: string | null;
    causeError: unknown;

    constructor(message: string, details?: { tripId?: string | null; cause?: unknown }) {
        super(message);
        this.name = 'QueuedTripGenerationError';
        this.tripId = details?.tripId || null;
        this.causeError = details?.cause;
    }
}

export class QueuedTripGenerationAlreadyClaimedError extends QueuedTripGenerationError {
    requestId: string | null;
    claimedByAnotherUser: boolean;

    constructor(message: string, details?: { tripId?: string | null; requestId?: string | null; cause?: unknown; claimedByAnotherUser?: boolean }) {
        super(message, { tripId: details?.tripId, cause: details?.cause });
        this.name = 'QueuedTripGenerationAlreadyClaimedError';
        this.requestId = details?.requestId || null;
        this.claimedByAnotherUser = details?.claimedByAnotherUser === true;
    }
}

export const isQueuedTripGenerationAlreadyClaimedError = (error: unknown): error is QueuedTripGenerationAlreadyClaimedError => (
    error instanceof QueuedTripGenerationAlreadyClaimedError
);

export const isQueuedTripGenerationClaimedByAnotherUserError = (error: unknown): error is QueuedTripGenerationAlreadyClaimedError => (
    error instanceof QueuedTripGenerationAlreadyClaimedError
    && error.claimedByAnotherUser === true
);
