'use client';

import React from 'react';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppDialogProvider } from '../../components/AppDialogProvider';
import { LoginModalProvider } from '../../contexts/LoginModalContext';
import { Toaster } from '../../components/ui/sonner';

interface AppProviderShellProps {
    children: React.ReactNode;
}

// Routing context is provided above this shell (NextRouterAdapter in the Next
// root layout; MemoryRouter in tests).
export const AppProviderShell: React.FC<AppProviderShellProps> = ({ children }) => {
    return (
        <AuthProvider>
            <AppDialogProvider>
                <LoginModalProvider>
                    {children}
                    <Toaster />
                </LoginModalProvider>
            </AppDialogProvider>
        </AuthProvider>
    );
};
