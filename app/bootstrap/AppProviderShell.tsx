import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppDialogProvider } from '../../components/AppDialogProvider';
import { LoginModalProvider } from '../../contexts/LoginModalContext';
import { Toaster } from '../../components/ui/sonner';

interface AppProviderShellProps {
    children: React.ReactNode;
}

export const AppProviderShell: React.FC<AppProviderShellProps> = ({ children }) => {
    return (
        <Router>
            <AuthProvider>
                <AppDialogProvider>
                    <LoginModalProvider>
                        {children}
                        <Toaster />
                    </LoginModalProvider>
                </AppDialogProvider>
            </AuthProvider>
        </Router>
    );
};
