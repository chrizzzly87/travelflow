export const hasTripGenerationSessionAccess = (input: {
    isAuthenticated: boolean;
    isAnonymous: boolean;
    sessionUserId?: string | null;
}): boolean => (
    input.isAuthenticated
    || input.isAnonymous
    || Boolean(input.sessionUserId?.trim())
);
