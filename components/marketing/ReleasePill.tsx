import React from 'react';
import { ReleaseNoteItem } from '../../services/releaseNotesService';

interface ReleasePillProps {
    item: ReleaseNoteItem;
    className?: string;
}

const PILL_CLASSES: Record<ReleaseNoteItem['typeKey'], string> = {
    new: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    improved: 'bg-sky-100 text-sky-800 border-sky-200',
    fixed: 'bg-amber-100 text-amber-800 border-amber-200',
    internal: 'bg-slate-100 text-slate-700 border-slate-200',
    update: 'bg-accent-100 text-accent-800 border-accent-200',
};

export const ReleasePill: React.FC<ReleasePillProps> = ({ item, className }) => {
    return (
        <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${PILL_CLASSES[item.typeKey]} ${className ?? ''}`}>
            {item.typeLabel}
        </span>
    );
};
