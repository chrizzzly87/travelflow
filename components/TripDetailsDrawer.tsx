import React from 'react';
import { Drawer, DrawerContent } from './ui/drawer';

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
    onExpandedChange: _onExpandedChange,
    children,
}) => {
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            autoFocus={false}
        >
            <DrawerContent
                className="h-[min(92vh,780px)] p-0"
                accessibleTitle="Trip details"
                accessibleDescription="View and edit selected city, travel segment, or activity details."
            >
                <div className="h-full overflow-hidden">{children}</div>
            </DrawerContent>
        </Drawer>
    );
};
