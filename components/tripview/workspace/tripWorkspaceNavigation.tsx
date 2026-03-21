import type { ComponentType } from 'react';
import {
    CalendarBlank,
    Compass,
    GlobeHemisphereWest,
    House,
    ImagesSquare,
    NotePencil,
    SuitcaseRolling,
    Translate,
} from '@phosphor-icons/react';

import type { TripWorkspacePage } from '../../../types';

export interface TripWorkspaceNavItem {
    page: TripWorkspacePage;
    icon: ComponentType<{ size?: number; weight?: "fill" | "regular" | "thin" | "light" | "bold" | "duotone"; className?: string }>;
    priority: 'primary' | 'secondary';
}

export interface TripWorkspaceNavGroup {
    id: 'trip' | 'destination' | 'memories';
    pages: TripWorkspaceNavItem[];
}

export const TRIP_WORKSPACE_NAV_ITEMS: TripWorkspaceNavItem[] = [
    { page: 'overview', icon: House, priority: 'primary' },
    { page: 'planner', icon: CalendarBlank, priority: 'primary' },
    { page: 'bookings', icon: SuitcaseRolling, priority: 'primary' },
    { page: 'places', icon: GlobeHemisphereWest, priority: 'primary' },
    { page: 'explore', icon: Compass, priority: 'primary' },
    { page: 'phrases', icon: Translate, priority: 'primary' },
    { page: 'notes', icon: NotePencil, priority: 'secondary' },
    { page: 'photos', icon: ImagesSquare, priority: 'secondary' },
];

export const TRIP_WORKSPACE_NAV_GROUPS: TripWorkspaceNavGroup[] = [
    {
        id: 'trip',
        pages: TRIP_WORKSPACE_NAV_ITEMS.slice(0, 3),
    },
    {
        id: 'destination',
        pages: TRIP_WORKSPACE_NAV_ITEMS.slice(3, 6),
    },
    {
        id: 'memories',
        pages: TRIP_WORKSPACE_NAV_ITEMS.slice(6),
    },
];

export const TRIP_WORKSPACE_PRIMARY_PAGES: TripWorkspaceNavItem[] = TRIP_WORKSPACE_NAV_ITEMS.filter(
    (item) => item.priority === 'primary',
);

