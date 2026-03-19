import type { TripWorkspacePage } from '../types';

export const DEFAULT_TRIP_WORKSPACE_PAGE: TripWorkspacePage = 'overview';

export const TRIP_WORKSPACE_PAGES: TripWorkspacePage[] = [
    'overview',
    'planner',
    'bookings',
    'places',
    'explore',
    'phrases',
    'notes',
    'photos',
];

export type TripWorkspaceRouteKind = 'trip' | 'example' | 'share';

export interface TripWorkspaceRouteState {
    kind: TripWorkspaceRouteKind | null;
    basePath: string | null;
    page: TripWorkspacePage | null;
    hasExplicitPage: boolean;
}

export const normalizeTripWorkspacePage = (value?: string | null): TripWorkspacePage | null => {
    if (!value) return null;
    if (TRIP_WORKSPACE_PAGES.includes(value as TripWorkspacePage)) {
        return value as TripWorkspacePage;
    }

    switch (value) {
        case 'plan':
        case 'more':
            return 'overview';
        default:
            return null;
    }
};

export const isTripWorkspacePage = (value?: string | null): value is TripWorkspacePage =>
    normalizeTripWorkspacePage(value) !== null;

export const resolveTripWorkspaceRouteState = (pathname: string): TripWorkspaceRouteState => {
    const match = pathname.match(/^\/(trip|example|s)\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) {
        return {
            kind: null,
            basePath: null,
            page: null,
            hasExplicitPage: false,
        };
    }

    const [, rawKind, rawId, rawPage] = match;
    const kind = rawKind === 's' ? 'share' : rawKind as Exclude<TripWorkspaceRouteKind, 'share'>;
    const page = normalizeTripWorkspacePage(rawPage);

    return {
        kind,
        basePath: `/${rawKind}/${rawId}`,
        page,
        hasExplicitPage: Boolean(rawPage && page),
    };
};

export const buildTripWorkspacePath = (
    basePath: string,
    page: TripWorkspacePage,
): string => `${basePath.replace(/\/+$/, '')}/${page}`;
