import type { AppLanguage, ITrip, IViewSettings } from '../types';

export type CommitOptions = {
    replace?: boolean;
    label?: string;
    adminOverride?: boolean;
};

export type RouteCommonProps = {
    trip: ITrip | null;
    onTripLoaded: (trip: ITrip, view?: IViewSettings) => void;
    onOpenManager: () => void;
    onOpenSettings: () => void;
    appLanguage: AppLanguage;
    onViewSettingsChange: (settings: IViewSettings) => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
};

export type TripLoaderRouteProps = RouteCommonProps & {
    onUpdateTrip: (trip: ITrip, options?: { persist?: boolean }) => void;
    onCommitState: (trip: ITrip, view: IViewSettings | undefined, options?: CommitOptions) => void;
};

export type SharedTripLoaderRouteProps = RouteCommonProps;
export type ExampleTripLoaderRouteProps = RouteCommonProps;
