import React from 'react';
import { X } from '@phosphor-icons/react';

import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface AdminSelectionBarProps {
    /** Number of selected rows. The bar renders nothing at 0. */
    count: number;
    /** Singular noun for the selected records ("user", "trip", "entry"). */
    noun: string;
    /** Plural noun when it is not `${noun}s` ("entries"). */
    pluralNoun?: string;
    onClear: () => void;
    /** The bulk actions. Keep the destructive one last. */
    children: React.ReactNode;
    className?: string;
}

/**
 * Bulk actions for a table, shown only while something is selected — the
 * Linear/Vercel pattern. It floats at the bottom of the viewport so the actions
 * stay reachable while scrolling a long table, instead of a permanent strip of
 * disabled buttons reading "0 selected".
 */
export const AdminSelectionBar: React.FC<AdminSelectionBarProps> = ({
    count,
    noun,
    pluralNoun,
    onClear,
    children,
    className,
}) => {
    if (count <= 0) return null;
    const label = `${count.toLocaleString()} ${count === 1 ? noun : (pluralNoun ?? `${noun}s`)} selected`;

    return (
        <div
            role="region"
            aria-label="Bulk actions"
            className={cn(
                'pointer-events-none sticky bottom-4 z-30 mt-2 flex justify-center',
                className,
            )}
        >
            <div
                className={cn(
                    'pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-popover py-1.5 ps-3 pe-1.5 text-popover-foreground shadow-lg',
                    // Enters from below, quickly; reduced motion keeps only the fade.
                    'animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:slide-in-from-bottom-2',
                )}
            >
                <span className="text-sm font-medium tabular-nums" aria-live="polite">{label}</span>
                <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-1.5">{children}</div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection" data-tooltip="Clear selection">
                    <X />
                </Button>
            </div>
        </div>
    );
};
