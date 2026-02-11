import React from 'react';
import { Plane, Train, Bus, Ship, Car, Map } from 'lucide-react';
import type { TransportMode } from '../types';
import { normalizeTransportMode } from '../shared/transportModes';

type TransportModeIconProps = {
    mode?: TransportMode | string;
    size?: number;
    className?: string;
};

const IconBase = ({ size = 16, className, children }: { size?: number; className?: string; children: React.ReactNode }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {children}
    </svg>
);

const WalkIcon = ({ size, className }: { size?: number; className?: string }) => (
    <IconBase size={size} className={className}>
        <ellipse cx="8" cy="17" rx="2.6" ry="3.6" />
        <ellipse cx="16.5" cy="9.5" rx="2.2" ry="3.1" />
        <circle cx="15.6" cy="5.7" r="0.7" />
        <circle cx="17" cy="5.4" r="0.6" />
        <circle cx="18.2" cy="5.9" r="0.55" />
    </IconBase>
);

const BicycleIcon = ({ size, className }: { size?: number; className?: string }) => (
    <IconBase size={size} className={className}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M6 17l4-7h5l3 7" />
        <path d="M10 10l-2-3" />
        <path d="M15 10l2-2" />
        <path d="M11 10h4" />
    </IconBase>
);

const MotorcycleIcon = ({ size, className }: { size?: number; className?: string }) => (
    <IconBase size={size} className={className}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M6 17l4-5h6l2 5" />
        <path d="M10 12h5" />
        <path d="M12 9l3-2" />
        <path d="M15 7h3" />
    </IconBase>
);

export const TransportModeIcon = ({ mode, size = 16, className }: TransportModeIconProps) => {
    const normalizedMode = normalizeTransportMode(mode);
    switch (normalizedMode) {
        case 'walk':
            return <WalkIcon size={size} className={className} />;
        case 'bicycle':
            return <BicycleIcon size={size} className={className} />;
        case 'motorcycle':
            return <MotorcycleIcon size={size} className={className} />;
        case 'plane':
            return <Plane size={size} className={className} />;
        case 'train':
            return <Train size={size} className={className} />;
        case 'bus':
            return <Bus size={size} className={className} />;
        case 'boat':
            return <Ship size={size} className={className} />;
        case 'car':
            return <Car size={size} className={className} />;
        case 'na':
        default:
            return <Map size={size} className={className} />;
    }
};
