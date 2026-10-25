import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface AdminErrorAlertProps {
    /** The authored sentence to show. Never a raw exception. */
    message: React.ReactNode;
    title?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

/** A failed load or save, shown above the surface it affects. */
export const AdminErrorAlert: React.FC<AdminErrorAlertProps> = ({ message, title, action, className }) => (
    <Alert variant="danger" className={className}>
        <WarningCircle weight="fill" />
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription>
            <p>{message}</p>
            {action && <div className="mt-2">{action}</div>}
        </AlertDescription>
    </Alert>
);
