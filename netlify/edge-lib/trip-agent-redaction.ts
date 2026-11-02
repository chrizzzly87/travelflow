/**
 * Redaction for everything the Trip Agent writes outside the request: logs, run
 * records, and the little that reaches the browser.
 *
 * Provider and database errors quote URLs, keys, tokens and prompt fragments.
 * None of that may reach a log line, a stored run, or a client payload, so
 * every diagnostic string passes through here first.
 */

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // Bearer tokens, API keys and JWTs, including the query-string forms.
    { pattern: /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}/g, replacement: '[redacted-key]' },
    // Any base64 JSON blob: a real JWT header segment can be short.
    { pattern: /\beyJ[A-Za-z0-9_.-]{8,}/g, replacement: '[redacted-token]' },
    { pattern: /\bBearer\s+[A-Za-z0-9._-]{8,}/gi, replacement: 'Bearer [redacted]' },
    { pattern: /\bAIza[0-9A-Za-z_-]{10,}/g, replacement: '[redacted-key]' },
    { pattern: /([?&](?:api[_-]?key|apikey|key|token|access_token|password)=)[^&\s]+/gi, replacement: '$1[redacted]' },
    { pattern: /("(?:api[_-]?key|apikey|authorization|token|password|secret)"\s*:\s*")[^"]+/gi, replacement: '$1[redacted]' },
    // Absolute URLs can carry project ids and signed paths.
    { pattern: /https?:\/\/[^\s"']+/g, replacement: '[redacted-url]' },
    // Long opaque blobs are never useful in a log line.
    { pattern: /\b[A-Za-z0-9_-]{40,}\b/g, replacement: '[redacted]' },
];

const MAX_DIAGNOSTIC_CHARS = 300;

/** Strips secrets and bounds the length of one diagnostic string. */
export const redactDiagnostic = (value: unknown): string => {
    const raw = value instanceof Error
        ? value.message
        : typeof value === 'string' ? value : '';
    if (!raw) return '';
    const redacted = SECRET_PATTERNS.reduce(
        (text, { pattern, replacement }) => text.replace(pattern, replacement),
        raw,
    );
    return redacted.slice(0, MAX_DIAGNOSTIC_CHARS);
};

/** Error name for a log line, never the message. */
export const errorName = (error: unknown): string => (
    error instanceof Error ? error.name || 'Error' : 'UnknownError'
);
