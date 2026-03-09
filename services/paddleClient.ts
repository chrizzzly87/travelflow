import type { AppLanguage } from '../types';

declare global {
    interface Window {
        Paddle?: {
            Environment?: {
                set: (environment: 'sandbox' | 'production') => void;
            };
            Checkout?: {
                open: (config: {
                    transactionId: string;
                    customer?: {
                        email?: string;
                    };
                }) => void;
            };
            Initialize: (config: {
                token: string;
                checkout?: {
                    settings?: PaddleCheckoutSettings;
                };
                eventCallback?: (event: PaddleCheckoutEvent) => void;
            }) => void;
        };
    }
}

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const PADDLE_SCRIPT_ID = 'tf-paddle-js';
const PADDLE_CONFIG_ENDPOINT = '/api/billing/paddle/config';
export const PADDLE_INLINE_FRAME_TARGET_CLASS = 'tf-paddle-inline-frame';

const PADDLE_CHECKOUT_TRANSACTION_QUERY_KEY = '_ptxn';
const PADDLE_CHECKOUT_TIER_QUERY_KEY = 'tier';
const PADDLE_CHECKOUT_SOURCE_QUERY_KEY = 'source';
const PADDLE_CHECKOUT_CLAIM_QUERY_KEY = 'claim';
const PADDLE_CHECKOUT_RETURN_QUERY_KEY = 'return_to';
const PADDLE_CHECKOUT_TRIP_QUERY_KEY = 'trip_id';
const DEFAULT_PADDLE_CHECKOUT_LOCALE = 'en';
const PADDLE_INLINE_FRAME_STYLE = [
    'width: 100%',
    'min-width: 312px',
    'background-color: transparent',
    'border: none',
].join('; ');
const PADDLE_LOCALE_MAP: Partial<Record<AppLanguage, string>> = {
    en: 'en',
    es: 'es',
    de: 'de',
    fr: 'fr',
    pt: 'pt',
    ru: 'ru',
    it: 'it',
    pl: 'pl',
    ko: 'ko',
};

let paddleScriptPromise: Promise<boolean> | null = null;
let initializedToken: string | null = null;
let initializedEnvironment: PaddleClientEnvironment | null = null;
let publicConfigPromise: Promise<PaddlePublicConfig> | null = null;
let latestPaddleEventCallback: ((event: PaddleCheckoutEvent) => void) | null = null;

export type PaddleClientEnvironment = 'sandbox' | 'live';
export type PaddleCheckoutTierKey = 'tier_mid' | 'tier_premium';

export interface PaddleCheckoutEvent {
    name?: string;
    data?: unknown;
}

export interface PaddleCheckoutSettings {
    allowLogout?: boolean;
    displayMode: 'inline';
    frameInitialHeight: string;
    frameStyle: string;
    frameTarget: string;
    locale: string;
    showAddDiscounts?: boolean;
    theme: 'light' | 'dark';
    variant: 'one-page' | 'multi-page';
}

export interface InitializePaddleJsOptions {
    environment?: PaddleClientEnvironment;
    eventCallback?: (event: PaddleCheckoutEvent) => void;
    locale?: AppLanguage | string | null;
}

export interface PaddleCheckoutLocationContext {
    tierKey: PaddleCheckoutTierKey | null;
    transactionId: string | null;
    source: string | null;
    claimId: string | null;
    returnTo: string | null;
    tripId: string | null;
}

export interface PaddleCheckoutUrlContext {
    tierKey: PaddleCheckoutTierKey;
    source?: string | null;
    claimId?: string | null;
    returnTo?: string | null;
    tripId?: string | null;
}

export interface PaddlePublicConfigIssue {
    code: 'api_key_environment_mismatch' | 'client_token_environment_mismatch';
    message: string;
}

