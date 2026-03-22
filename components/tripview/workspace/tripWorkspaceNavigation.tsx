import type { ComponentType } from 'react';
import {
    Backpack,
    CloudSun,
    CalendarBlank,
    Compass,
    Files,
    GlobeHemisphereWest,
    House,
    ImagesSquare,
    NotePencil,
    SuitcaseRolling,
    Translate,
    Wallet,
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
    { page: 'budget', icon: Wallet, priority: 'primary' },
    { page: 'travel-kit', icon: Backpack, priority: 'primary' },
    { page: 'documents', icon: Files, priority: 'primary' },
    { page: 'places', icon: GlobeHemisphereWest, priority: 'primary' },
    { page: 'weather', icon: CloudSun, priority: 'primary' },
    { page: 'explore', icon: Compass, priority: 'primary' },
    { page: 'phrases', icon: Translate, priority: 'primary' },
    { page: 'notes', icon: NotePencil, priority: 'secondary' },
    { page: 'photos', icon: ImagesSquare, priority: 'secondary' },
];

const TRIP_GROUP_PAGES: TripWorkspacePage[] = [
    'overview',
    'planner',
    'bookings',
    'budget',
    'travel-kit',
    'documents',
];

const DESTINATION_GROUP_PAGES: TripWorkspacePage[] = [
    'places',
    'weather',
    'explore',
    'phrases',
];

const MEMORIES_GROUP_PAGES: TripWorkspacePage[] = [
    'notes',
    'photos',
];

export const TRIP_WORKSPACE_NAV_GROUPS: TripWorkspaceNavGroup[] = [
    {
        id: 'trip',
        pages: TRIP_WORKSPACE_NAV_ITEMS.filter((item) => TRIP_GROUP_PAGES.includes(item.page)),
    },
    {
        id: 'destination',
        pages: TRIP_WORKSPACE_NAV_ITEMS.filter((item) => DESTINATION_GROUP_PAGES.includes(item.page)),
    },
    {
        id: 'memories',
        pages: TRIP_WORKSPACE_NAV_ITEMS.filter((item) => MEMORIES_GROUP_PAGES.includes(item.page)),
    },
];

export const TRIP_WORKSPACE_PRIMARY_PAGES: TripWorkspaceNavItem[] = TRIP_WORKSPACE_NAV_ITEMS.filter(
    (item) => item.priority === 'primary',
);
