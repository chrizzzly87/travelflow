declare global {
    interface Window {
        Paddle?: {
            Environment?: {
                set: (environment: 'sandbox' | 'production') => void;
            };
            Initialize: (config: { token: string }) => void;
        };
    }
}

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const PADDLE_SCRIPT_ID = 'tf-paddle-js';
const PADDLE_CONFIG_ENDPOINT = '/api/billing/paddle/config';

let paddleScriptPromise: Promise<boolean> | null = null;
let initializedToken: string | null = null;
let initializedEnvironment: PaddleClientEnvironment | null = null;
let publicConfigPromise: Promise<PaddlePublicConfig> | null = null;

export type PaddleClientEnvironment = 'sandbox' | 'live';

export interface PaddlePublicConfigIssue {
    code: 'api_key_environment_mismatch' | 'client_token_environment_mismatch';
    message: string;
}

export interface PaddlePublicConfig {
    provider: 'paddle';
    environment: PaddleClientEnvironment;
    checkoutEnabled: boolean;
    clientTokenConfigured: boolean;
    tierAvailability: {
        tier_mid: boolean;
        tier_premium: boolean;
    };
    issues: PaddlePublicConfigIssue[];
}

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const readPaddleClientToken = (): string => String(import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '').trim();

const normalizePaddleEnvironment = (value: unknown): PaddleClientEnvironment =>
    value === 'sandbox' ? 'sandbox' : 'live';

const asBoolean = (value: unknown): boolean => value === true;

const parsePaddlePublicConfig = (payload: unknown): PaddlePublicConfig | null => {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as {
        provider?: unknown;
        environment?: unknown;
        checkoutEnabled?: unknown;
        clientTokenConfigured?: unknown;
        tierAvailability?: unknown;
        issues?: unknown;
    };
    const tierAvailability = data.tierAvailability && typeof data.tierAvailability === 'object'
        ? data.tierAvailability as { tier_mid?: unknown; tier_premium?: unknown }
        : null;
    const issues = Array.isArray(data.issues)
        ? data.issues
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const issue = entry as { code?: unknown; message?: unknown };
                return typeof issue.code === 'string' && typeof issue.message === 'string'
                    ? {
                        code: issue.code as PaddlePublicConfigIssue['code'],
                        message: issue.message,
                    }
                    : null;
            })
            .filter((entry): entry is PaddlePublicConfigIssue => Boolean(entry))
        : [];

    if (data.provider !== 'paddle') return null;

    return {
        provider: 'paddle',
        environment: normalizePaddleEnvironment(data.environment),
        checkoutEnabled: asBoolean(data.checkoutEnabled),
        clientTokenConfigured: asBoolean(data.clientTokenConfigured),
        tierAvailability: {
            tier_mid: asBoolean(tierAvailability?.tier_mid),
            tier_premium: asBoolean(tierAvailability?.tier_premium),
        },
        issues,
    };
};

const createScriptLoadPromise = (script: HTMLScriptElement) =>
    new Promise<boolean>((resolve) => {
        const onLoad = () => resolve(true);
        const onError = () => resolve(false);
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
    });

const ensurePaddleScript = async (): Promise<boolean> => {
    if (!isBrowser()) return false;
    if (window.Paddle && typeof window.Paddle.Initialize === 'function') return true;

    const existingScript = document.getElementById(PADDLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
        if (existingScript.dataset.loaded === 'true') return true;
        if (!paddleScriptPromise) {
            paddleScriptPromise = createScriptLoadPromise(existingScript);
        }
        return paddleScriptPromise;
    }

    const script = document.createElement('script');
    script.id = PADDLE_SCRIPT_ID;
    script.src = PADDLE_JS_URL;
    script.async = true;
    script.defer = true;
    script.dataset.loaded = 'false';
    script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
    }, { once: true });

    paddleScriptPromise = createScriptLoadPromise(script);
    document.head.appendChild(script);
    return paddleScriptPromise;
};

export const isPaddleClientConfigured = (): boolean => Boolean(readPaddleClientToken());

export const initializePaddleJs = async (environment: PaddleClientEnvironment = 'live'): Promise<boolean> => {
    const token = readPaddleClientToken();
    if (!token || !isBrowser()) return false;

    const scriptReady = await ensurePaddleScript();
    if (!scriptReady || !window.Paddle || typeof window.Paddle.Initialize !== 'function') {
        return false;
    }

    if (
        window.Paddle.Environment
        && typeof window.Paddle.Environment.set === 'function'
        && initializedEnvironment !== environment
    ) {
        window.Paddle.Environment.set(environment === 'sandbox' ? 'sandbox' : 'production');
    }

    if (initializedToken === token && initializedEnvironment === environment) {
        return true;
    }

    try {
        window.Paddle.Initialize({ token });
        initializedToken = token;
        initializedEnvironment = environment;
        return true;
    } catch {
        return false;
    }
};

export const fetchPaddlePublicConfig = async (): Promise<PaddlePublicConfig> => {
    if (!isBrowser()) {
        throw new Error('Paddle public config is only available in the browser.');
    }

    if (!publicConfigPromise) {
        publicConfigPromise = fetch(PADDLE_CONFIG_ENDPOINT, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(async (response) => {
                const text = await response.text().catch(() => '');
                const payload = text ? JSON.parse(text) as { data?: unknown; error?: unknown } : {};
                const parsed = parsePaddlePublicConfig(payload?.data);
                if (!response.ok || !parsed) {
                    const message = typeof payload?.error === 'string'
                        ? payload.error
                        : 'Failed to load Paddle public config.';
                    throw new Error(message);
                }
                return parsed;
            })
            .catch((error) => {
                publicConfigPromise = null;
                throw error;
            });
    }

    return publicConfigPromise;
};

export const isPaddleTierCheckoutConfigured = (
    config: PaddlePublicConfig | null,
    tierKey: 'tier_mid' | 'tier_premium'
): boolean => {
    if (!config) return false;
    if (!config.checkoutEnabled || !config.clientTokenConfigured) return false;
    if (config.issues.length > 0) return false;
    return tierKey === 'tier_mid'
        ? config.tierAvailability.tier_mid
        : config.tierAvailability.tier_premium;
};

export const __paddleClientInternals = {
    ensurePaddleScript,
    parsePaddlePublicConfig,
    readPaddleClientToken,
    resetForTest: () => {
        paddleScriptPromise = null;
        initializedToken = null;
        initializedEnvironment = null;
        publicConfigPromise = null;
    },
};
