import { describe, expect, it } from 'vitest';
import {
    decideSupersededByAttemptOrdering,
    extractRpcErrorMessage,
} from '../../netlify/edge-functions/ai-generate-worker.ts';

describe('ai-generate-worker RPC error parsing', () => {
    it('uses `message` payload field when present', async () => {
        const response = new Response(JSON.stringify({
            message: 'Trip not found',
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await extractRpcErrorMessage(response, 'fallback');
        expect(result).toBe('Trip not found');
    });

    it('uses `error` payload field when message is missing', async () => {
        const response = new Response(JSON.stringify({
            error: 'Could not choose function candidate',
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await extractRpcErrorMessage(response, 'fallback');
        expect(result).toBe('Could not choose function candidate');
    });

    it('falls back when the payload is not parseable JSON', async () => {
        const response = new Response('plain text error', {
            status: 502,
            headers: {
                'Content-Type': 'text/plain',
            },
        });

        const result = await extractRpcErrorMessage(response, 'fallback');
        expect(result).toBe('fallback');
    });

    it('keeps payload attempt when payload is in-flight and latest attempt is terminal', () => {
        const result = decideSupersededByAttemptOrdering({
            payloadState: 'queued',
            latestState: 'failed',
            payloadStartedAt: '2026-03-06T15:35:27.460Z',
            latestStartedAt: '2026-03-06T11:46:37.312Z',
        });
        expect(result).toBe(false);
    });

    it('marks payload attempt as superseded when latest in-flight attempt is newer', () => {
        const result = decideSupersededByAttemptOrdering({
            payloadState: 'queued',
            latestState: 'running',
            payloadStartedAt: '2026-03-06T11:46:37.312Z',
            latestStartedAt: '2026-03-06T15:35:27.460Z',
        });
        expect(result).toBe(true);
    });
});
