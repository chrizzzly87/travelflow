import React from 'react';
import type { AdminUserRecord } from '../../../services/adminService';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { LOGIN_PILL_LABELS, getUserLoginPillKeys } from '../adminUsersModel';
import { LOGIN_PILL_STYLES } from './loginPillStyles';

/** One badge per way the account can sign in. */
export const UserLoginPills: React.FC<{ user: AdminUserRecord }> = ({ user }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        {getUserLoginPillKeys(user).map((key) => {
            const { icon: Icon, className } = LOGIN_PILL_STYLES[key];
            const label = LOGIN_PILL_LABELS[key];
            return (
                <AdminStatusBadge key={label} dot={false} className={className}>
                    <Icon size={12} aria-hidden="true" />
                    {label}
                </AdminStatusBadge>
            );
        })}
    </div>
);
