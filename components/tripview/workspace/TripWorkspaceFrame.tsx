import React from 'react';

interface TripWorkspaceFrameProps {
    children: React.ReactNode;
}

export const TripWorkspaceFrame: React.FC<TripWorkspaceFrameProps> = ({ children }) => (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-background">
        {children}
    </div>
);
