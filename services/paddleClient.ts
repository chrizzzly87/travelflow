declare global {
    interface Window {
        Paddle?: {
            Initialize: (config: { token: string }) => void;
        };
    }
}

const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const PADDLE_SCRIPT_ID = 'tf-paddle-js';

let paddleScriptPromise: Promise<boolean> | null = null;
let initializedToken: string | null = null;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const readPaddleClientToken = (): string => String(import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '').trim();

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

export const initializePaddleJs = async (): Promise<boolean> => {
    const token = readPaddleClientToken();
    if (!token || !isBrowser()) return false;

    const scriptReady = await ensurePaddleScript();
    if (!scriptReady || !window.Paddle || typeof window.Paddle.Initialize !== 'function') {
        return false;
    }

    if (initializedToken === token) {
        return true;
    }

    try {
        window.Paddle.Initialize({ token });
        initializedToken = token;
        return true;
    } catch {
        return false;
    }
};

export const __paddleClientInternals = {
    ensurePaddleScript,
    readPaddleClientToken,
    resetForTest: () => {
        paddleScriptPromise = null;
        initializedToken = null;
    },
};
