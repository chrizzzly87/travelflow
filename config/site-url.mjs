export const DEFAULT_SITE_URL = 'https://travelflowapp.netlify.app';

export const normalizeSiteUrl = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
};

export const resolveSiteUrl = (env = process.env) => {
    const fromEnv = normalizeSiteUrl(env.SITE_URL || env.VITE_SITE_URL);
    if (fromEnv) return fromEnv;
    return normalizeSiteUrl(DEFAULT_SITE_URL);
};
