import * as React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const DESKTOP_SIZE_CLASS: Record<ModalSize, string> = {
    sm: 'sm:w-[min(92vw,480px)]',
    md: 'sm:w-[min(92vw,560px)]',
    lg: 'sm:w-[min(92vw,680px)]',
    xl: 'sm:w-[min(94vw,920px)]',
};

interface AppModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    closeLabel?: string;
    size?: ModalSize;
    mobileSheet?: boolean;
    contentClassName?: string;
    bodyClassName?: string;
    headerClassName?: string;
    footer?: React.ReactNode;
    children: React.ReactNode;
    onOpenAutoFocus?: React.ComponentPropsWithoutRef<typeof DialogContent>['onOpenAutoFocus'];
}

export const AppModal: React.FC<AppModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    closeLabel = 'Close',
    size = 'md',
    mobileSheet = true,
    contentClassName,
    bodyClassName,
    headerClassName,
    footer,
    children,
    onOpenAutoFocus,
}) => {
    const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

    const handleOpenChange = React.useCallback((nextOpen: boolean) => {
        if (!nextOpen) onClose();
    }, [onClose]);

    const handleOpenAutoFocus = React.useCallback<NonNullable<React.ComponentPropsWithoutRef<typeof DialogContent>['onOpenAutoFocus']>>((event) => {
        if (onOpenAutoFocus) {
            onOpenAutoFocus(event);
            return;
        }

        event.preventDefault();
        closeButtonRef.current?.focus();
    }, [onOpenAutoFocus]);

    const contentLayoutClass = mobileSheet
        ? `left-0 right-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl ${DESKTOP_SIZE_CLASS[size]}`
        : `w-[min(92vw,680px)] ${DESKTOP_SIZE_CLASS[size]}`;

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent
                className={[
                    'flex max-h-[88vh] flex-col overflow-hidden p-0',
                    contentLayoutClass,
                    contentClassName ?? '',
                ].join(' ')}
                onOpenAutoFocus={handleOpenAutoFocus}
            >
                <DialogHeader className={`border-b border-gray-100 p-4 ${headerClassName ?? ''}`.trim()}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
                            {description ? (
                                <DialogDescription className="mt-0.5 text-xs text-gray-500">{description}</DialogDescription>
                            ) : null}
                        </div>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            onClick={onClose}
                            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100"
                            aria-label={closeLabel}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </DialogHeader>
                <div className={bodyClassName ?? 'flex-1 overflow-y-auto p-4'}>
                    {children}
                </div>
                {footer ? (
                    <div className="border-t border-gray-100 bg-white p-4">
                        {footer}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};
