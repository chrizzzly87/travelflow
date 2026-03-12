import React from 'react';
import { Drawer, DrawerContent } from './ui/drawer';

const PEEK_SNAP_POINT = '92px';
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
            dismissible
            snapToSequentialPoint
        >
            <DrawerContent
                hideOverlay
                className="h-[min(88vh,720px)] p-0"
                accessibleTitle="Trip details"
                accessibleDescription="View and edit selected city, travel segment, or activity details."
            >
                {children}
            </DrawerContent>
        </Drawer>
    );
};
