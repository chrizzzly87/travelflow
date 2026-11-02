import React from 'react';
import {
    AirplaneTakeoff,
    ChartLineUp,
    ChartPieSlice,
    CreditCard,
    Flask,
    GlobeHemisphereWest,
    Heartbeat,
    ImageSquare,
    MapPin,
    Palette,
    Robot,
    Scales,
    Scroll,
    SlidersHorizontal,
    StackSimple,
    SuitcaseRolling,
    UsersThree,
    type Icon,
} from '@phosphor-icons/react';

import type { AdminNavItemIconKey } from './adminNavConfig';

const NAV_ICONS: Record<AdminNavItemIconKey, Icon> = {
    overview: ChartPieSlice,
    settings: SlidersHorizontal,
    users: UsersThree,
    trips: SuitcaseRolling,
    trip_drafts: Robot,
    tiers: StackSimple,
    billing: CreditCard,
    audit: Scroll,
    airports: AirplaneTakeoff,
    destinations: GlobeHemisphereWest,
    recommendations: MapPin,
    legal: Scales,
    benchmark: Flask,
    telemetry: ChartLineUp,
    worker_health: Heartbeat,
    og_tools: ImageSquare,
    design_system: Palette,
};

interface AdminNavIconProps {
    icon: AdminNavItemIconKey;
    className?: string;
    weight?: 'regular' | 'duotone' | 'fill';
}

export const AdminNavIcon: React.FC<AdminNavIconProps> = ({ icon, className, weight = 'regular' }) => {
    const IconComponent = NAV_ICONS[icon] ?? Flask;
    return <IconComponent className={className} weight={weight} aria-hidden="true" />;
};
