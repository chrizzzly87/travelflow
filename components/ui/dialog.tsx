import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';

/**
 * The dialog primitives.
 *
 * `DialogContent` is a flex column with a bounded height. Put the scrolling
 * part in `DialogBody`; `DialogHeader` and `DialogFooter` are siblings of it,
 * so they stay pinned while the body scrolls — no `position: sticky` needed.
 *
 * ```tsx
 * <DialogContent size="lg">
 *   <DialogHeader>
 *     <DialogTitle>Default AI model</DialogTitle>
 *     <DialogDescription>Only approved models are used at runtime.</DialogDescription>
 *   </DialogHeader>
 *   <DialogBody>…the long, scrolling part…</DialogBody>
 *   <DialogFooter>
 *     <Button variant="ghost">Cancel</Button>
 *     <Button>Save</Button>
 *   </DialogFooter>
 * </DialogContent>
 * ```
 *
 * Every horizontal inset comes from the same `px-5`, so the header, the body
 * and the footer line up. Content placed directly in `DialogContent` instead of
 * `DialogBody` gets no padding and will sit flush against the edge.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn('fixed inset-0 z-[1700] bg-black/45 backdrop-blur-[1.5px]', className)}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DIALOG_SIZE_CLASS = {
    sm: 'w-[min(92vw,420px)]',
    md: 'w-[min(92vw,560px)]',
    lg: 'w-[min(92vw,680px)]',
    xl: 'w-[min(92vw,860px)]',
} as const;

export type DialogSize = keyof typeof DIALOG_SIZE_CLASS;

export interface DialogContentProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    overlayClassName?: string;
    /** Width preset. Defaults to `lg` (680px), the previous fixed width. */
    size?: DialogSize;
    /**
     * Render the corner close button. Off by default: several dialogs here
     * already draw their own, and two of them in one corner looks broken.
     */
    showCloseButton?: boolean;
    closeLabel?: string;
}

export const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    DialogContentProps
>(({ className, overlayClassName, size = 'lg', showCloseButton = false, closeLabel = 'Close', children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed left-1/2 top-1/2 z-[1701] -translate-x-1/2 -translate-y-1/2',
                DIALOG_SIZE_CLASS[size],
                // A bounded height plus a flex column is what lets DialogBody
                // scroll while the header and footer stay put.
                'flex max-h-[min(85dvh,48rem)] flex-col overflow-hidden',
                'rounded-xl border border-slate-200 bg-white p-0 shadow-2xl focus:outline-none',
                className,
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close
                    aria-label={closeLabel}
                    className="absolute end-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none"
                >
                    <X size={16} weight="bold" />
                </DialogPrimitive.Close>
            )}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Draw a rule beneath the header. Use it when the body scrolls under it. */
    divided?: boolean;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ className, divided = false, ...props }) => (
    <div
        data-slot="dialog-header"
        className={cn(
            'flex shrink-0 flex-col gap-1.5 px-5 pb-4 pt-5',
            divided && 'border-b border-slate-200',
            className,
        )}
        {...props}
    />
);

export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Drop the default inset when the body owns its own padding. */
    padded?: boolean;
    /**
     * Set false when a child owns the scrolling — a virtualised list or a
     * search result pane, say. Two nested scrollers trap the wheel in the
     * inner one and strand the outer scrollbar.
     */
    scroll?: boolean;
}

/** The scrolling region. Shares the header's horizontal inset. */
export const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
    ({ className, padded = true, scroll = true, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="dialog-body"
            className={cn(
                'min-h-0 flex-1',
                scroll ? 'overflow-y-auto' : 'overflow-hidden',
                padded && 'px-5 py-1',
                className,
            )}
            {...props}
        />
    ),
);
DialogBody.displayName = 'DialogBody';

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Pin the footer with a rule above it. On by default — a footer is only
     * worth having when it stays visible while the body scrolls.
     */
    sticky?: boolean;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ className, sticky = true, ...props }) => (
    <div
        data-slot="dialog-footer"
        className={cn(
            'flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 pb-5 pt-4',
            sticky && 'border-t border-slate-200 bg-white',
            className,
        )}
        {...props}
    />
);

export const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-lg font-semibold text-slate-900', className)}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm text-slate-500', className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
