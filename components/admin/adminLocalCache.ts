export const readAdminCache = <T>(key: string, fallbackValue: T): T => {
    if (typeof window === 'undefined') return fallbackValue;
    try {
        const rawValue = window.localStorage.getItem(key);
        if (!rawValue) return fallbackValue;
        return JSON.parse(rawValue) as T;
    } catch {
        return fallbackValue;
    }
};

export const writeAdminCache = (key: string, value: unknown): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore cache write errors (quota/private mode), UI still works from live fetches
    }
};
