export const isInternalMapColorModeControlEnabled = (): boolean => {
    if (typeof window === 'undefined') return false;

    try {
        const params = new URLSearchParams(window.location.search);
        const queryToggle = params.get('internalMapColors') || params.get('internal');
        if (queryToggle === '1' || queryToggle?.toLowerCase() === 'true') return true;

        const storedToggle = window.localStorage.getItem('tf_internal_map_colors');
        if (storedToggle === '1' || storedToggle?.toLowerCase() === 'true' || storedToggle?.toLowerCase() === 'on') {
            return true;
        }
    } catch {
        // ignore malformed location/storage access
    }

    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
};
