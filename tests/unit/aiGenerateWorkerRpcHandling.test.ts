import { describe, expect, it } from 'vitest';
import { extractRpcErrorMessage } from '../../netlify/edge-functions/ai-generate-worker.ts';

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
});
