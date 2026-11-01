import React from 'react';
import {
    AppleLogo,
    ChatCircleDots,
    DiscordLogo,
    FacebookLogo,
    GithubLogo,
    GoogleLogo,
    Key,
    Question,
} from '@phosphor-icons/react';
import type { AdminUserRecord } from '../../../services/adminService';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { LOGIN_PILL_LABELS, getUserLoginPillKeys, type LoginPillKey } from '../adminUsersModel';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface LoginPillStyle {
    className: string;
    icon: IconComponent;
}

export const LOGIN_PILL_STYLES: Record<LoginPillKey, LoginPillStyle> = {
    password: {
        className: 'border-border bg-secondary text-secondary-foreground',
        icon: Key,
    },
    google: {
        className: 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30',
        icon: GoogleLogo,
    },
    facebook: {
        className: 'border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30',
        icon: FacebookLogo,
    },
    kakao: {
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30',
        icon: ChatCircleDots,
    },
    apple: {
        className: 'border-slate-400 bg-secondary text-foreground dark:border-slate-500',
        icon: AppleLogo,
    },
    github: {
        className: 'border-zinc-400 bg-secondary text-foreground dark:border-zinc-500',
        icon: GithubLogo,
    },
    discord: {
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-400/12 dark:text-indigo-200 dark:border-indigo-400/30',
        icon: DiscordLogo,
    },
    other_social: {
        className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-400/12 dark:text-fuchsia-200 dark:border-fuchsia-400/30',
        icon: ChatCircleDots,
    },
    anonymous: {
        className: 'border-border bg-secondary text-muted-foreground',
        icon: Question,
    },
    unknown: {
        className: 'border-border bg-secondary text-muted-foreground',
        icon: Question,
    },
};

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
