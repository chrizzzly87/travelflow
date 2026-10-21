import { describe, expect, it } from 'vitest';

import { errorName, redactDiagnostic } from '../../netlify/edge-lib/trip-agent-redaction.ts';
import { classifyTripAgentFailure } from '../../netlify/edge-lib/trip-agent-handler.ts';
import { withoutReasoningParts } from '../../netlify/edge-lib/trip-agent-runtime.ts';
import type { TripAgentMessage } from '../../shared/tripAgent';

describe('redactDiagnostic', () => {
    it('removes api keys, bearer tokens and jwts', () => {
        const redacted = redactDiagnostic(new Error(
            'call failed: key sk-abcdefgh12345678 Bearer abcdef123456 eyJhbGciOi.eyJzdWIiOiIxMjM0.SflKxwRJSM',
        ));

        expect(redacted).not.toContain('sk-abcdefgh12345678');
        expect(redacted).not.toContain('eyJhbGciOi');
        expect(redacted).toContain('[redacted');
    });

    it('removes urls and key query parameters', () => {
        const redacted = redactDiagnostic('POST https://project.supabase.co/rest/v1/x?apikey=supersecretvalue failed');

        expect(redacted).not.toContain('project.supabase.co');
        expect(redacted).not.toContain('supersecretvalue');
    });

    it('bounds the length so a provider dump cannot fill a log line', () => {
        expect(redactDiagnostic(new Error('x'.repeat(5_000))).length).toBeLessThanOrEqual(300);
    });

    it('names the error type without quoting its message', () => {
        expect(errorName(new TypeError('secret detail'))).toBe('TypeError');
        expect(errorName('not an error')).toBe('UnknownError');
    });
});

describe('classifyTripAgentFailure', () => {
    it('answers with a code and an authored sentence, never the raw message', () => {
        const failure = classifyTripAgentFailure(new Error('TRIP_AGENT_STALE_PROPOSAL at line 42 of rpc'));

        expect(failure.code).toBe('TRIP_AGENT_PROPOSAL_STALE');
        expect(failure.error).toBe('This proposal is based on an older trip version.');
        expect(failure.error).not.toContain('rpc');
    });

    it('falls back to a generic failure for an unrecognised error', () => {
        const failure = classifyTripAgentFailure(new Error('connect ECONNREFUSED 10.0.0.1:5432'));

        expect(failure.code).toBe('TRIP_AGENT_REQUEST_FAILED');
        expect(failure.error).not.toContain('10.0.0.1');
    });
});

describe('withoutReasoningParts', () => {
    it('strips reasoning before a message is stored', () => {
        const message = {
            id: 'm1',
            role: 'assistant',
            parts: [
                { type: 'reasoning', text: 'private chain of thought' },
                { type: 'text', text: 'Here is the plan.' },
                { type: 'reasoning', text: 'more private thinking' },
            ],
        } as unknown as TripAgentMessage;

        const stored = withoutReasoningParts(message);

        expect(stored.parts.map((part) => part.type)).toEqual(['text']);
    });

    it('returns the same message when there is nothing to strip', () => {
        const message = {
            id: 'm2',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Plain answer.' }],
        } as unknown as TripAgentMessage;

        expect(withoutReasoningParts(message)).toBe(message);
    });
});
