import React from 'react';
import { AirplaneTakeoff, CaretUpDown, GearSix, House, SignOut, User } from '@phosphor-icons/react';
import { useNavigate } from '@/app/navigation';

import { useAuth } from '../../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedCreateTripPath, buildLocalizedMarketingPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import { buildAccountDisplayName, computeInitial } from '../navigation/accountIdentity';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

type AdminAccountMenuEvent = `admin__account--${string}`;

interface AdminAccountMenuProps {
    /** Icon rail: the avatar alone, the menu opening beside it. */
    collapsed?: boolean;
}

const AccountAvatar: React.FC<{ initials: string; className?: string }> = ({ initials, className }) => (
    <span
        className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-100 text-xs font-semibold text-accent-800 dark:bg-accent-400/15 dark:text-accent-200',
            className,
        )}
        aria-hidden="true"
    >
        {initials}
    </span>
);

/**
 * The signed-in admin at the foot of the sidebar (the shadcn "nav user"
 * pattern): avatar, name and email with an up/down caret, opening upwards so the
 * menu grows into the sidebar instead of over the page. On the icon rail it is
 * the avatar alone and the menu opens beside the rail.
 */
export const AdminAccountMenu: React.FC<AdminAccountMenuProps> = ({ collapsed = false }) => {
    const navigate = useNavigate();
    const { access, profile, logout } = useAuth();
    const email = access?.email || null;
    const userId = access?.userId || null;
    const displayName = buildAccountDisplayName(profile, email, userId);
    const initials = computeInitial(profile, email, userId);
    const secondaryLine = email && email !== displayName ? email : 'Administrator';

    const go = (eventName: AdminAccountMenuEvent, path: string) => {
        trackEvent(eventName);
        navigate(path);
    };

    const handleLogout = async () => {
        trackEvent('admin__account--logout');
        await logout();
        navigate(buildLocalizedMarketingPath('home', DEFAULT_LOCALE));
    };

    return (
        <DropdownMenu onOpenChange={(open) => { if (open) trackEvent('admin__account--open'); }}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={collapsed ? `Account: ${displayName}` : undefined}
                    data-tooltip={collapsed ? displayName : undefined}
                    className={cn(
                        'flex items-center gap-2.5 rounded-md text-start outline-none transition-colors',
                        'hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent',
                        collapsed ? 'size-10 justify-center' : 'h-12 w-full px-2',
                    )}
                    {...getAnalyticsDebugAttributes('admin__account--open')}
                >
                    <AccountAvatar initials={initials} />
                    {!collapsed && (
                        <>
                            <span className="grid min-w-0 flex-1 leading-tight">
                                <span className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</span>
                                <span className="truncate text-xs text-muted-foreground">{secondaryLine}</span>
                            </span>
                            <CaretUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side={collapsed ? 'right' : 'top'}
                align={collapsed ? 'end' : 'start'}
                sideOffset={collapsed ? 12 : 6}
                aria-label="Account menu"
                className={cn(
                    'z-[2100] min-w-60 rounded-lg p-1',
                    // Expanded: as wide as the trigger, like a native select.
                    !collapsed && 'w-(--radix-dropdown-menu-trigger-width)',
                )}
            >
                <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-1.5 font-normal">
                    <AccountAvatar initials={initials} />
                    <span className="grid min-w-0 leading-tight">
                        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">{secondaryLine}</span>
                    </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => go('admin__account--profile', '/profile')}>
                        <User />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => go('admin__account--settings', '/profile/settings')}>
                        <GearSix />
                        Account settings
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => go('admin__account--app_home', '/')}>
                        <House />
                        Back to TravelFlow
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => go('admin__account--create_trip', buildLocalizedCreateTripPath(DEFAULT_LOCALE))}>
                        <AirplaneTakeoff />
                        Create trip
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void handleLogout()}>
                    <SignOut />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
