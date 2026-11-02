/** Preserve existing flat URLSearchParams contracts, including repeated keys. */
export const parseRouteSearch = (search: string): Record<string, string | string[]> => {
    const output: Record<string, string | string[]> = Object.create(null);
    for (const [key, value] of new URLSearchParams(search)) {
        const previous = output[key];
        output[key] = previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value];
    }
    return output;
};
export const stringifyRouteSearch = (search: Record<string, unknown>): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
        if (value === undefined || value === null) continue;
        for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
    }
    const result = params.toString();
    return result ? `?${result}` : '';
};
