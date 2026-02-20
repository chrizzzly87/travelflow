import React from 'react';
import { Drawer, DrawerContent } from './ui/drawer';

export interface TripDetailsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export const TripDetailsDrawer: React.FC<TripDetailsDrawerProps> = ({
    open,
    onOpenChange,
    children,
}) => (
    <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
        modal
        dismissible
    >
        <DrawerContent
            className="h-[82vh] p-0"
            accessibleTitle="Trip details"
            accessibleDescription="View and edit selected city, travel segment, or activity details."
        >
            {children}
        </DrawerContent>
    </Drawer>
);
