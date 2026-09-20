import React from 'react';
import type { ReleaseNoteItem } from '../../services/releaseNotesFormat';

interface ReleasePillProps {
    item: ReleaseNoteItem;
    className?: string;
}

const PILL_CLASSES: Record<ReleaseNoteItem['typeKey'], string> = {
    new: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30',
    improved: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30',
    fixed: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30',
    internal: 'bg-secondary text-foreground border-border dark:bg-secondary dark:text-foreground dark:border-border',
    update: 'bg-accent-100 text-accent-800 border-accent-200 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30',
};

export const ReleasePill: React.FC<ReleasePillProps> = ({ item, className }) => {
    return (
        <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${PILL_CLASSES[item.typeKey]} ${className ?? ''}`}>
            {item.typeLabel}
        </span>
    );
};
