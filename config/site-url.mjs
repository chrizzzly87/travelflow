export const DEFAULT_SITE_URL = 'https://travelflowapp.netlify.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

export const normalizeSiteUrl = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
};

export const isLocalSiteUrl = (value) => {
    const normalized = normalizeSiteUrl(value);
    if (!normalized) return false;
    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();
        return LOCAL_HOSTS.has(host) || host.endsWith('.local');
    } catch {
        return true;
    }
};

export const resolveSiteUrl = (env = process.env) => {
    const fromEnv = normalizeSiteUrl(env.SITE_URL || env.VITE_SITE_URL);
    if (fromEnv) return fromEnv;
    return normalizeSiteUrl(DEFAULT_SITE_URL);
};

export const resolvePublicSiteUrl = (env = process.env, browserOrigin = '') => {
    const fromEnv = normalizeSiteUrl(env.SITE_URL || env.VITE_SITE_URL);
    if (fromEnv && !isLocalSiteUrl(fromEnv)) return fromEnv;

    const fromBrowser = normalizeSiteUrl(browserOrigin);
    if (fromBrowser && !isLocalSiteUrl(fromBrowser)) return fromBrowser;

    return normalizeSiteUrl(DEFAULT_SITE_URL);
};
