import { afterEach, describe, expect, it, vi } from 'vitest';
import { toBenchmarkApiErrorSentence } from '../../services/adminErrorMessages';
import {
    BENCHMARK_API_UNAVAILABLE_MESSAGE,
    requestBenchmarkApi,
} from '../../components/admin/ai-benchmark/aiBenchmarkApi';

const respond = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }));

describe('requestBenchmarkApi', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('refuses to call without a token', async () => {
        await expect(requestBenchmarkApi(null, '/api/internal/ai/benchmark')).rejects.toThrow(
            'No Supabase session access token found. Refresh and try again.',
        );
    });

    it('sends the bearer token and JSON content type, and returns the parsed body', async () => {
        const fetchMock = respond(JSON.stringify({ ok: true, cancelled: 2 }));
        vi.stubGlobal('fetch', fetchMock);
        const payload = await requestBenchmarkApi('tok', '/api/internal/ai/benchmark/cancel', { method: 'POST', body: '{}' });
        expect(payload).toEqual({ ok: true, cancelled: 2 });
        const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.get('Authorization')).toBe('Bearer tok');
        expect(headers.get('Content-Type')).toBe('application/json');
        expect(init.method).toBe('POST');
    });

    it('treats an empty or non-JSON success body as { ok }', async () => {
        vi.stubGlobal('fetch', respond(''));
        await expect(requestBenchmarkApi('tok', '/api/internal/ai/benchmark')).resolves.toEqual({ ok: true });
        vi.stubGlobal('fetch', respond('<html>gateway</html>'));
        await expect(requestBenchmarkApi('tok', '/api/internal/ai/benchmark')).resolves.toEqual({ ok: true });
    });

    it('explains a missing local benchmark API', async () => {
        vi.stubGlobal('fetch', respond('<html>Not found</html>', 404));
        await expect(requestBenchmarkApi('tok', '/api/internal/ai/benchmark/models')).rejects.toThrow(BENCHMARK_API_UNAVAILABLE_MESSAGE);
    });

    it('turns other failures into the authored sentence for the error code', async () => {
        vi.stubGlobal('fetch', respond(JSON.stringify({ ok: false, error: 'forbidden' }), 403));
        await expect(requestBenchmarkApi('tok', '/api/internal/ai/benchmark')).rejects.toThrow(toBenchmarkApiErrorSentence('forbidden', 403));
        vi.stubGlobal('fetch', respond('gateway timeout', 504));
        await expect(requestBenchmarkApi('tok', '/api/internal/ai/benchmark')).rejects.toThrow(toBenchmarkApiErrorSentence(undefined, 504));
    });
});