export interface PaddlePublicConfig {
    provider: 'paddle';
    environment: PaddleClientEnvironment;
    checkoutEnabled: boolean;
    clientTokenConfigured: boolean;
    webhookSecretConfigured: boolean;
    supabaseSyncConfigured: boolean;
    webhookSyncMode: 'full' | 'verify_only';
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

const asTrimmedString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;

const asObject = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? value as Record<string, unknown> : null;

const asCheckoutTierKey = (value: unknown): PaddleCheckoutTierKey | null =>
    value === 'tier_mid' || value === 'tier_premium' ? value : null;

const resolvePaddleCheckoutLocale = (locale: AppLanguage | string | null | undefined): string => {
    if (!locale || typeof locale !== 'string') return DEFAULT_PADDLE_CHECKOUT_LOCALE;
    const normalized = locale.trim().toLowerCase().split(/[-_]/)[0] as AppLanguage;
    return PADDLE_LOCALE_MAP[normalized] || DEFAULT_PADDLE_CHECKOUT_LOCALE;
};

const buildInlineCheckoutSettings = (locale: AppLanguage | string | null | undefined): PaddleCheckoutSettings => ({
    allowLogout: false,
    displayMode: 'inline',
    frameInitialHeight: '640',
    frameStyle: PADDLE_INLINE_FRAME_STYLE,
    frameTarget: PADDLE_INLINE_FRAME_TARGET_CLASS,
    locale: resolvePaddleCheckoutLocale(locale),
    showAddDiscounts: false,
    theme: 'light',
    variant: 'one-page',
});

const dispatchPaddleEvent = (event: PaddleCheckoutEvent) => {
    latestPaddleEventCallback?.(event);
};

const parsePaddlePublicConfig = (payload: unknown): PaddlePublicConfig | null => {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as {
        provider?: unknown;
        environment?: unknown;
        checkoutEnabled?: unknown;
        clientTokenConfigured?: unknown;
        webhookSecretConfigured?: unknown;
        supabaseSyncConfigured?: unknown;
        webhookSyncMode?: unknown;
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
        webhookSecretConfigured: asBoolean(data.webhookSecretConfigured),
        supabaseSyncConfigured: asBoolean(data.supabaseSyncConfigured),
        webhookSyncMode: data.webhookSyncMode === 'verify_only' ? 'verify_only' : 'full',
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

export const readPaddleCheckoutLocationContext = (search: string): PaddleCheckoutLocationContext => {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return {
        tierKey: asCheckoutTierKey(params.get(PADDLE_CHECKOUT_TIER_QUERY_KEY)),
        transactionId: asTrimmedString(params.get(PADDLE_CHECKOUT_TRANSACTION_QUERY_KEY)),
        source: asTrimmedString(params.get(PADDLE_CHECKOUT_SOURCE_QUERY_KEY)),
        claimId: asTrimmedString(params.get(PADDLE_CHECKOUT_CLAIM_QUERY_KEY)),
        returnTo: asTrimmedString(params.get(PADDLE_CHECKOUT_RETURN_QUERY_KEY)),
        tripId: asTrimmedString(params.get(PADDLE_CHECKOUT_TRIP_QUERY_KEY)),
    };
};

export const appendPaddleCheckoutContext = (
    checkoutUrl: string,
    context: PaddleCheckoutUrlContext
): string => {
    const trimmedUrl = checkoutUrl.trim();
    if (!trimmedUrl) return checkoutUrl;

    try {
        const fallbackBase = isBrowser() ? window.location.origin : 'https://travelflow.invalid';
        const parsed = new URL(trimmedUrl, fallbackBase);
        parsed.searchParams.set(PADDLE_CHECKOUT_TIER_QUERY_KEY, context.tierKey);
        if (asTrimmedString(context.source)) {
            parsed.searchParams.set(PADDLE_CHECKOUT_SOURCE_QUERY_KEY, context.source!.trim());
        }
        if (asTrimmedString(context.claimId)) {
            parsed.searchParams.set(PADDLE_CHECKOUT_CLAIM_QUERY_KEY, context.claimId!.trim());
        }
        if (asTrimmedString(context.returnTo)) {
            parsed.searchParams.set(PADDLE_CHECKOUT_RETURN_QUERY_KEY, context.returnTo!.trim());
        }
        if (asTrimmedString(context.tripId)) {
            parsed.searchParams.set(PADDLE_CHECKOUT_TRIP_QUERY_KEY, context.tripId!.trim());
        }
        return parsed.toString();
    } catch {
        return checkoutUrl;
    }
};

export const navigateToPaddleCheckout = (checkoutUrl: string): void => {
    if (!isBrowser()) return;
    window.location.assign(checkoutUrl);
};

export const resolveSameOriginPaddleCheckoutPath = (checkoutUrl: string): string | null => {
    if (!isBrowser()) return null;
    const trimmedUrl = checkoutUrl.trim();
    if (!trimmedUrl) return null;

    try {
        const parsed = new URL(trimmedUrl, window.location.origin);
        if (parsed.origin !== window.location.origin) return null;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return null;
    }
};

export const extractPaddleCheckoutItemName = (event: PaddleCheckoutEvent | null | undefined): string | null => {
    const data = asObject(event?.data);
    const items = Array.isArray(data?.items) ? data.items : [];
    const firstItem = asObject(items[0]);
    return asTrimmedString(firstItem?.price_name) || asTrimmedString(asObject(firstItem?.product)?.name);
};

export const initializePaddleJs = async ({
    environment = 'live',
    eventCallback,
    locale,
}: InitializePaddleJsOptions = {}): Promise<boolean> => {
    const token = readPaddleClientToken();
    const checkoutLocale = resolvePaddleCheckoutLocale(locale);
    if (!token || !isBrowser()) return false;
    latestPaddleEventCallback = eventCallback || null;

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
        window.Paddle.Initialize({
            token,
            checkout: {
                settings: buildInlineCheckoutSettings(checkoutLocale),
            },
            eventCallback: dispatchPaddleEvent,
        });
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
    appendPaddleCheckoutContext,
    buildInlineCheckoutSettings,
    extractPaddleCheckoutItemName,
    ensurePaddleScript,
    parsePaddlePublicConfig,
    readPaddleClientToken,
    readPaddleCheckoutLocationContext,
    resolveSameOriginPaddleCheckoutPath,
    resolvePaddleCheckoutLocale,
    resetForTest: () => {
        paddleScriptPromise = null;
        initializedToken = null;
        initializedEnvironment = null;
        publicConfigPromise = null;
        latestPaddleEventCallback = null;
    },
};
