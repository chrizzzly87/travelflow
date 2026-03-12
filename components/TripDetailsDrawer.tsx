import React from 'react';
import { Drawer, DrawerContent } from './ui/drawer';

const PEEK_SNAP_POINT = '132px';
const FULL_SNAP_POINT = 0.9;

export interface TripDetailsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export const TripDetailsDrawer: React.FC<TripDetailsDrawerProps> = ({
    open,
    onOpenChange,
    children,
}) => {
    const [activeSnapPoint, setActiveSnapPoint] = React.useState<number | string | null>(PEEK_SNAP_POINT);
    const isPeekVisible = activeSnapPoint === PEEK_SNAP_POINT;

    React.useEffect(() => {
        if (!open) {
            setActiveSnapPoint(PEEK_SNAP_POINT);
        }
    }, [open]);

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            activeSnapPoint={activeSnapPoint}
            setActiveSnapPoint={setActiveSnapPoint}
            snapPoints={[PEEK_SNAP_POINT, FULL_SNAP_POINT]}
            shouldScaleBackground={false}
            modal={false}
            autoFocus={false}
            handleOnly
            disablePreventScroll
            dismissible
            snapToSequentialPoint
        >
            <DrawerContent
                hideOverlay
                className={`h-[min(88vh,720px)] p-0 ${isPeekVisible ? 'pointer-events-none' : 'pointer-events-auto'}`}
                accessibleTitle="Trip details"
                accessibleDescription="View and edit selected city, travel segment, or activity details."
            >
                <div className="relative h-full">
                    {isPeekVisible && (
                        <button
                            type="button"
                            onClick={() => setActiveSnapPoint(FULL_SNAP_POINT)}
                            className="pointer-events-auto absolute inset-x-0 top-0 z-20 h-[132px] cursor-ns-resize bg-transparent"
                            aria-label="Expand trip details drawer"
                        >
                            <span className="sr-only">Expand trip details drawer</span>
                        </button>
                    )}
                    <div className={`h-full ${isPeekVisible ? 'pointer-events-none overflow-hidden' : 'pointer-events-auto overflow-hidden'}`}>
                        {children}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
