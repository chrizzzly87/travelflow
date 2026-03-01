import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

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
        className={`fixed inset-0 z-[1700] bg-black/45 backdrop-blur-[1.5px] ${className ?? ''}`.trim()}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { overlayClassName?: string }
>(({ className, overlayClassName, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Content
            ref={ref}
            className={[
                'fixed left-1/2 top-1/2 z-[1701] w-[min(92vw,680px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl',
                'border border-gray-200 bg-white p-0 shadow-2xl focus:outline-none',
                className ?? '',
            ].join(' ')}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={`flex flex-col gap-1.5 p-5 ${className ?? ''}`.trim()} {...props} />
);

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <div className={`mt-auto flex items-center justify-end gap-2 p-5 ${className ?? ''}`.trim()} {...props} />
);

export const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={`text-lg font-semibold text-gray-900 ${className ?? ''}`.trim()} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description ref={ref} className={`text-sm text-gray-500 ${className ?? ''}`.trim()} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
