export type TripWorkspacePresentation = 'classic' | 'overview' | 'schedule';

const MODULAR_WORKSPACE_PRESENTATIONS = new Set<TripWorkspacePresentation>(['overview', 'schedule']);

export const readTripWorkspacePresentation = (search: string): TripWorkspacePresentation => {
    const params = new URLSearchParams(search);
    const requestedPresentation = params.get('workspace');
    return MODULAR_WORKSPACE_PRESENTATIONS.has(requestedPresentation as TripWorkspacePresentation)
        ? requestedPresentation as TripWorkspacePresentation
        : 'classic';
};

export const buildTripWorkspaceSearch = (
    search: string,
    presentation: TripWorkspacePresentation,
): string => {
    const params = new URLSearchParams(search);
    if (presentation === 'classic') {
        params.delete('workspace');
    } else {
        params.set('workspace', presentation);
    }

    const nextSearch = params.toString();
    return nextSearch ? `?${nextSearch}` : '';
};
