import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenBucketRateLimiter,
  DEFAULT_MAX_PROMPT_CHARS,
  getBearerToken,
  resolveClientIp,
  resolveMaxPromptChars,
  validateGenerateInput,
  verifySupabaseUser,
} from '../../netlify/edge-lib/ai-generate-guard.ts';

const stubDenoEnv = (values: Record<string, string | undefined>) => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => values[key],
    },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateGenerateInput', () => {
  it('rejects a missing prompt with the legacy error message', () => {
    const result = validateGenerateInput({ prompt: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
      expect(result.failure.code).toBe('PROMPT_REQUIRED');
      expect(result.failure.error).toBe('Missing required field: prompt');
    }
  });

  it('rejects oversized prompts with 413 PROMPT_TOO_LONG', () => {
    const result = validateGenerateInput({ prompt: 'x'.repeat(DEFAULT_MAX_PROMPT_CHARS + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(413);
      expect(result.failure.code).toBe('PROMPT_TOO_LONG');
    }
  });

  it('accepts a prompt at exactly the cap', () => {
    const result = validateGenerateInput({ prompt: 'x'.repeat(DEFAULT_MAX_PROMPT_CHARS) });
    expect(result.ok).toBe(true);
  });

  it('defaults to gemini and the default model when no target is provided', () => {
    const result = validateGenerateInput({ prompt: 'Trip to Japan' });
    expect(result).toMatchObject({
      ok: true,
      value: { provider: 'gemini', model: 'gemini-3-pro-preview' },
    });
  });

  it('rejects unknown providers', () => {
    const result = validateGenerateInput({
      prompt: 'Trip to Japan',
      target: { provider: 'evilcorp', model: 'anything' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
      expect(result.failure.code).toBe('PROVIDER_NOT_SUPPORTED');
    }
  });

  it('rejects arbitrary model strings for a supported provider', () => {
    const result = validateGenerateInput({
      prompt: 'Trip to Japan',
      target: { provider: 'openai', model: 'gpt-experimental-unlimited' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
      expect(result.failure.code).toBe('MODEL_NOT_ALLOWED');
    }
  });

  it('accepts allowlisted provider/model targets and normalizes the provider case', () => {
    const result = validateGenerateInput({
      prompt: 'Trip to Japan',
      target: { provider: 'Anthropic', model: 'claude-haiku-4.5' },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { provider: 'anthropic', model: 'claude-haiku-4.5' },
    });
  });
});

describe('resolveMaxPromptChars', () => {
  it('uses the default when no env override is set', () => {
    stubDenoEnv({});
    expect(resolveMaxPromptChars()).toBe(DEFAULT_MAX_PROMPT_CHARS);
  });

  it('clamps env overrides into the sane range', () => {
    stubDenoEnv({ AI_GENERATE_MAX_PROMPT_CHARS: '10' });
    expect(resolveMaxPromptChars()).toBe(4_000);
    stubDenoEnv({ AI_GENERATE_MAX_PROMPT_CHARS: '9999999' });
    expect(resolveMaxPromptChars()).toBe(120_000);
    stubDenoEnv({ AI_GENERATE_MAX_PROMPT_CHARS: '30000' });
    expect(resolveMaxPromptChars()).toBe(30_000);
  });
});

describe('createTokenBucketRateLimiter', () => {
  it('allows a burst up to capacity and then blocks', () => {
    const limiter = createTokenBucketRateLimiter({ capacity: 3, refillPerMinute: 3 });
    const now = 1_000_000;
    expect(limiter.take('ip:1.2.3.4', now).allowed).toBe(true);
    expect(limiter.take('ip:1.2.3.4', now).allowed).toBe(true);
    expect(limiter.take('ip:1.2.3.4', now).allowed).toBe(true);
    const blocked = limiter.take('ip:1.2.3.4', now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    const limiter = createTokenBucketRateLimiter({ capacity: 1, refillPerMinute: 1 });
    const now = 1_000_000;
    expect(limiter.take('ip:a', now).allowed).toBe(true);
    expect(limiter.take('ip:a', now).allowed).toBe(false);
    expect(limiter.take('ip:b', now).allowed).toBe(true);
  });

  it('refills tokens over time', () => {
    const limiter = createTokenBucketRateLimiter({ capacity: 1, refillPerMinute: 6 });
    const now = 1_000_000;
    expect(limiter.take('user:u1', now).allowed).toBe(true);
    expect(limiter.take('user:u1', now + 1_000).allowed).toBe(false);
    // 6 tokens per minute → one token every 10s.
    expect(limiter.take('user:u1', now + 11_000).allowed).toBe(true);
  });

  it('never exceeds capacity after a long idle period', () => {
    const limiter = createTokenBucketRateLimiter({ capacity: 2, refillPerMinute: 60 });
    const now = 1_000_000;
    expect(limiter.take('k', now).allowed).toBe(true);
    const later = now + 60 * 60 * 1_000;
    expect(limiter.take('k', later).allowed).toBe(true);
    expect(limiter.take('k', later).allowed).toBe(true);
    expect(limiter.take('k', later).allowed).toBe(false);
  });
});

describe('resolveClientIp', () => {
  it('prefers the Netlify context ip', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-nf-client-connection-ip': '9.9.9.9' },
    });
    expect(resolveClientIp(request, { ip: '1.1.1.1' })).toBe('1.1.1.1');
  });

  it('falls back to the Netlify header, then x-forwarded-for, then unknown', () => {
    const withHeader = new Request('https://example.com', {
      headers: { 'x-nf-client-connection-ip': '9.9.9.9' },
    });
    expect(resolveClientIp(withHeader)).toBe('9.9.9.9');

    const withForwarded = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '8.8.8.8, 7.7.7.7' },
    });
    expect(resolveClientIp(withForwarded)).toBe('8.8.8.8');

    expect(resolveClientIp(new Request('https://example.com'))).toBe('unknown');
  });
});

describe('getBearerToken', () => {
  it('extracts a bearer token case-insensitively', () => {
    const request = new Request('https://example.com', {
      headers: { Authorization: 'bearer abc.def.ghi' },
    });
    expect(getBearerToken(request)).toBe('abc.def.ghi');
  });

  it('returns null for missing or malformed headers', () => {
    expect(getBearerToken(new Request('https://example.com'))).toBeNull();
    const malformed = new Request('https://example.com', {
      headers: { Authorization: 'Token abc' },
    });
    expect(getBearerToken(malformed)).toBeNull();
  });
});

describe('verifySupabaseUser', () => {
  beforeEach(() => {
    stubDenoEnv({
      VITE_SUPABASE_URL: 'https://supabase.example',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    });
  });

  it('returns the user id and anonymous flag for a valid token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-123',
      is_anonymous: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await verifySupabaseUser('valid-token', fetchMock as typeof fetch);
    expect(result).toEqual({ ok: true, userId: 'user-123', isAnonymous: true });
    expect(fetchMock).toHaveBeenCalledWith('https://supabase.example/auth/v1/user', expect.objectContaining({
      headers: expect.objectContaining({
        apikey: 'anon-key',
        Authorization: 'Bearer valid-token',
      }),
    }));
  });

  it('marks rejected tokens as invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    const result = await verifySupabaseUser('expired-token', fetchMock as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('degrades to unavailable when Supabase config is missing', async () => {
    stubDenoEnv({});
    const fetchMock = vi.fn();
    const result = await verifySupabaseUser('any-token', fetchMock as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades to unavailable on network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await verifySupabaseUser('any-token', fetchMock as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });
});
