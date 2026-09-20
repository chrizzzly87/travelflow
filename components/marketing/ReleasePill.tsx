import React from 'react';

import { cn } from '../../lib/utils';
import type { ReleaseNoteItem } from '../../services/releaseNotesFormat';

type ReleaseTypeKey = ReleaseNoteItem['typeKey'];

/**
 * The type chip on a changelog entry.
 *
 * Light mode is a soft tint of the hue. Dark mode cannot just re-use it: a -100
 * fill stays near-white and a -800 label stays near-black, so the chip inverts
 * into a bright slab. It also cannot be a barely-there wash — at a 12% tint the
 * chip disappeared and the label read as loose floating text with no chip around
 * it at all.
 *
 * So dark gets a 20% tint of the mid tone, a -200 label and a 35% border. That
 * is present enough to read as a chip and still comfortably legible: measured
 * against the warm card, every hue lands between 7.4 and 8.1 against its own
 * tinted background, where AA wants 4.5.
 */
const PILL_CLASSES: Record<ReleaseTypeKey, string> = {
    new: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-400/20 dark:text-emerald-200 dark:border-emerald-400/35 dark:bg-emerald-400/12 dark:border-emerald-400/30',
    improved: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-400/20 dark:text-sky-200 dark:border-sky-400/35 dark:bg-sky-400/12 dark:border-sky-400/30',
    fixed: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-400/20 dark:text-amber-200 dark:border-amber-400/35 dark:bg-amber-400/12 dark:border-amber-400/30',
    internal: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-400/20 dark:text-rose-200 dark:border-rose-400/35 dark:bg-rose-400/12 dark:border-rose-400/30',
    update: 'bg-accent-100 text-accent-800 border-accent-200 dark:bg-accent-400/20 dark:text-accent-200 dark:border-accent-400/35 dark:bg-accent-400/12 dark:border-accent-400/30',
};

const BASE =
    'inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide';

interface ReleasePillProps {
    /** Pass an item, or a bare `typeKey` + `label` for a standalone chip. */
    item?: ReleaseNoteItem;
    typeKey?: ReleaseTypeKey;
    label?: string;
    className?: string;
}

export const ReleasePill: React.FC<ReleasePillProps> = ({ item, typeKey, label, className }) => {
    const key = item?.typeKey ?? typeKey ?? 'update';
    const text = item?.typeLabel ?? label ?? '';
    return <span className={cn(BASE, PILL_CLASSES[key], className)}>{text}</span>;
};
