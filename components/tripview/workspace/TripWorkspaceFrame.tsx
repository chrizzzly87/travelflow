import React from 'react';

interface TripWorkspaceFrameProps {
    children: React.ReactNode;
}

export const TripWorkspaceFrame: React.FC<TripWorkspaceFrameProps> = ({ children }) => (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(248,250,252,0.72))]">
        {children}
    </div>
);
