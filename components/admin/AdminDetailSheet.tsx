import React from 'react';
import { X } from '@phosphor-icons/react';

import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '../ui/drawer';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const SIZE_CLASS = {
    md: 'w-[min(96vw,560px)]',
    lg: 'w-[min(96vw,720px)]',
} as const;

interface AdminDetailSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The record's human name. Also the dialog's accessible title. */
    title: React.ReactNode;
    /**
     * Only when `title` is not plain text: a hidden plain-text dialog title, and
     * the visible heading is then decoration. Otherwise the visible heading is
     * the dialog title.
     */
    accessibleTitle?: string;
    /** One line under the title: an email, an id, a route. */
    subtitle?: React.ReactNode;
    /** Status badges beside the subtitle. */
    meta?: React.ReactNode;
    /** Header actions at the inline end (open in app, copy link). */
    headerActions?: React.ReactNode;
    /** Pinned footer: the record's primary actions, destructive last. */
    footer?: React.ReactNode;
    size?: keyof typeof SIZE_CLASS;
    children: React.ReactNode;
}

/**
 * The inspector for one record (a user, a trip, an audit target): a right-hand
 * sheet with a fixed header, a scrolling body and a pinned footer. Every admin
 * detail view uses this so they open, close and lay out the same way.
 */
export const AdminDetailSheet: React.FC<AdminDetailSheetProps> = ({
    open,
    onOpenChange,
    title,
    accessibleTitle,
    subtitle,
    meta,
    headerActions,
    footer,
    size = 'lg',
    children,
}) => (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
        <DrawerContent
            side="right"
            className={cn('flex flex-col p-0', SIZE_CLASS[size])}
            hasVisibleTitle={!accessibleTitle}
            accessibleTitle={accessibleTitle}
            accessibleDescription={typeof subtitle === 'string' ? subtitle : 'Record details and actions.'}
        >
            <header className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0 flex-1">
                    {/* The visible heading is the dialog's title, so it is announced once. */}
                    <DrawerTitle className="truncate text-base font-semibold text-foreground">{title}</DrawerTitle>
                    {(subtitle || meta) && (
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            {subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
                            {meta}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {headerActions}
                    <DrawerClose asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close details">
                            <X />
                        </Button>
                    </DrawerClose>
                </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-4">{children}</div>
            </div>
            {footer && (
                <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-5 py-3">
                    {footer}
                </footer>
            )}
        </DrawerContent>
    </Drawer>
);
