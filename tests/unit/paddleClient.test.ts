// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __paddleClientInternals,
  fetchPaddlePublicConfig,
  initializePaddleJs,
  isPaddleClientConfigured,
  isPaddleTierCheckoutConfigured,
} from '../../services/paddleClient';

const ORIGINAL_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

describe('paddleClient', () => {
  beforeEach(() => {
    __paddleClientInternals.resetForTest();
    document.head.innerHTML = '';
    delete window.Paddle;
    import.meta.env.VITE_PADDLE_CLIENT_TOKEN = 'test_client_token';
  });

  afterEach(() => {
    __paddleClientInternals.resetForTest();
    document.head.innerHTML = '';
    delete window.Paddle;
    import.meta.env.VITE_PADDLE_CLIENT_TOKEN = ORIGINAL_TOKEN;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('detects when a client token is configured', () => {
    expect(isPaddleClientConfigured()).toBe(true);
    import.meta.env.VITE_PADDLE_CLIENT_TOKEN = '';
    expect(isPaddleClientConfigured()).toBe(false);
  });

  it('initializes Paddle.js once when Paddle is already available', async () => {
    const initialize = vi.fn();
    const setEnvironment = vi.fn();
    window.Paddle = { Initialize: initialize, Environment: { set: setEnvironment } };

    await expect(initializePaddleJs('sandbox')).resolves.toBe(true);
    await expect(initializePaddleJs('sandbox')).resolves.toBe(true);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith({ token: 'test_client_token' });
    expect(setEnvironment).toHaveBeenCalledWith('sandbox');
  });

  it('injects the Paddle.js script tag when Paddle is not already available', async () => {
    const appendedScripts: HTMLScriptElement[] = [];
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLScriptElement) {
        appendedScripts.push(node);
      }
      return node;
    });

    const initPromise = initializePaddleJs();

    expect(appendedScripts).toHaveLength(1);
    expect(appendedScripts[0]?.src).toBe('https://cdn.paddle.com/paddle/v2/paddle.js');

    window.Paddle = { Initialize: vi.fn(), Environment: { set: vi.fn() } };
    appendedScripts[0]?.dispatchEvent(new Event('load'));

    await expect(initPromise).resolves.toBe(true);
    appendSpy.mockRestore();
  });

  it('loads and caches the public Paddle config payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        data: {
          provider: 'paddle',
          environment: 'sandbox',
          checkoutEnabled: true,
          clientTokenConfigured: true,
          tierAvailability: {
            tier_mid: true,
            tier_premium: false,
          },
          issues: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchPaddlePublicConfig();
    const second = await fetchPaddlePublicConfig();

    expect(first).toEqual({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: false,
      },
      issues: [],
    });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isPaddleTierCheckoutConfigured(first, 'tier_mid')).toBe(true);
    expect(isPaddleTierCheckoutConfigured(first, 'tier_premium')).toBe(false);
  });

  it('treats config issues as blocking for tier checkout availability', () => {
    const parsed = __paddleClientInternals.parsePaddlePublicConfig({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      tierAvailability: {
        tier_mid: true,
        tier_premium: true,
      },
      issues: [
        {
          code: 'api_key_environment_mismatch',
          message: 'Use a sandbox API key.',
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(isPaddleTierCheckoutConfigured(parsed, 'tier_mid')).toBe(false);
  });
});
