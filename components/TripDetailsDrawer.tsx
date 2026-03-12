import React from 'react';
import { Drawer, DrawerContent } from './ui/drawer';

const FULL_SNAP_POINT = 0.9;

export interface TripDetailsDrawerProps {
    open: boolean;
    expanded: boolean;
    onOpenChange: (open: boolean) => void;
    onExpandedChange: (expanded: boolean) => void;
    children: React.ReactNode;
}

export const TripDetailsDrawer: React.FC<TripDetailsDrawerProps> = ({
    open,
    expanded: _expanded,
    onOpenChange,
    onExpandedChange,
    children,
}) => {
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            activeSnapPoint={FULL_SNAP_POINT}
            setActiveSnapPoint={(nextSnapPoint) => {
                const isExpanded = nextSnapPoint === FULL_SNAP_POINT;
                onExpandedChange(isExpanded);
                if (!isExpanded) onOpenChange(false);
            }}
            snapPoints={[FULL_SNAP_POINT]}
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
                className="h-[min(92vh,780px)] p-0"
                accessibleTitle="Trip details"
                accessibleDescription="View and edit selected city, travel segment, or activity details."
            >
                <div className="h-full overflow-hidden">{children}</div>
            </DrawerContent>
        </Drawer>
    );
};
