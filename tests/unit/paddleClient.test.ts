// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __paddleClientInternals, initializePaddleJs, isPaddleClientConfigured } from '../../services/paddleClient';

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
  });

  it('detects when a client token is configured', () => {
    expect(isPaddleClientConfigured()).toBe(true);
    import.meta.env.VITE_PADDLE_CLIENT_TOKEN = '';
    expect(isPaddleClientConfigured()).toBe(false);
  });

  it('initializes Paddle.js once when Paddle is already available', async () => {
    const initialize = vi.fn();
    window.Paddle = { Initialize: initialize };

    await expect(initializePaddleJs()).resolves.toBe(true);
    await expect(initializePaddleJs()).resolves.toBe(true);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith({ token: 'test_client_token' });
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

    window.Paddle = { Initialize: vi.fn() };
    appendedScripts[0]?.dispatchEvent(new Event('load'));

    await expect(initPromise).resolves.toBe(true);
    appendSpy.mockRestore();
  });
});
