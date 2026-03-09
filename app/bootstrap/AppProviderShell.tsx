import React from 'react';
import { unstable_HistoryRouter as Router } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppDialogProvider } from '../../components/AppDialogProvider';
import { LoginModalProvider } from '../../contexts/LoginModalContext';
import { appHistory } from '../../shared/appHistory';

interface AppProviderShellProps {
    children: React.ReactNode;
}

export const AppProviderShell: React.FC<AppProviderShellProps> = ({ children }) => {
    return (
        <Router history={appHistory} unstable_useTransitions={false}>
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
