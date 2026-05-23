import React from 'react';
import { ActivityType } from '../types';
import {
    Camera,
    Coffee,
    Compass,
    Dumbbell,
    Landmark,
    Leaf,
    Map,
    Mountain,
    Music,
    Palmtree,
    PawPrint,
    ShoppingBag,
    Utensils,
} from 'lucide-react';

export const ActivityTypeIcon: React.FC<{ type: ActivityType; size?: number; className?: string }> = ({ type, size = 14, className }) => {
    switch (type) {
        case 'food':
            return <Utensils size={size} className={className} />;
        case 'sightseeing':
            return <Camera size={size} className={className} />;
        case 'relaxation':
            return <Coffee size={size} className={className} />;
        case 'culture':
            return <Landmark size={size} className={className} />;
        case 'nightlife':
            return <Music size={size} className={className} />;
        case 'sports':
            return <Dumbbell size={size} className={className} />;
        case 'hiking':
            return <Mountain size={size} className={className} />;
        case 'wildlife':
            return <PawPrint size={size} className={className} />;
        case 'shopping':
            return <ShoppingBag size={size} className={className} />;
        case 'adventure':
            return <Compass size={size} className={className} />;
        case 'beach':
            return <Palmtree size={size} className={className} />;
        case 'nature':
            return <Leaf size={size} className={className} />;
        case 'general':
        default:
            return <Map size={size} className={className} />;
    }
};
