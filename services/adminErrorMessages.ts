/**
 * What an admin screen shows when a request fails.
 *
 * Service errors mix authored sentences ("Version is required.") with raw
 * PostgREST/Postgres text (constraint names, JWT internals, function names).
 * Only text that was written for a person reaches the screen:
 *
 * 1. `AdminUserFacingError` — thrown deliberately with an authored sentence.
 * 2. Known infrastructure failures (permission, session, network), mapped to
 *    an authored sentence.
 * 3. Short sentences our own SQL raises for a person to read.
 *
 * Everything else shows the caller's fallback sentence, and the raw error goes
 * to the console for whoever is debugging.
 */
export class AdminUserFacingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AdminUserFacingError';
    }
}

const KNOWN_FAILURES: Array<[RegExp, string]> = [
    [/^not allowed\.?$/i, 'Your account does not have permission for this action.'],
    [/^not authenticated\.?$|jwt expired|invalid jwt|no active access token|no supabase session access token/i, 'Your admin session has expired. Sign in again, then retry.'],
    [/failed to fetch|networkerror|load failed|network request failed/i, 'The request could not reach the server. Check your connection, then retry.'],
    [/supabase is not configured/i, 'The admin backend is not configured in this environment.'],
];

// Sentences raised by `raise exception` in supabase/migrations that are written
// for a person and name no internals.
const AUTHORED_SQL_MESSAGES = /^(unknown tier key|trip not found|user profile not found|username is reserved|version is required|trip limit reached|invalid ai default model id)\.?$/i;

// Our client services' own status lines ("Nearby airports request failed with
// 500."): a feature name and an HTTP status, nothing from the server body.
const SERVICE_STATUS_LINE = /^[a-z][a-z\s-]{2,60} request failed with \d{3}\.?$/i;

const readMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message.trim();
    if (typeof error === 'string') return error.trim();
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message.trim();
    }
    return '';
};

const asSentence = (text: string): string => {
    const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
    return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
};

export const toAdminErrorMessage = (error: unknown, fallback: string, scope = 'admin'): string => {
    if (error instanceof AdminUserFacingError && error.message.trim()) return error.message.trim();

    const message = readMessage(error);
    for (const [pattern, sentence] of KNOWN_FAILURES) {
        if (pattern.test(message)) return sentence;
    }
    if (AUTHORED_SQL_MESSAGES.test(message) || SERVICE_STATUS_LINE.test(message)) return asSentence(message);

    console.error(`[${scope}] ${fallback}`, error);
    return fallback;
};

/**
 * The benchmark endpoint's `error` is an authored sentence, but some failures
 * append the raw upstream body after "(status): ". Keep the authored part only.
 */
export const toBenchmarkApiErrorSentence = (error: string | undefined, status: number): string => {
    const authored = (error || '').split(/\)\s*:\s/)[0].trim();
    if (!authored) return `Benchmark API request failed (${status}).`;
    const closed = authored.includes('(') && !authored.includes(')') ? `${authored})` : authored;
    return /[.!?]$/.test(closed) ? closed : `${closed}.`;
};
