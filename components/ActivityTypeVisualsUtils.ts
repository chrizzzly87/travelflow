import { ActivityType } from '../types';
import { ACTIVITY_TYPE_COLORS } from '../utils';

export interface ActivityTypePaletteParts {
    bg: string;
    border: string;
    text: string;
}

export const getActivityTypePaletteParts = (type: ActivityType): ActivityTypePaletteParts => {
    const base = ACTIVITY_TYPE_COLORS[type] || ACTIVITY_TYPE_COLORS.general;
    const classes = base.split(' ');
    const bg = classes.find(c => c.startsWith('bg-')) || 'bg-slate-100';
    const border = classes.find(c => c.startsWith('border-')) || 'border-slate-300';
    const text = classes.find(c => c.startsWith('text-')) || 'text-slate-800';
    return { bg, border, text };
};

export const getActivityTypePaletteClass = (type: ActivityType): string => {
    const { bg, border, text } = getActivityTypePaletteParts(type);
    return `${bg} ${border} ${text}`;
};

export const getActivityTypeButtonClass = (type: ActivityType, isSelected: boolean): string => {
    const { bg, border, text } = getActivityTypePaletteParts(type);
    if (isSelected) return `${bg} ${border} ${text} shadow-sm ring-1 ring-black/5`;
    return 'bg-white border-gray-200 text-gray-500 hover:border-gray-300';
};

export const formatActivityTypeLabel = (type: ActivityType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
};
