import React from 'react';
import { ActivityType } from '../types';
import { ACTIVITY_TYPE_COLORS } from '../utils';
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

const resolveColorParts = (type: ActivityType) => {
    const base = ACTIVITY_TYPE_COLORS[type] || ACTIVITY_TYPE_COLORS.general;
    const classes = base.split(' ');
    const bg = classes.find(c => c.startsWith('bg-')) || 'bg-slate-100';
    const border = classes.find(c => c.startsWith('border-')) || 'border-slate-300';
    const text = classes.find(c => c.startsWith('text-')) || 'text-slate-800';
    return { bg, border, text };
};

export const getActivityTypePaletteClass = (type: ActivityType): string => {
    const { bg, border, text } = resolveColorParts(type);
    return `${bg} ${border} ${text}`;
};

export const getActivityTypeButtonClass = (type: ActivityType, isSelected: boolean): string => {
    const { bg, border, text } = resolveColorParts(type);
    if (isSelected) return `${bg} ${border} ${text} shadow-sm ring-1 ring-black/5`;
    return 'bg-white border-gray-200 text-gray-500 hover:border-gray-300';
};

export const formatActivityTypeLabel = (type: ActivityType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
};

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
