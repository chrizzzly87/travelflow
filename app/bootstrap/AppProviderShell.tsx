import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppDialogProvider } from '../../components/AppDialogProvider';
import { LoginModalProvider } from '../../contexts/LoginModalContext';

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
                    </LoginModalProvider>
                </AppDialogProvider>
            </AuthProvider>
        </Router>
    );
};
