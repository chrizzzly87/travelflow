import React from 'react';
import { unstable_HistoryRouter as Router } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppDialogProvider } from '../../components/AppDialogProvider';
import { LoginModalProvider } from '../../contexts/LoginModalContext';
import { Toaster } from '../../components/ui/sonner';
import { appHistory } from '../../shared/appHistory';

interface AppProviderShellProps {
    children: React.ReactNode;
}

export const AppProviderShell: React.FC<AppProviderShellProps> = ({ children }) => {
    return (
        <Router history={appHistory}>
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
